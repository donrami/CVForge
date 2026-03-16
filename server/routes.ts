import { Router } from 'express';
import { prisma, ai } from '../server.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);

export const apiRouter = Router();

if (!process.env.NEXTAUTH_SECRET) {
  throw new Error('NEXTAUTH_SECRET environment variable is required');
}
if (!process.env.AUTH_PASSWORD_HASH) {
  throw new Error('AUTH_PASSWORD_HASH environment variable is required');
}

const JWT_SECRET = process.env.NEXTAUTH_SECRET;
const AUTH_PASSWORD_HASH = process.env.AUTH_PASSWORD_HASH;

// Auth Middleware
export const requireAuth = (req: any, res: any, next: any) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Login Route
apiRouter.post('/auth/login', async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password required' });
  
  const isValid = await bcrypt.compare(password, AUTH_PASSWORD_HASH);
  if (!isValid) return res.status(401).json({ error: 'Invalid password' });

  const token = jwt.sign({ authenticated: true }, JWT_SECRET, { expiresIn: '7d' });
  res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 60 * 60 * 1000 });
  res.json({ success: true });
});

apiRouter.post('/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true });
});

apiRouter.get('/auth/session', (req, res) => {
  const token = req.cookies.token;
  if (!token) return res.json({ authenticated: false });
  try {
    jwt.verify(token, JWT_SECRET);
    res.json({ authenticated: true });
  } catch (e) {
    res.json({ authenticated: false });
  }
});

// Applications Routes
apiRouter.get('/applications', requireAuth, async (req, res) => {
  try {
    const apps = await prisma.application.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ applications: apps });
  } catch (e: any) {
    res.status(500).json({ error: e.message, code: 'DATABASE_ERROR' });
  }
});

apiRouter.get('/applications/:id', requireAuth, async (req, res) => {
  try {
    const app = await prisma.application.findUnique({
      where: { id: req.params.id, deletedAt: null },
      include: { parent: true, regenerations: { where: { deletedAt: null } } }
    });
    if (!app) return res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
    res.json(app);
  } catch (e: any) {
    res.status(500).json({ error: e.message, code: 'DATABASE_ERROR' });
  }
});

apiRouter.patch('/applications/:id', requireAuth, async (req, res) => {
  try {
    const app = await prisma.application.update({
      where: { id: req.params.id },
      data: req.body
    });
    res.json(app);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

apiRouter.delete('/applications/:id', requireAuth, async (req, res) => {
  try {
    await prisma.application.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() }
    });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message, code: 'DATABASE_ERROR' });
  }
});

apiRouter.get('/applications/:id/download/tex', requireAuth, async (req, res) => {
  try {
    const app = await prisma.application.findUnique({ where: { id: req.params.id, deletedAt: null } });
    if (!app) return res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
    
    res.setHeader('Content-Type', 'application/x-tex');
    res.setHeader('Content-Disposition', `attachment; filename="${app.companyName.replace(/\s+/g, '_')}_CV.tex"`);
    res.send(app.latexOutput);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

apiRouter.get('/applications/:id/download/pdf', requireAuth, async (req, res) => {
  try {
    const app = await prisma.application.findUnique({ where: { id: req.params.id, deletedAt: null } });
    if (!app) return res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
    
    const genDir = path.join(process.cwd(), 'generated', app.id);
    const pdfPath = path.join(genDir, 'cv.pdf');
    const texPath = path.join(genDir, 'cv.tex');
    
    if (!fs.existsSync(genDir)) fs.mkdirSync(genDir, { recursive: true });
    if (!fs.existsSync(texPath)) fs.writeFileSync(texPath, app.latexOutput);

    if (!app.pdfGenerated || !fs.existsSync(pdfPath)) {
      try {
        await execAsync(`pdflatex -interaction=nonstopmode -output-directory="${genDir}" "${texPath}"`);
        await prisma.application.update({ where: { id: app.id }, data: { pdfGenerated: true } });
      } catch (e: any) {
        return res.status(500).json({ error: 'LaTeX compilation failed', details: e.stdout || e.message });
      }
    }
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${app.companyName.replace(/\s+/g, '_')}_CV.pdf"`);
    res.sendFile(pdfPath);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Context Settings
apiRouter.get('/settings/context', requireAuth, (req, res) => {
  const contextDir = path.join(process.cwd(), 'context');
  const files = ['master-cv.tex', 'certificates.md', 'instructions.md'];
  const result: Record<string, string> = {};
  
  for (const file of files) {
    try {
      result[file] = fs.readFileSync(path.join(contextDir, file), 'utf-8');
    } catch (e) {
      result[file] = '';
    }
  }
  res.json(result);
});

apiRouter.post('/settings/context', requireAuth, (req, res) => {
  const contextDir = path.join(process.cwd(), 'context');
  if (!fs.existsSync(contextDir)) fs.mkdirSync(contextDir, { recursive: true });
  
  const { 'master-cv.tex': masterCv, 'certificates.md': certs, 'instructions.md': instructions } = req.body;
  
  if (masterCv !== undefined) fs.writeFileSync(path.join(contextDir, 'master-cv.tex'), masterCv);
  if (certs !== undefined) fs.writeFileSync(path.join(contextDir, 'certificates.md'), certs);
  if (instructions !== undefined) fs.writeFileSync(path.join(contextDir, 'instructions.md'), instructions);
  
  res.json({ success: true });
});

import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import cookieParser from 'cookie-parser';
import { PrismaClient } from '@prisma/client';
import { GoogleGenAI } from '@google/genai';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import { logger } from './server/services/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const prisma = new PrismaClient();

// Initialize Gemini
export const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);

  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(cors({
    origin: process.env.APP_URL || 'http://localhost:3000',
    credentials: true,
  }));

  // Rate limit login endpoint: 5 attempts per 15 minutes per IP
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { error: 'Too many login attempts, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/auth/login', loginLimiter);

  // API Routes
  app.get('/api/health', async (req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ok', db: 'connected', gemini: 'configured', latex: 'available' });
    } catch (e) {
      res.status(503).json({ status: 'error', db: 'disconnected' });
    }
  });

  const { apiRouter, requireAuth } = await import('./server/routes.js');
  const { generateRouter } = await import('./server/generate.js');
  const { certificateRouter } = await import('./server/certificates.js');
  
  app.use('/api', apiRouter);
  app.use('/api', generateRouter);
  app.use('/api', certificateRouter);

  // Serve uploaded files statically (auth-protected)
  const uploadsDir = path.join(__dirname, 'uploads');
  app.use('/uploads', requireAuth, express.static(uploadsDir));
  
  // Custom middleware to handle 404 for missing upload files
  app.use('/uploads', (req, res) => {
    res.status(404).json({ error: 'File not found' });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    logger.info(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

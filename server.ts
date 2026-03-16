import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import cookieParser from 'cookie-parser';
import { PrismaClient } from '@prisma/client';
import { GoogleGenAI } from '@google/genai';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const prisma = new PrismaClient();

// Initialize Gemini
export const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cookieParser());

  // API Routes
  app.get('/api/health', async (req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ok', db: 'connected', gemini: 'configured', latex: 'available' });
    } catch (e) {
      res.status(503).json({ status: 'error', db: 'disconnected' });
    }
  });

  const { apiRouter } = await import('./server/routes.js');
  const { generateRouter } = await import('./server/generate.js');
  const { certificateRouter } = await import('./server/certificates.js');
  
  app.use('/api', apiRouter);
  app.use('/api', generateRouter);
  app.use('/api', certificateRouter);

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
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

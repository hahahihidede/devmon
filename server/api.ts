import express from 'express';
import { initDbPool } from './db.js';
import { initStorage } from './storage.js';
import authRouter from './routes/auth.js';
import keywordsRouter from './routes/keywords.js';
import screenshotsRouter from './routes/screenshots.js';
import systemRouter from './routes/system.js';

export const apiApp = express();

// Parse JSON and URL encoded bodies
apiApp.use(express.json({ limit: '10mb' }));
apiApp.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Initialize DB pool and storage directory
initStorage();
initDbPool().catch(err => {
  console.warn('[Server] DB pool initialization notice:', err.message);
});

// Mount modular sub-routers under /api
apiApp.use('/api/auth', authRouter);
apiApp.use('/api/keywords', keywordsRouter);
apiApp.use('/api/screenshots', screenshotsRouter);
apiApp.use('/api/system', systemRouter);

// Health check
apiApp.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'device-activity-backend',
  });
});

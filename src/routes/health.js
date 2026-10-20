import { Router } from 'express';
import { checkDbHealth } from '../config/db.js';
import { env } from '../config/env.js';

const router = Router();

router.get('/', async (_req, res) => {
  const db = await checkDbHealth();
  res.status(db.ok || env.NODE_ENV === 'development' ? 200 : 503).json({
    status: db.ok ? 'ok' : 'degraded',
    service: 'portfolio-api',
    database: db.ok ? 'connected' : 'unavailable',
    email: env.emailConfigured ? 'configured' : 'not_configured',
  });
});

export default router;

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import contactRoutes from './routes/contact.js';
import healthRoutes from './routes/health.js';
import authRoutes from './routes/auth.js';
import vaultRoutes from './routes/vault.js';

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: (origin, cb) => {
      const allowed = env.CLIENT_ORIGIN.split(',').map((s) => s.trim());
      if (!origin || allowed.includes(origin) || env.NODE_ENV === 'development') {
        cb(null, true);
      } else {
        cb(new Error('Not allowed by CORS'));
      }
    },
    // ✅ All methods including DELETE and PATCH (needed for vault delete/update)
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    // Cache preflight for 1 hour (faster subsequent requests)
    maxAge: 3600,
  })
);
app.use(express.json({ limit: '32kb' }));

app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/contact', contactRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/vault', vaultRoutes);

app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Not found' });
});

app.use((err, _req, res, _next) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      message: 'Request too large.',
    });
  }
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      success: false,
      message: 'Origin not allowed.',
    });
  }
  console.error('Unhandled error:', err.message);
  res.status(500).json({
    success: false,
    message: 'Internal server error.',
  });
});

export default app;

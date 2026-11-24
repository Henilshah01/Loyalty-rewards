import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from './lib/rateLimit.js';
import { requireAuth, requireAdmin } from './middleware/auth.js';
import { notFound, errorHandler } from './middleware/error.js';
import { authRoutes } from './routes/auth.js';
import { customerRoutes } from './routes/customer.js';
import { adminRoutes } from './routes/admin.js';

export function createApp(cfg) {
  const app = express();
  if (cfg.trustProxy) app.set('trust proxy', 1); // so req.ip is the real client behind a proxy
  app.use(helmet());
  app.use(cors({ origin: cfg.clientOrigin }));
  app.use(express.json({ limit: '20kb' }));
  app.use('/api', rateLimit({ windowMs: 60_000, max: 120 }));

  app.get('/api/health', (req, res) => res.json({ ok: true }));

  const auth = requireAuth(cfg);
  app.use('/api/auth', authRoutes(cfg));
  app.use('/api', customerRoutes(cfg, auth));
  app.use('/api/admin', auth, requireAdmin, adminRoutes(cfg));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

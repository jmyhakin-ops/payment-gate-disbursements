import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { env } from './config/env';
import { logger } from './config/logger';
import { errorHandler, notFound } from './middleware/errorHandler';

// Routes
import authRoutes from './routes/auth.routes';
import usersRoutes from './routes/users.routes';
import organizationsRoutes from './routes/organizations.routes';
import settingsRoutes from './routes/settings.routes';
import paymentsRoutes from './routes/payments.routes';
import walletsRoutes from './routes/wallets.routes';
import auditRoutes from './routes/audit.routes';
import reportsRoutes from './routes/reports.routes';

const app = express();

// ─── Security Headers ─────────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || env.CORS_ORIGINS.includes(origin) || env.isDev) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: ${origin}`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
}));

// ─── Body Parsing ─────────────────────────────────────────────────────────────
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Request Logging ──────────────────────────────────────────────────────────
app.use(morgan('combined', {
  stream: { write: (msg) => logger.http(msg.trim()) },
  skip: (req) => req.path === '/health',
}));

// ─── Global Rate Limiting ─────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many requests, please try again later' } },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many auth attempts, please wait 15 minutes' } },
});

app.use(globalLimiter);

// ─── Static Files ─────────────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(process.cwd(), env.UPLOAD_PATH)));

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    platform: env.PLATFORM_NAME,
    version: '1.0.0',
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
const prefix = env.API_PREFIX;

app.use(`${prefix}/auth`, authLimiter, authRoutes);
app.use(`${prefix}/users`, usersRoutes);
app.use(`${prefix}/organizations`, organizationsRoutes);
app.use(`${prefix}/settings`, settingsRoutes);
app.use(`${prefix}/payments`, paymentsRoutes);
app.use(`${prefix}/wallets`, walletsRoutes);
app.use(`${prefix}/audit`, auditRoutes);
app.use(`${prefix}/reports`, reportsRoutes);

// ─── 404 & Error Handler ──────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

export default app;

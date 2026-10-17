import 'dotenv/config';
import http from 'http';
import { Server as SocketServer } from 'socket.io';
import app from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { connectDatabase, disconnectDatabase } from './config/database';
import { connectRedis, disconnectRedis } from './config/redis';

const httpServer = http.createServer(app);

// ─── Socket.IO ────────────────────────────────────────────────────────────────
export const io = new SocketServer(httpServer, {
  cors: {
    origin: env.CORS_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

io.on('connection', (socket) => {
  logger.debug(`Socket connected: ${socket.id}`);

  socket.on('join:org', (orgId: string) => {
    socket.join(`org:${orgId}`);
    logger.debug(`Socket ${socket.id} joined org:${orgId}`);
  });

  socket.on('join:user', (userId: string) => {
    socket.join(`user:${userId}`);
  });

  socket.on('disconnect', () => {
    logger.debug(`Socket disconnected: ${socket.id}`);
  });
});

// ─── Graceful Shutdown ────────────────────────────────────────────────────────
async function shutdown(signal: string) {
  logger.info(`${signal} received — graceful shutdown initiated`);
  httpServer.close(async () => {
    await disconnectDatabase();
    await disconnectRedis();
    logger.info('Server shut down cleanly');
    process.exit(0);
  });
  setTimeout(() => { logger.error('Forced shutdown after timeout'); process.exit(1); }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('uncaughtException', (err) => { logger.error('Uncaught Exception:', err); process.exit(1); });
process.on('unhandledRejection', (reason) => { logger.error('Unhandled Rejection:', reason); });

// ─── Start Server ─────────────────────────────────────────────────────────────
async function start() {
  try {
    await connectDatabase();
    await connectRedis();

    httpServer.listen(env.PORT, () => {
      logger.info(`
╔══════════════════════════════════════════════════════╗
║         🚀 KENYAPAY PAYMENT PLATFORM                 ║
║              Multi-Rail Payment System               ║
╠══════════════════════════════════════════════════════╣
║  Server  : http://localhost:${env.PORT}                     ║
║  API     : http://localhost:${env.PORT}${env.API_PREFIX}         ║
║  Env     : ${env.NODE_ENV.padEnd(42)}║
╚══════════════════════════════════════════════════════╝
      `);
    });
  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();

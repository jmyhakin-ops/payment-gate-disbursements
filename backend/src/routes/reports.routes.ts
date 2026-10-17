import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth';
import { UserRole } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { TransactionStatus } from '@prisma/client';

const router = Router();
router.use(authenticate);

// ─── GET /reports/summary ─────────────────────────────────────────────────────
router.get('/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    if (!orgId) throw new AppError('No organization', 403, 'NO_ORG');
    const { startDate, endDate } = req.query as Record<string, string>;

    const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = endDate ? new Date(endDate) : new Date();

    const [byRail, byStatus, dailyVolume, topRecipients, failureReasons] = await Promise.all([
      // By rail
      prisma.transaction.groupBy({
        by: ['rail'],
        where: { organizationId: orgId, createdAt: { gte: start, lte: end } },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      // By status
      prisma.transaction.groupBy({
        by: ['status'],
        where: { organizationId: orgId, createdAt: { gte: start, lte: end } },
        _count: { _all: true },
      }),
      // Daily volume (last 30 days)
      prisma.$queryRaw`
        SELECT DATE(created_at) as date,
               COUNT(*) as count,
               SUM(amount) as total
        FROM transactions
        WHERE organization_id = ${orgId}
          AND created_at >= ${start}
          AND created_at <= ${end}
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `,
      // Top recipients
      prisma.transaction.groupBy({
        by: ['recipientName'],
        where: { organizationId: orgId, status: TransactionStatus.COMPLETED, createdAt: { gte: start, lte: end } },
        _count: { _all: true },
        _sum: { amount: true },
        orderBy: { _sum: { amount: 'desc' } },
        take: 10,
      }),
      // Failure reasons
      prisma.transaction.groupBy({
        by: ['failureReason'],
        where: { organizationId: orgId, status: TransactionStatus.FAILED, createdAt: { gte: start, lte: end }, failureReason: { not: null } },
        _count: { _all: true },
      }),
    ]);

    res.json({ success: true, data: { byRail, byStatus, dailyVolume, topRecipients, failureReasons, period: { start, end } } });
  } catch (err) { next(err); }
});

// ─── GET /reports/reconciliation ─────────────────────────────────────────────
router.get('/reconciliation', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    if (!orgId) throw new AppError('No organization', 403, 'NO_ORG');
    const { page = '1', limit = '20' } = req.query as Record<string, string>;
    const [data, total] = await Promise.all([
      prisma.reconciliation.findMany({
        where: { organizationId: orgId },
        skip: (parseInt(page, 10) - 1) * parseInt(limit, 10),
        take: parseInt(limit, 10),
        orderBy: { runAt: 'desc' },
      }),
      prisma.reconciliation.count({ where: { organizationId: orgId } }),
    ]);
    res.json({ success: true, data, meta: { total, page: parseInt(page, 10), limit: parseInt(limit, 10) } });
  } catch (err) { next(err); }
});

// ─── POST /reports/reconciliation/run — trigger reconciliation ────────────────
router.post('/reconciliation/run', authorize(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.FINANCE_MANAGER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    if (!orgId) throw new AppError('No organization', 403, 'NO_ORG');
    const { rail, startDate, endDate } = z.object({
      rail: z.string().optional(),
      startDate: z.string().datetime(),
      endDate: z.string().datetime(),
    }).parse(req.body);

    const start = new Date(startDate);
    const end = new Date(endDate);

    const where = {
      organizationId: orgId,
      createdAt: { gte: start, lte: end },
      ...(rail ? { rail: rail as never } : {}),
    };

    const [total, completed, failed, pending, amountAgg] = await Promise.all([
      prisma.transaction.count({ where }),
      prisma.transaction.count({ where: { ...where, status: TransactionStatus.COMPLETED } }),
      prisma.transaction.count({ where: { ...where, status: TransactionStatus.FAILED } }),
      prisma.transaction.count({ where: { ...where, status: { in: [TransactionStatus.PROCESSING, TransactionStatus.PENDING_CHECKER, TransactionStatus.PENDING_DIRECTOR] } } }),
      prisma.transaction.aggregate({ where: { ...where, status: TransactionStatus.COMPLETED }, _sum: { amount: true } }),
    ]);

    const reconciliation = await prisma.reconciliation.create({
      data: {
        organizationId: orgId,
        rail: rail as never || 'MPESA_B2C' as never,
        periodStart: start,
        periodEnd: end,
        totalTransactions: total,
        totalAmount: amountAgg._sum.amount || 0,
        successCount: completed,
        failedCount: failed,
        pendingCount: pending,
        status: 'completed',
      },
    });

    res.json({ success: true, data: reconciliation });
  } catch (err) { next(err); }
});

export default router;

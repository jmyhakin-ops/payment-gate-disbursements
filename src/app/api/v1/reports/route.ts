import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAuthFromRequest } from '@/lib/auth';
import { AppError, handleApiError } from '@/lib/errors';
import { UserRole, TransactionStatus } from '@prisma/client';

// Helper: resolve period string → date range
function resolveDateRange(searchParams: URLSearchParams): { start: Date; end: Date } {
  const period = searchParams.get('period');
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');
  const now = new Date();
  let start: Date;
  let end: Date = now;
  if (period) {
    const map: Record<string, number> = { '1d': 1, '7d': 7, '30d': 30, '90d': 90, '6m': 180, '1y': 365 };
    const days = map[period] ?? 30;
    start = new Date(now.getTime() - days * 86400_000);
  } else if (dateFrom) {
    start = new Date(dateFrom);
    if (dateTo) end = new Date(dateTo);
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return { start, end };
}

export async function GET(request: NextRequest) {
  try {
    const decoded = getAuthFromRequest(request);
    const orgId = decoded.organizationId;
    const isSuperAdmin = decoded.role === UserRole.SUPER_ADMIN;
    if (!orgId && !isSuperAdmin) throw new AppError('No organization', 403, 'NO_ORG');
    // Super Admin with no org sees platform-wide data; otherwise org-scoped
    const effectiveOrgId = orgId ?? undefined;
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'reconciliation') {
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '20');
      const reconWhere = effectiveOrgId ? { organizationId: effectiveOrgId } : {};
      const [data, total] = await Promise.all([
        prisma.reconciliation.findMany({ where: reconWhere, skip: (page - 1) * limit, take: limit, orderBy: { runAt: 'desc' } }),
        prisma.reconciliation.count({ where: reconWhere }),
      ]);
      return Response.json({ success: true, data, meta: { total, page, limit } });
    }

    const { start, end } = resolveDateRange(searchParams);

    const txWhere: any = { createdAt: { gte: start, lte: end }, ...(effectiveOrgId ? { organizationId: effectiveOrgId } : {}) };

    const [byRail, byStatus, topRecipients, totalAgg, completedAgg, failedAgg, dailyRaw] = await Promise.all([
      prisma.transaction.groupBy({ by: ['rail'], where: txWhere, _count: { _all: true }, _sum: { amount: true } }),
      prisma.transaction.groupBy({ by: ['status'], where: txWhere, _count: { _all: true }, _sum: { amount: true } }),
      prisma.transaction.groupBy({
        by: ['recipientName'],
        where: { ...txWhere, status: TransactionStatus.COMPLETED },
        _count: { _all: true }, _sum: { amount: true },
        orderBy: { _sum: { amount: 'desc' } }, take: 10,
      }),
      prisma.transaction.aggregate({ where: txWhere, _sum: { amount: true }, _count: { _all: true } }),
      prisma.transaction.aggregate({ where: { ...txWhere, status: TransactionStatus.COMPLETED }, _sum: { amount: true }, _count: { _all: true } }),
      prisma.transaction.aggregate({ where: { ...txWhere, status: TransactionStatus.FAILED }, _sum: { amount: true }, _count: { _all: true } }),
      // Daily volume - raw query for best performance
      effectiveOrgId
        ? prisma.$queryRawUnsafe<{ date: string; volume: number; count: number }[]>(
            `SELECT TO_CHAR("createdAt"::date, 'Mon DD') as date, SUM(amount) as volume, COUNT(*) as count
             FROM transactions
             WHERE "organizationId" = $1 AND "createdAt" >= $2 AND "createdAt" <= $3
             GROUP BY "createdAt"::date ORDER BY "createdAt"::date`,
            effectiveOrgId, start, end
          )
        : prisma.$queryRawUnsafe<{ date: string; volume: number; count: number }[]>(
            `SELECT TO_CHAR("createdAt"::date, 'Mon DD') as date, SUM(amount) as volume, COUNT(*) as count
             FROM transactions
             WHERE "createdAt" >= $1 AND "createdAt" <= $2
             GROUP BY "createdAt"::date ORDER BY "createdAt"::date`,
            start, end
          ),
    ]);

    const successful = completedAgg._count._all;
    const failed = failedAgg._count._all;
    const totalTransactions = totalAgg._count._all;
    const totalVolume = totalAgg._sum.amount ?? 0;
    const completedVolume = completedAgg._sum.amount ?? 0;
    const failedVolume = failedAgg._sum.amount ?? 0;
    const pending = byStatus.filter(s => ['PENDING_CHECKER', 'PENDING_DIRECTOR', 'PROCESSING'].includes(s.status)).reduce((acc, s) => acc + s._count._all, 0);
    const cancelled = byStatus.find(s => s.status === 'CANCELLED')?._count._all ?? 0;

    return Response.json({
      success: true,
      data: {
        totalTransactions,
        totalVolume,
        completedVolume,
        failedVolume,
        successful,
        failed,
        pending,
        cancelled,
        successRate: totalTransactions > 0 ? successful / totalTransactions : 0,
        avgAmount: totalTransactions > 0 ? totalVolume / totalTransactions : 0,
        byRail: byRail.map(r => ({ rail: r.rail, count: r._count._all, volume: r._sum.amount ?? 0 })),
        byStatus: byStatus.map(s => ({ status: s.status, count: s._count._all, volume: s._sum.amount ?? 0 })),
        topRecipients: topRecipients.map(r => ({
          name: r.recipientName,
          identifier: r.recipientName,
          count: r._count._all,
          volume: r._sum.amount ?? 0,
        })),
        dailyVolume: dailyRaw.map(d => ({ date: d.date, volume: Number(d.volume), count: Number(d.count) })),
        period: { start, end },
      },
    });
  } catch (err) { return handleApiError(err); }
}

export async function POST(request: NextRequest) {
  try {
    const decoded = getAuthFromRequest(request);
    if (![UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.FINANCE_MANAGER].includes(decoded.role)) throw new AppError('Access denied', 403, 'FORBIDDEN');
    const orgId = decoded.organizationId;
    const isSuperAdmin = decoded.role === UserRole.SUPER_ADMIN;
    if (!orgId && !isSuperAdmin) throw new AppError('No organization', 403, 'NO_ORG');
    const body = await request.json();
    const { rail, startDate, endDate, organizationId: bodyOrgId } = z.object({ rail: z.string().optional(), startDate: z.string(), endDate: z.string(), organizationId: z.string().uuid().optional() }).parse(body);
    const targetOrgId = bodyOrgId ?? orgId;
    if (!targetOrgId) throw new AppError('organizationId required', 400, 'MISSING_ORG');
    const start = new Date(startDate); const end = new Date(endDate);
    const where: any = { organizationId: targetOrgId, createdAt: { gte: start, lte: end }, ...(rail ? { rail } : {}) };
    const [total, completed, failed, pending, amountAgg] = await Promise.all([
      prisma.transaction.count({ where }),
      prisma.transaction.count({ where: { ...where, status: TransactionStatus.COMPLETED } }),
      prisma.transaction.count({ where: { ...where, status: TransactionStatus.FAILED } }),
      prisma.transaction.count({ where: { ...where, status: { in: [TransactionStatus.PROCESSING, TransactionStatus.PENDING_CHECKER, TransactionStatus.PENDING_DIRECTOR] } } }),
      prisma.transaction.aggregate({ where: { ...where, status: TransactionStatus.COMPLETED }, _sum: { amount: true } }),
    ]);
    const reconciliation = await prisma.reconciliation.create({ data: { organizationId: targetOrgId, rail: (rail || 'ALL') as any, periodStart: start, periodEnd: end, totalTransactions: total, totalAmount: amountAgg._sum.amount || 0, successCount: completed, failedCount: failed, pendingCount: pending, status: 'completed' } });
    return Response.json({ success: true, data: reconciliation });
  } catch (err) { return handleApiError(err); }
}

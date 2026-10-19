import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAuthFromRequest } from '@/lib/auth';
import { AppError, handleApiError } from '@/lib/errors';
import { UserRole, TransactionStatus } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const decoded = getAuthFromRequest(request);
    const orgId = decoded.organizationId;
    if (!orgId) throw new AppError('No organization', 403, 'NO_ORG');
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'reconciliation') {
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '20');
      const [data, total] = await Promise.all([
        prisma.reconciliation.findMany({ where: { organizationId: orgId }, skip: (page - 1) * limit, take: limit, orderBy: { runAt: 'desc' } }),
        prisma.reconciliation.count({ where: { organizationId: orgId } }),
      ]);
      return Response.json({ success: true, data, meta: { total, page, limit } });
    }

    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = endDate ? new Date(endDate) : new Date();

    const [byRail, byStatus, topRecipients] = await Promise.all([
      prisma.transaction.groupBy({ by: ['rail'], where: { organizationId: orgId, createdAt: { gte: start, lte: end } }, _count: { _all: true }, _sum: { amount: true } }),
      prisma.transaction.groupBy({ by: ['status'], where: { organizationId: orgId, createdAt: { gte: start, lte: end } }, _count: { _all: true } }),
      prisma.transaction.groupBy({ by: ['recipientName'], where: { organizationId: orgId, status: TransactionStatus.COMPLETED, createdAt: { gte: start, lte: end } }, _count: { _all: true }, _sum: { amount: true }, orderBy: { _sum: { amount: 'desc' } }, take: 10 }),
    ]);
    return Response.json({ success: true, data: { byRail, byStatus, topRecipients, period: { start, end } } });
  } catch (err) { return handleApiError(err); }
}

export async function POST(request: NextRequest) {
  try {
    const decoded = getAuthFromRequest(request);
    if (![UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.FINANCE_MANAGER].includes(decoded.role)) throw new AppError('Access denied', 403, 'FORBIDDEN');
    const orgId = decoded.organizationId;
    if (!orgId) throw new AppError('No organization', 403, 'NO_ORG');
    const { rail, startDate, endDate } = z.object({ rail: z.string().optional(), startDate: z.string(), endDate: z.string() }).parse(await request.json());
    const start = new Date(startDate); const end = new Date(endDate);
    const where: any = { organizationId: orgId, createdAt: { gte: start, lte: end }, ...(rail ? { rail } : {}) };
    const [total, completed, failed, pending, amountAgg] = await Promise.all([
      prisma.transaction.count({ where }),
      prisma.transaction.count({ where: { ...where, status: TransactionStatus.COMPLETED } }),
      prisma.transaction.count({ where: { ...where, status: TransactionStatus.FAILED } }),
      prisma.transaction.count({ where: { ...where, status: { in: [TransactionStatus.PROCESSING, TransactionStatus.PENDING_CHECKER, TransactionStatus.PENDING_DIRECTOR] } } }),
      prisma.transaction.aggregate({ where: { ...where, status: TransactionStatus.COMPLETED }, _sum: { amount: true } }),
    ]);
    const reconciliation = await prisma.reconciliation.create({ data: { organizationId: orgId, rail: (rail || 'ALL') as any, periodStart: start, periodEnd: end, totalTransactions: total, totalAmount: amountAgg._sum.amount || 0, successCount: completed, failedCount: failed, pendingCount: pending, status: 'completed' } });
    return Response.json({ success: true, data: reconciliation });
  } catch (err) { return handleApiError(err); }
}

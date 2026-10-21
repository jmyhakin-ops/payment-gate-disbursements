import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthFromRequest } from '@/lib/auth';
import { AppError, handleApiError } from '@/lib/errors';
import { TransactionStatus, UserRole } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const decoded = getAuthFromRequest(request);
    const isSuperAdmin = decoded.role === UserRole.SUPER_ADMIN;
    const orgId = decoded.organizationId;
    if (!orgId && !isSuperAdmin) throw new AppError('No organization', 403, 'NO_ORG');

    const effectiveOrgId = isSuperAdmin && !orgId ? undefined : orgId!;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const dashWhere = (extra: any = {}) => ({ ...(effectiveOrgId ? { organizationId: effectiveOrgId } : {}), ...extra });

    const [totalTx, completedTx, pendingTx, failedTx, amountAgg, wallets] = await Promise.all([
      prisma.transaction.count({ where: dashWhere({ createdAt: { gte: startOfMonth } }) }),
      prisma.transaction.count({ where: dashWhere({ status: TransactionStatus.COMPLETED, createdAt: { gte: startOfMonth } }) }),
      prisma.transaction.count({ where: dashWhere({ status: { in: [TransactionStatus.PENDING_CHECKER, TransactionStatus.PENDING_DIRECTOR, TransactionStatus.PROCESSING] } }) }),
      prisma.transaction.count({ where: dashWhere({ status: TransactionStatus.FAILED, createdAt: { gte: startOfMonth } }) }),
      prisma.transaction.aggregate({ where: dashWhere({ status: TransactionStatus.COMPLETED, createdAt: { gte: startOfMonth } }), _sum: { amount: true } }),
      prisma.wallet.findMany({ where: effectiveOrgId ? { organizationId: effectiveOrgId } : {} }),
    ]);

    const totalBalance = wallets.reduce((s, w) => s + Number(w.balance), 0);
    return Response.json({
      success: true,
      data: {
        totalTransactions: totalTx,
        completedTransactions: completedTx,
        pendingApprovals: pendingTx,
        failedTransactions: failedTx,
        totalAmountProcessed: amountAgg._sum.amount || 0,
        totalBalance,
        wallets,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

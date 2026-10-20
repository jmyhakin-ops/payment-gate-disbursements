import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAuthFromRequest } from '@/lib/auth';
import { AppError, handleApiError } from '@/lib/errors';
import { TransactionStatus } from '@prisma/client';

// POST /api/v1/payments/[id]/cancel
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const decoded = getAuthFromRequest(request);
    const orgId = decoded.organizationId;
    if (!orgId) throw new AppError('No organization linked', 403, 'NO_ORG');

    const body = await request.json();
    const { reason } = z.object({ reason: z.string().min(5, 'Cancellation reason required (min 5 chars)') }).parse(body);

    const tx = await prisma.transaction.findFirst({ where: { id: params.id, organizationId: orgId } });
    if (!tx) throw new AppError('Transaction not found', 404, 'NOT_FOUND');

    const cancellableStatuses = [TransactionStatus.DRAFT, TransactionStatus.PENDING_CHECKER, TransactionStatus.PENDING_DIRECTOR];
    if (!cancellableStatuses.includes(tx.status)) {
      throw new AppError(`Cannot cancel a transaction with status: ${tx.status}`, 400, 'INVALID_STATUS');
    }

    await prisma.transaction.update({
      where: { id: params.id },
      data: { status: TransactionStatus.CANCELLED, failureReason: reason },
    });
    // Release reserved balance
    await prisma.wallet.update({
      where: { id: tx.walletId },
      data: { reservedBalance: { decrement: tx.netAmount }, balance: { increment: tx.netAmount } },
    });

    return Response.json({ success: true, message: 'Transaction cancelled and balance released' });
  } catch (err) { return handleApiError(err); }
}

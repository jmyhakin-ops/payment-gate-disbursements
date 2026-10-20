import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAuthFromRequest } from '@/lib/auth';
import { AppError, handleApiError } from '@/lib/errors';
import { ApprovalAction, TransactionStatus, UserRole } from '@prisma/client';

// POST /api/v1/payments/[id]/director-action
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const decoded = getAuthFromRequest(request);
    const orgId = decoded.organizationId;
    if (!orgId) throw new AppError('No organization linked', 403, 'NO_ORG');
    if (![UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.DIRECTOR].includes(decoded.role)) {
      throw new AppError('Access denied — director role required', 403, 'FORBIDDEN');
    }

    const body = await request.json();
    const { action: approvalAction, note, approvedAmount } = z.object({
      action: z.nativeEnum(ApprovalAction),
      note: z.string().max(1000).optional(),
      approvedAmount: z.number().positive().optional(),
    }).parse(body);

    const tx = await prisma.transaction.findFirst({
      where: { id: params.id, organizationId: orgId, status: TransactionStatus.PENDING_DIRECTOR },
    });
    if (!tx) throw new AppError('Transaction not found or not pending director approval', 404, 'NOT_FOUND');

    if (approvalAction === ApprovalAction.APPROVED) {
      const finalAmount = approvedAmount && approvedAmount > 0 && approvedAmount <= Number(tx.amount)
        ? approvedAmount : Number(tx.amount);

      const workflow = await prisma.approvalWorkflow.findUnique({ where: { transactionId: params.id } });
      if (workflow) {
        await prisma.directorApproval.create({
          data: { workflowId: workflow.id, directorId: decoded.userId, action: approvalAction, note },
        });
      }
      if (finalAmount < Number(tx.amount)) {
        const diff = Number(tx.amount) - finalAmount;
        await prisma.$transaction([
          prisma.transaction.update({ where: { id: params.id }, data: { amount: finalAmount, netAmount: finalAmount, status: TransactionStatus.PROCESSING } }),
          prisma.wallet.update({ where: { id: tx.walletId }, data: { reservedBalance: { decrement: diff }, balance: { increment: diff } } }),
        ]);
      } else {
        await prisma.transaction.update({ where: { id: params.id }, data: { status: TransactionStatus.PROCESSING } });
      }
      return Response.json({ success: true, message: 'Director approval recorded — payment queued for processing' });
    } else {
      await prisma.transaction.update({ where: { id: params.id }, data: { status: TransactionStatus.REJECTED, failureReason: note } });
      await prisma.wallet.update({ where: { id: tx.walletId }, data: { reservedBalance: { decrement: tx.netAmount }, balance: { increment: tx.netAmount } } });
      return Response.json({ success: true, message: 'Transaction rejected by director' });
    }
  } catch (err) { return handleApiError(err); }
}

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAuthFromRequest } from '@/lib/auth';
import { AppError, handleApiError } from '@/lib/errors';
import { ApprovalAction, TransactionStatus, UserRole } from '@prisma/client';
import { notifyMakerOfDecision } from '@/lib/notifications';

// POST /api/v1/payments/[id]/director-action
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const decoded = getAuthFromRequest(request);
    const orgId = decoded.organizationId;
    const isSuperAdmin = decoded.role === UserRole.SUPER_ADMIN;
    if (!orgId && !isSuperAdmin) throw new AppError('No organization linked', 403, 'NO_ORG');
    if (![UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.DIRECTOR].includes(decoded.role)) {
      throw new AppError('Access denied — director role required', 403, 'FORBIDDEN');
    }

    const body = await request.json();
    const { action: approvalAction, note, approvedAmount } = z.object({
      action: z.nativeEnum(ApprovalAction),
      note: z.string().max(1000).optional(),
      approvedAmount: z.number().positive().optional(),
    }).parse(body);

    const where = isSuperAdmin
      ? { id: params.id, status: TransactionStatus.PENDING_DIRECTOR }
      : { id: params.id, organizationId: orgId!, status: TransactionStatus.PENDING_DIRECTOR };

    // Include wallet to ensure walletId exists
    const tx = await prisma.transaction.findFirst({ where, include: { wallet: true } });
    if (!tx) throw new AppError('Transaction not found or not pending director approval', 404, 'NOT_FOUND');

    if (approvalAction === ApprovalAction.APPROVED) {
      const finalAmount = approvedAmount && approvedAmount > 0 && approvedAmount <= Number(tx.amount)
        ? approvedAmount : Number(tx.amount);

      // Record director approval in workflow if one exists
      const workflow = await prisma.approvalWorkflow.findUnique({ where: { transactionId: params.id } });
      if (workflow) {
        await prisma.directorApproval.create({
          data: {
            transactionId: params.id,
            approvalWorkflowId: workflow.id,
            directorId: decoded.userId,
            action: approvalAction,
            note,
          },
        });
      }

      if (finalAmount < Number(tx.amount) && tx.walletId) {
        // Partial approval — release the difference back to wallet
        const diff = Number(tx.amount) - finalAmount;
        await prisma.$transaction([
          prisma.transaction.update({
            where: { id: params.id },
            data: { amount: finalAmount, netAmount: finalAmount, status: TransactionStatus.PROCESSING },
          }),
          prisma.wallet.update({
            where: { id: tx.walletId },
            data: { reservedBalance: { decrement: diff }, balance: { increment: diff } },
          }),
        ]);
      } else {
        // Full amount — just move to PROCESSING
        await prisma.transaction.update({
          where: { id: params.id },
          data: { status: TransactionStatus.PROCESSING },
        });
      }
      // Notify maker their payment was approved by director
      if (tx.makerId) {
        const maker = await prisma.user.findUnique({ where: { id: tx.makerId }, select: { email: true } });
        if (maker) {
          notifyMakerOfDecision({
            transactionId: params.id,
            organizationId: tx.organizationId,
            makerId: tx.makerId,
            makerEmail: maker.email,
            decision: 'approved',
            message: `Your payment of KES ${finalAmount.toLocaleString()} to ${tx.recipientName ?? 'supplier'} has been approved by Director and is now processing.`,
            amount: finalAmount,
          });
        }
      }
      return Response.json({ success: true, message: 'Director approval recorded — payment queued for processing' });
    } else {
      // REJECTED — release full reserved balance back to wallet
      await prisma.transaction.update({
        where: { id: params.id },
        data: { status: TransactionStatus.REJECTED, failureReason: note },
      });
      if (tx.walletId) {
        await prisma.wallet.update({
          where: { id: tx.walletId },
          data: { reservedBalance: { decrement: tx.netAmount ?? tx.amount }, balance: { increment: tx.netAmount ?? tx.amount } },
        });
      }

      // Notify maker of rejection
      if (tx.makerId) {
        const maker = await prisma.user.findUnique({ where: { id: tx.makerId }, select: { email: true } });
        if (maker) {
          notifyMakerOfDecision({
            transactionId: params.id,
            organizationId: tx.organizationId,
            makerId: tx.makerId,
            makerEmail: maker.email,
            decision: 'rejected',
            message: `Your payment of KES ${Number(tx.amount).toLocaleString()} to ${tx.recipientName ?? 'supplier'} was rejected by Director. ${note ? 'Reason: ' + note : ''}`,
            amount: Number(tx.amount),
          });
        }
      }

      return Response.json({ success: true, message: 'Transaction rejected by director' });
    }
  } catch (err) { return handleApiError(err); }
}

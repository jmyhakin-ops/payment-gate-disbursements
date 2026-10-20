import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAuthFromRequest } from '@/lib/auth';
import { AppError, handleApiError } from '@/lib/errors';
import { ApprovalAction, TransactionStatus, UserRole } from '@prisma/client';

// POST /api/v1/payments/[id]/checker-action
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const decoded = getAuthFromRequest(request);
    const orgId = decoded.organizationId;
    const isSuperAdmin = decoded.role === UserRole.SUPER_ADMIN;
    if (!orgId && !isSuperAdmin) throw new AppError('No organization linked', 403, 'NO_ORG');
    if (![UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.CHECKER, UserRole.FINANCE_MANAGER].includes(decoded.role)) {
      throw new AppError('Access denied — checker role required', 403, 'FORBIDDEN');
    }

    const body = await request.json();
    const { action: approvalAction, note } = z.object({
      action: z.nativeEnum(ApprovalAction),
      note: z.string().max(500).optional(),
    }).parse(body);

    const where = isSuperAdmin ? { id: params.id } : { id: params.id, organizationId: orgId! };
    const tx = await prisma.transaction.findFirst({ where });
    if (!tx) throw new AppError('Transaction not found', 404, 'NOT_FOUND');
    if (tx.status !== TransactionStatus.PENDING_CHECKER) {
      throw new AppError('Transaction is not pending checker review', 400, 'INVALID_STATUS');
    }
    // Super Admin CAN approve their own transactions (they run the whole platform)
    if (tx.makerId === decoded.userId && !isSuperAdmin) {
      throw new AppError('Maker cannot approve their own transaction', 403, 'MAKER_CHECKER_VIOLATION');
    }

    const effectiveOrgId = orgId ?? tx.organizationId;
    const org = await prisma.organization.findUnique({ where: { id: effectiveOrgId } });

    if (approvalAction === ApprovalAction.APPROVED) {
      const newStatus = org?.requiresDirectorApproval ? TransactionStatus.PENDING_DIRECTOR : TransactionStatus.PROCESSING;
      await prisma.$transaction([
        prisma.transaction.update({ where: { id: params.id }, data: { status: newStatus } }),
        prisma.approvalWorkflow.upsert({
          where: { transactionId: params.id },
          create: { organizationId: effectiveOrgId, transactionId: params.id, checkerId: decoded.userId, checkerAction: approvalAction, checkerNote: note, checkerAt: new Date() },
          update: { checkerId: decoded.userId, checkerAction: approvalAction, checkerNote: note, checkerAt: new Date() },
        }),
      ]);
      return Response.json({ success: true, message: org?.requiresDirectorApproval ? 'Approved — sent to director' : 'Approved — queued for processing' });
    } else {
      // REJECTED or RETURNED
      const returnStatus = approvalAction === ApprovalAction.RETURNED ? TransactionStatus.DRAFT : TransactionStatus.REJECTED;
      await prisma.transaction.update({ where: { id: params.id }, data: { status: returnStatus, failureReason: note } });
      if (approvalAction === ApprovalAction.REJECTED) {
        // Release reserved balance
        await prisma.wallet.update({ where: { id: tx.walletId }, data: { reservedBalance: { decrement: tx.netAmount }, balance: { increment: tx.netAmount } } });
      }
      return Response.json({ success: true, message: `Transaction ${approvalAction.toLowerCase()}` });
    }
  } catch (err) { return handleApiError(err); }
}

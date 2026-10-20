import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAuthFromRequest } from '@/lib/auth';
import { AppError, handleApiError } from '@/lib/errors';
import { UserRole, TransactionStatus, PaymentRail, ApprovalAction } from '@prisma/client';

function requireOrg(orgId: string | null) {
  if (!orgId) throw new AppError('No organization', 403, 'NO_ORG');
  return orgId;
}

export async function GET(request: NextRequest) {
  try {
    const decoded = getAuthFromRequest(request);
    const orgId = decoded.organizationId;
    if (!orgId && decoded.role !== UserRole.SUPER_ADMIN) throw new AppError('No organization linked', 403, 'NO_ORG');
    const effectiveOrgId = orgId!;
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const txId = searchParams.get('id');

    if (action === 'dashboard') {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const [totalTx, completedTx, pendingTx, failedTx, amountAgg, wallets] = await Promise.all([
        prisma.transaction.count({ where: { organizationId: effectiveOrgId, createdAt: { gte: startOfMonth } } }),
        prisma.transaction.count({ where: { organizationId: effectiveOrgId, status: TransactionStatus.COMPLETED, createdAt: { gte: startOfMonth } } }),
        prisma.transaction.count({ where: { organizationId: effectiveOrgId, status: { in: [TransactionStatus.PENDING_CHECKER, TransactionStatus.PENDING_DIRECTOR, TransactionStatus.PROCESSING] } } }),
        prisma.transaction.count({ where: { organizationId: effectiveOrgId, status: TransactionStatus.FAILED, createdAt: { gte: startOfMonth } } }),
        prisma.transaction.aggregate({ where: { organizationId: effectiveOrgId, status: TransactionStatus.COMPLETED, createdAt: { gte: startOfMonth } }, _sum: { amount: true } }),
        prisma.wallet.findMany({ where: { organizationId: effectiveOrgId } }),
      ]);
      const totalBalance = wallets.reduce((s, w) => s + Number(w.balance), 0);
      return Response.json({ success: true, data: { totalTransactions: totalTx, completedTransactions: completedTx, pendingApprovals: pendingTx, failedTransactions: failedTx, totalAmountProcessed: amountAgg._sum.amount || 0, totalBalance, wallets } });
    }

    if (action === 'pending-approvals') {
      const data = await prisma.transaction.findMany({ where: { organizationId: effectiveOrgId, status: TransactionStatus.PENDING_CHECKER }, include: { maker: { select: { id: true, firstName: true, lastName: true, email: true } }, wallet: { select: { id: true, name: true, type: true } } }, orderBy: { createdAt: 'desc' } });
      return Response.json({ success: true, data });
    }

    if (action === 'director-approvals') {
      const data = await prisma.transaction.findMany({ where: { organizationId: effectiveOrgId, status: TransactionStatus.PENDING_DIRECTOR }, include: { maker: { select: { id: true, firstName: true, lastName: true } }, approvalWorkflow: { include: { checker: { select: { id: true, firstName: true, lastName: true } } } } }, orderBy: { createdAt: 'desc' } });
      return Response.json({ success: true, data });
    }

    if (txId) {
      const tx = await prisma.transaction.findFirst({
        where: { id: txId, ...(decoded.role !== UserRole.SUPER_ADMIN ? { organizationId: effectiveOrgId } : {}) },
        include: { maker: { select: { id: true, firstName: true, lastName: true, email: true, role: true } }, wallet: { select: { id: true, name: true, type: true, currency: true } }, bankAccount: true, approvalWorkflow: { include: { checker: { select: { id: true, firstName: true, lastName: true } }, directorApprovals: { include: { director: { select: { id: true, firstName: true, lastName: true, email: true } } }, orderBy: { approvedAt: 'asc' } } } }, ledgerEntries: { orderBy: { createdAt: 'asc' } } },
      });
      if (!tx) throw new AppError('Transaction not found', 404, 'NOT_FOUND');
      return Response.json({ success: true, data: tx });
    }

    // List transactions — support period param from reports page
    const page  = parseInt(searchParams.get('page')  || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status    = searchParams.get('status');
    const rail      = searchParams.get('rail');
    const type      = searchParams.get('type');
    const search    = searchParams.get('search');
    const period    = searchParams.get('period');
    const dateFrom  = searchParams.get('dateFrom');
    const dateTo    = searchParams.get('dateTo');

    let dateFilter: { gte?: Date; lte?: Date } | undefined;
    if (period) {
      const map: Record<string, number> = { '1d': 1, '7d': 7, '30d': 30, '90d': 90, '6m': 180, '1y': 365 };
      const days = map[period];
      if (days) dateFilter = { gte: new Date(Date.now() - days * 86400_000) };
    } else if (dateFrom || dateTo) {
      dateFilter = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo   ? { lte: new Date(dateTo)   } : {}),
      };
    }

    const where: any = {
      organizationId: effectiveOrgId,
      ...(status ? { status: status as TransactionStatus } : {}),
      ...(rail   ? { rail:   rail   as PaymentRail      } : {}),
      ...(type   ? { type:   type   as any              } : {}),
      ...(dateFilter ? { createdAt: dateFilter } : {}),
      ...(search ? { OR: [
        { reference:     { contains: search, mode: 'insensitive' } },
        { recipientName: { contains: search, mode: 'insensitive' } },
        { recipientPhone:{ contains: search, mode: 'insensitive' } },
        { mpesaReceiptNumber: { contains: search, mode: 'insensitive' } },
      ]} : {}),
    };

    const [data, total] = await Promise.all([
      prisma.transaction.findMany({
        where, skip: (page - 1) * limit, take: limit,
        orderBy: { createdAt: 'desc' },
        include: { maker: { select: { id: true, firstName: true, lastName: true } }, wallet: { select: { id: true, name: true, type: true } } },
      }),
      prisma.transaction.count({ where }),
    ]);
    return Response.json({ success: true, data, meta: { total, page, limit, pages: Math.ceil(total / limit) } });
  } catch (err) { return handleApiError(err); }
}

export async function POST(request: NextRequest) {
  try {
    const decoded = getAuthFromRequest(request);
    const orgId = decoded.organizationId;
    if (!orgId && decoded.role !== UserRole.SUPER_ADMIN) throw new AppError('No organization linked', 403, 'NO_ORG');
    const effectiveOrgId = orgId!;
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const txId = searchParams.get('id') ?? searchParams.get('txId');

    if (action === 'checker-action' && txId) {
      const { action: approvalAction, note } = z.object({ action: z.nativeEnum(ApprovalAction), note: z.string().max(500).optional() }).parse(body);
      const tx = await prisma.transaction.findFirst({ where: { id: txId, organizationId: effectiveOrgId } });
      if (!tx) throw new AppError('Transaction not found', 404, 'NOT_FOUND');
      const org = await prisma.organization.findUnique({ where: { id: effectiveOrgId } });
      if (approvalAction === ApprovalAction.APPROVED) {
        const newStatus = org?.requiresDirectorApproval ? TransactionStatus.PENDING_DIRECTOR : TransactionStatus.PROCESSING;
        await prisma.$transaction([
          prisma.transaction.update({ where: { id: txId }, data: { status: newStatus } }),
          prisma.approvalWorkflow.upsert({
            where: { transactionId: txId },
            create: { organizationId: effectiveOrgId, transactionId: txId, checkerId: decoded.userId, checkerAction: approvalAction, checkerNote: note, checkerAt: new Date() },
            update: { checkerId: decoded.userId, checkerAction: approvalAction, checkerNote: note, checkerAt: new Date() },
          }),
        ]);
      } else {
        await prisma.transaction.update({ where: { id: txId }, data: { status: TransactionStatus.REJECTED, failureReason: note } });
        await prisma.wallet.update({ where: { id: tx.walletId }, data: { reservedBalance: { decrement: tx.netAmount }, balance: { increment: tx.netAmount } } });
      }
      return Response.json({ success: true, message: `Transaction ${approvalAction.toLowerCase()}` });
    }

    if (action === 'director-action' && txId) {
      const { action: approvalAction, note, approvedAmount } = z.object({
        action: z.nativeEnum(ApprovalAction),
        note: z.string().max(1000).optional(),
        approvedAmount: z.number().positive().optional(),
      }).parse(body);

      const tx = await prisma.transaction.findFirst({ where: { id: txId, organizationId: effectiveOrgId, status: TransactionStatus.PENDING_DIRECTOR } });
      if (!tx) throw new AppError('Transaction not found or not pending director approval', 404, 'NOT_FOUND');

      if (approvalAction === ApprovalAction.APPROVED) {
        const finalAmount = approvedAmount && approvedAmount > 0 && approvedAmount <= Number(tx.amount)
          ? approvedAmount : Number(tx.amount);
        const workflow = await prisma.approvalWorkflow.findUnique({ where: { transactionId: txId } });
        if (workflow) {
          await prisma.directorApproval.create({ data: { workflowId: workflow.id, directorId: decoded.userId, action: approvalAction, note } });
        }
        if (finalAmount < Number(tx.amount)) {
          const diff = Number(tx.amount) - finalAmount;
          await prisma.$transaction([
            prisma.transaction.update({ where: { id: txId }, data: { amount: finalAmount, netAmount: finalAmount, status: TransactionStatus.PROCESSING } }),
            prisma.wallet.update({ where: { id: tx.walletId }, data: { reservedBalance: { decrement: diff }, balance: { increment: diff } } }),
          ]);
        } else {
          await prisma.transaction.update({ where: { id: txId }, data: { status: TransactionStatus.PROCESSING } });
        }
      } else {
        await prisma.transaction.update({ where: { id: txId }, data: { status: TransactionStatus.REJECTED, failureReason: note } });
        await prisma.wallet.update({ where: { id: tx.walletId }, data: { reservedBalance: { decrement: tx.netAmount }, balance: { increment: tx.netAmount } } });
      }
      return Response.json({ success: true, message: `Director ${approvalAction.toLowerCase()} recorded` });
    }

    if (action === 'cancel' && txId) {
      const { reason } = z.object({ reason: z.string().min(5) }).parse(body);
      const tx = await prisma.transaction.findFirst({ where: { id: txId, organizationId: effectiveOrgId } });
      if (!tx) throw new AppError('Transaction not found', 404, 'NOT_FOUND');
      await prisma.transaction.update({ where: { id: txId }, data: { status: TransactionStatus.CANCELLED, failureReason: reason } });
      await prisma.wallet.update({ where: { id: tx.walletId }, data: { reservedBalance: { decrement: tx.netAmount }, balance: { increment: tx.netAmount } } });
      return Response.json({ success: true, message: 'Transaction cancelled' });
    }

    // ── Create new payment transaction ────────────────────────────────────────
    const schema = z.object({
      walletId:          z.string().uuid('Select a valid wallet'),
      rail:              z.nativeEnum(PaymentRail),
      amount:            z.number().positive('Amount must be positive'),
      description:       z.string().min(3, 'Description required').default('Payment'),
      recipientName:     z.string().min(2, 'Recipient name required'),
      recipientPhone:    z.string().optional(),
      recipientEmail:    z.string().email().optional().or(z.literal('')),
      recipientAccountNo: z.string().optional(),    // matches schema
      recipientBankCode: z.string().optional(),
      recipientBankName: z.string().optional(),     // matches schema
      recipientBranchCode: z.string().optional(),
      // Also accept legacy field names from old frontend versions
      recipientAccount:  z.string().optional(),     // alias → recipientAccountNo
      recipientBank:     z.string().optional(),     // alias → recipientBankName
    });

    const data = schema.parse(body);

    // Resolve field aliases
    const recipientAccountNo = data.recipientAccountNo ?? data.recipientAccount;
    const recipientBankName  = data.recipientBankName  ?? data.recipientBank;

    const wallet = await prisma.wallet.findFirst({ where: { id: data.walletId, organizationId: effectiveOrgId } });
    if (!wallet) throw new AppError('Wallet not found or does not belong to your organization', 404, 'NOT_FOUND');

    // Calculate charges per rail
    const chargeMap: Partial<Record<PaymentRail, number>> = {
      PESALINK:        data.amount <= 999 ? 35 : data.amount <= 9999 ? 55 : 75,
      RTGS:            450,
      EQUITY_JENGA:    100,
      KCB_OPEN_BANKING: 100,
    };
    const charges  = chargeMap[data.rail] ?? 0;
    const netAmount = data.amount - charges;

    const availableBalance = Number(wallet.balance) - Number(wallet.reservedBalance);
    if (availableBalance < data.amount) {
      throw new AppError(
        `Insufficient wallet balance. Available: KES ${availableBalance.toLocaleString()}, Required: KES ${data.amount.toLocaleString()}`,
        400, 'INSUFFICIENT_BALANCE'
      );
    }

    // Determine transaction type
    const isCreditRail = [PaymentRail.MPESA_B2C, PaymentRail.PESALINK, PaymentRail.RTGS, PaymentRail.EQUITY_JENGA, PaymentRail.KCB_OPEN_BANKING].includes(data.rail);
    const txType = isCreditRail ? 'DEBIT' : 'DEBIT';

    const org = await prisma.organization.findUnique({ where: { id: effectiveOrgId } });
    const ref = `KP${Date.now()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const initialStatus = org?.makerCheckerEnabled ? TransactionStatus.PENDING_CHECKER : TransactionStatus.PROCESSING;

    const [tx] = await prisma.$transaction([
      prisma.transaction.create({
        data: {
          organizationId:    effectiveOrgId,
          makerId:           decoded.userId,
          walletId:          data.walletId,
          rail:              data.rail,
          type:              'DEBIT',             // All outbound disbursements are DEBIT
          amount:            data.amount,
          charges,
          netAmount,
          currency:          'KES',
          recipientName:     data.recipientName,
          recipientPhone:    data.recipientPhone  || null,
          recipientEmail:    data.recipientEmail  || null,
          recipientAccountNo: recipientAccountNo  || null,
          recipientBankCode: data.recipientBankCode || null,
          recipientBankName,
          recipientBranchCode: data.recipientBranchCode || null,
          description:       data.description,
          reference:         ref,
          status:            initialStatus,
        },
      }),
      prisma.wallet.update({
        where: { id: data.walletId },
        data:  { reservedBalance: { increment: data.amount } },
      }),
    ]);

    return Response.json({
      success: true,
      data: tx,
      message: org?.makerCheckerEnabled
        ? 'Payment submitted for checker approval'
        : 'Payment submitted for processing',
    }, { status: 201 });
  } catch (err) { return handleApiError(err); }
}

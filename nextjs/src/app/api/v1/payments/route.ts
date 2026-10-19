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
    const orgId = requireOrg(decoded.organizationId);
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const txId = searchParams.get('id');

    if (action === 'dashboard') {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const [totalTx, completedTx, pendingTx, failedTx, amountAgg, wallets] = await Promise.all([
        prisma.transaction.count({ where: { organizationId: orgId, createdAt: { gte: startOfMonth } } }),
        prisma.transaction.count({ where: { organizationId: orgId, status: TransactionStatus.COMPLETED, createdAt: { gte: startOfMonth } } }),
        prisma.transaction.count({ where: { organizationId: orgId, status: { in: [TransactionStatus.PENDING_CHECKER, TransactionStatus.PENDING_DIRECTOR, TransactionStatus.PROCESSING] } } }),
        prisma.transaction.count({ where: { organizationId: orgId, status: TransactionStatus.FAILED, createdAt: { gte: startOfMonth } } }),
        prisma.transaction.aggregate({ where: { organizationId: orgId, status: TransactionStatus.COMPLETED, createdAt: { gte: startOfMonth } }, _sum: { amount: true } }),
        prisma.wallet.findMany({ where: { organizationId: orgId } }),
      ]);
      const totalBalance = wallets.reduce((s, w) => s + Number(w.balance), 0);
      return Response.json({ success: true, data: { totalTransactions: totalTx, completedTransactions: completedTx, pendingApprovals: pendingTx, failedTransactions: failedTx, totalAmountProcessed: amountAgg._sum.amount || 0, totalBalance, wallets } });
    }

    if (action === 'pending-approvals') {
      const data = await prisma.transaction.findMany({ where: { organizationId: orgId, status: TransactionStatus.PENDING_CHECKER }, include: { maker: { select: { id: true, firstName: true, lastName: true, email: true } }, wallet: { select: { id: true, name: true, type: true } } }, orderBy: { createdAt: 'desc' } });
      return Response.json({ success: true, data });
    }

    if (action === 'director-approvals') {
      const data = await prisma.transaction.findMany({ where: { organizationId: orgId, status: TransactionStatus.PENDING_DIRECTOR }, include: { maker: { select: { id: true, firstName: true, lastName: true } }, approvalWorkflow: { include: { checker: { select: { id: true, firstName: true, lastName: true } } } } }, orderBy: { createdAt: 'desc' } });
      return Response.json({ success: true, data });
    }

    if (txId) {
      const tx = await prisma.transaction.findFirst({
        where: { id: txId, ...(decoded.role !== UserRole.SUPER_ADMIN ? { organizationId: orgId } : {}) },
        include: { maker: { select: { id: true, firstName: true, lastName: true, email: true, role: true } }, wallet: { select: { id: true, name: true, type: true, currency: true } }, bankAccount: true, approvalWorkflow: { include: { checker: { select: { id: true, firstName: true, lastName: true } }, directorApprovals: { include: { director: { select: { id: true, firstName: true, lastName: true, email: true } } }, orderBy: { approvedAt: 'asc' } } } }, ledgerEntries: { orderBy: { createdAt: 'asc' } } },
      });
      if (!tx) throw new AppError('Transaction not found', 404, 'NOT_FOUND');
      return Response.json({ success: true, data: tx });
    }

    // List transactions
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const rail = searchParams.get('rail');
    const search = searchParams.get('search');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const where: any = {
      organizationId: orgId,
      ...(status ? { status: status as TransactionStatus } : {}),
      ...(rail ? { rail: rail as PaymentRail } : {}),
      ...(startDate || endDate ? { createdAt: { ...(startDate ? { gte: new Date(startDate) } : {}), ...(endDate ? { lte: new Date(endDate) } : {}) } } : {}),
      ...(search ? { OR: [{ reference: { contains: search, mode: 'insensitive' } }, { recipientName: { contains: search, mode: 'insensitive' } }, { recipientPhone: { contains: search, mode: 'insensitive' } }] } : {}),
    };
    const [data, total] = await Promise.all([
      prisma.transaction.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' }, include: { maker: { select: { id: true, firstName: true, lastName: true } }, wallet: { select: { id: true, name: true, type: true } } } }),
      prisma.transaction.count({ where }),
    ]);
    return Response.json({ success: true, data, meta: { total, page, limit, pages: Math.ceil(total / limit) } });
  } catch (err) { return handleApiError(err); }
}

export async function POST(request: NextRequest) {
  try {
    const decoded = getAuthFromRequest(request);
    const orgId = requireOrg(decoded.organizationId);
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const txId = searchParams.get('id');

    if (action === 'checker-action' && txId) {
      const { action: approvalAction, note } = z.object({ action: z.nativeEnum(ApprovalAction), note: z.string().max(500).optional() }).parse(body);
      const tx = await prisma.transaction.findFirst({ where: { id: txId, organizationId: orgId } });
      if (!tx) throw new AppError('Transaction not found', 404, 'NOT_FOUND');
      const org = await prisma.organization.findUnique({ where: { id: orgId } });
      if (approvalAction === ApprovalAction.APPROVED) {
        const newStatus = org?.requiresDirectorApproval ? TransactionStatus.PENDING_DIRECTOR : TransactionStatus.PROCESSING;
        await prisma.$transaction([
          prisma.transaction.update({ where: { id: txId }, data: { status: newStatus } }),
          prisma.approvalWorkflow.upsert({ where: { transactionId: txId }, create: { transactionId: txId, checkerId: decoded.userId, checkerAction: approvalAction, checkerNote: note, checkedAt: new Date() }, update: { checkerId: decoded.userId, checkerAction: approvalAction, checkerNote: note, checkedAt: new Date() } }),
        ]);
      } else {
        await prisma.transaction.update({ where: { id: txId }, data: { status: TransactionStatus.REJECTED } });
        const wallet = await prisma.wallet.findUnique({ where: { id: tx.walletId } });
        if (wallet) await prisma.wallet.update({ where: { id: tx.walletId }, data: { reservedBalance: { decrement: tx.netAmount }, balance: { increment: tx.netAmount } } });
      }
      return Response.json({ success: true, message: `Transaction ${approvalAction.toLowerCase()}` });
    }

    if (action === 'director-action' && txId) {
      const { action: approvalAction, note } = z.object({ action: z.nativeEnum(ApprovalAction), note: z.string().max(1000).optional() }).parse(body);
      const tx = await prisma.transaction.findFirst({ where: { id: txId, organizationId: orgId, status: TransactionStatus.PENDING_DIRECTOR } });
      if (!tx) throw new AppError('Transaction not found or not pending director approval', 404, 'NOT_FOUND');
      if (approvalAction === ApprovalAction.APPROVED) {
        const workflow = await prisma.approvalWorkflow.findUnique({ where: { transactionId: txId } });
        if (workflow) {
          await prisma.directorApproval.create({ data: { workflowId: workflow.id, directorId: decoded.userId, action: approvalAction, note } });
        }
        await prisma.transaction.update({ where: { id: txId }, data: { status: TransactionStatus.PROCESSING } });
      } else {
        await prisma.transaction.update({ where: { id: txId }, data: { status: TransactionStatus.REJECTED } });
        await prisma.wallet.update({ where: { id: tx.walletId }, data: { reservedBalance: { decrement: tx.netAmount }, balance: { increment: tx.netAmount } } });
      }
      return Response.json({ success: true, message: `Director ${approvalAction.toLowerCase()} recorded` });
    }

    if (action === 'cancel' && txId) {
      const { reason } = z.object({ reason: z.string().min(5) }).parse(body);
      const tx = await prisma.transaction.findFirst({ where: { id: txId, organizationId: orgId } });
      if (!tx) throw new AppError('Transaction not found', 404, 'NOT_FOUND');
      await prisma.transaction.update({ where: { id: txId }, data: { status: TransactionStatus.CANCELLED, failureReason: reason } });
      await prisma.wallet.update({ where: { id: tx.walletId }, data: { reservedBalance: { decrement: tx.netAmount }, balance: { increment: tx.netAmount } } });
      return Response.json({ success: true, message: 'Transaction cancelled' });
    }

    // Create new transaction
    const schema = z.object({ walletId: z.string().uuid(), rail: z.nativeEnum(PaymentRail), amount: z.number().positive(), recipientName: z.string().min(2), recipientPhone: z.string().optional(), recipientAccount: z.string().optional(), recipientBank: z.string().optional(), recipientBankCode: z.string().optional(), description: z.string().optional(), batchId: z.string().optional() });
    const data = schema.parse(body);
    const wallet = await prisma.wallet.findFirst({ where: { id: data.walletId, organizationId: orgId } });
    if (!wallet) throw new AppError('Wallet not found', 404, 'NOT_FOUND');
    const netAmount = data.amount;
    if (Number(wallet.balance) - Number(wallet.reservedBalance) < netAmount) throw new AppError('Insufficient wallet balance', 400, 'INSUFFICIENT_BALANCE');

    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    const ref = `KP${Date.now()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const initialStatus = org?.makerCheckerEnabled ? TransactionStatus.PENDING_CHECKER : TransactionStatus.PROCESSING;

    const [tx] = await prisma.$transaction([
      prisma.transaction.create({ data: { organizationId: orgId, makerId: decoded.userId, walletId: data.walletId, rail: data.rail, amount: data.amount, fees: 0, netAmount, currency: 'KES', recipientName: data.recipientName, recipientPhone: data.recipientPhone, recipientAccount: data.recipientAccount, recipientBank: data.recipientBank, recipientBankCode: data.recipientBankCode, description: data.description, reference: ref, status: initialStatus } }),
      prisma.wallet.update({ where: { id: data.walletId }, data: { reservedBalance: { increment: netAmount } } }),
    ]);
    return Response.json({ success: true, data: tx, message: org?.makerCheckerEnabled ? 'Transaction submitted for checker approval' : 'Transaction submitted for processing' }, { status: 201 });
  } catch (err) { return handleApiError(err); }
}

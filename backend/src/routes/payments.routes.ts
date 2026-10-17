import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth';
import { UserRole, PaymentRail, TransactionStatus, ApprovalAction } from '@prisma/client';
import {
  initiatePayment, checkerApprove, directorApprove,
  getTransactions, getPendingApprovals, getPendingDirectorApprovals,
  cancelTransaction, getDashboardSummary, markTransactionCompleted,
} from '../services/payment.service';
import { parseMpesaCallback } from '../services/mpesa.service';
import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';

const router = Router();

// ─── POST /payments — initiate a payment ─────────────────────────────────────
router.post('/', authenticate, authorize(UserRole.MAKER, UserRole.FINANCE_MANAGER, UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      walletId: z.string().uuid(),
      rail: z.nativeEnum(PaymentRail),
      amount: z.number().positive().min(1),
      description: z.string().min(5).max(500),
      narration: z.string().max(200).optional(),
      recipientName: z.string().min(2).max(100),
      recipientPhone: z.string().optional(),
      recipientEmail: z.string().email().optional(),
      recipientAccountNo: z.string().optional(),
      recipientBankCode: z.string().optional(),
      recipientBankName: z.string().optional(),
      recipientBranchCode: z.string().optional(),
      bankAccountId: z.string().uuid().optional(),
      scheduledAt: z.string().datetime().optional(),
      metadata: z.record(z.unknown()).optional(),
    });

    const data = schema.parse(req.body);
    const orgId = req.user!.organizationId;
    if (!orgId) throw new AppError('No organization', 403, 'NO_ORG');

    const tx = await initiatePayment({
      organizationId: orgId,
      makerId: req.user!.id,
      ...data,
      amount: data.amount,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
    });

    res.status(201).json({ success: true, message: 'Payment initiated successfully', data: tx });
  } catch (err) { next(err); }
});

// ─── GET /payments — list transactions ───────────────────────────────────────
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = '1', limit = '20', status, rail, startDate, endDate, search } = req.query as Record<string, string>;
    const orgId = req.user!.organizationId;
    if (!orgId) throw new AppError('No organization', 403, 'NO_ORG');

    const result = await getTransactions({
      organizationId: orgId,
      status: status as TransactionStatus | undefined,
      rail: rail as PaymentRail | undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      search,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });

    res.json({ success: true, ...result });
  } catch (err) { next(err); }
});

// ─── GET /payments/dashboard — dashboard summary ─────────────────────────────
router.get('/dashboard', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    if (!orgId) throw new AppError('No organization', 403, 'NO_ORG');
    const summary = await getDashboardSummary(orgId);
    res.json({ success: true, data: summary });
  } catch (err) { next(err); }
});

// ─── GET /payments/pending-approvals — checker queue ─────────────────────────
router.get('/pending-approvals', authenticate, authorize(UserRole.CHECKER, UserRole.FINANCE_MANAGER, UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    if (!orgId) throw new AppError('No organization', 403, 'NO_ORG');
    const data = await getPendingApprovals(orgId, req.user!.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// ─── GET /payments/director-approvals — director queue ───────────────────────
router.get('/director-approvals', authenticate, authorize(UserRole.DIRECTOR, UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    if (!orgId) throw new AppError('No organization', 403, 'NO_ORG');
    const data = await getPendingDirectorApprovals(orgId, req.user!.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// ─── GET /payments/:id — get single transaction ───────────────────────────────
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    const tx = await prisma.transaction.findFirst({
      where: { id: req.params.id, ...(orgId ? { organizationId: orgId } : {}) },
      include: {
        maker: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
        wallet: { select: { id: true, name: true, type: true, currency: true } },
        bankAccount: true,
        approvalWorkflow: {
          include: {
            checker: { select: { id: true, firstName: true, lastName: true } },
            directorApprovals: {
              include: { director: { select: { id: true, firstName: true, lastName: true, email: true } } },
              orderBy: { approvedAt: 'asc' },
            },
          },
        },
        ledgerEntries: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!tx) throw new AppError('Transaction not found', 404, 'NOT_FOUND');
    res.json({ success: true, data: tx });
  } catch (err) { next(err); }
});

// ─── POST /payments/:id/checker-action — checker approve/reject ───────────────
router.post('/:id/checker-action', authenticate, authorize(UserRole.CHECKER, UserRole.FINANCE_MANAGER, UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { action, note } = z.object({
      action: z.nativeEnum(ApprovalAction),
      note: z.string().max(500).optional(),
    }).parse(req.body);
    const orgId = req.user!.organizationId;
    if (!orgId) throw new AppError('No organization', 403, 'NO_ORG');

    const tx = await checkerApprove({ transactionId: req.params.id, checkerId: req.user!.id, organizationId: orgId, action, note });
    res.json({ success: true, message: `Transaction ${action.toLowerCase()}`, data: tx });
  } catch (err) { next(err); }
});

// ─── POST /payments/:id/director-action — director approve/reject ─────────────
router.post('/:id/director-action', authenticate, authorize(UserRole.DIRECTOR, UserRole.SUPER_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { action, note } = z.object({
      action: z.nativeEnum(ApprovalAction),
      note: z.string().max(1000).optional(),
    }).parse(req.body);
    const orgId = req.user!.organizationId;
    if (!orgId) throw new AppError('No organization', 403, 'NO_ORG');

    const tx = await directorApprove({
      transactionId: req.params.id,
      directorId: req.user!.id,
      organizationId: orgId,
      action,
      note,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    res.json({ success: true, message: `Director ${action.toLowerCase()} recorded`, data: tx });
  } catch (err) { next(err); }
});

// ─── POST /payments/:id/cancel ────────────────────────────────────────────────
router.post('/:id/cancel', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reason } = z.object({ reason: z.string().min(5) }).parse(req.body);
    const orgId = req.user!.organizationId;
    if (!orgId) throw new AppError('No organization', 403, 'NO_ORG');
    await cancelTransaction(req.params.id, req.user!.id, orgId, reason);
    res.json({ success: true, message: 'Transaction cancelled' });
  } catch (err) { next(err); }
});

// ─── POST /payments/webhooks/mpesa — M-Pesa callback ─────────────────────────
router.post('/webhooks/mpesa', async (req: Request, res: Response) => {
  try {
    const parsed = parseMpesaCallback(req.body);
    if (parsed.resultCode === 0 && parsed.conversationId) {
      const tx = await prisma.transaction.findFirst({
        where: { mpesaConversationId: parsed.conversationId, status: 'PROCESSING' },
      });
      if (tx) {
        await markTransactionCompleted(tx.id, parsed.receiptNumber || parsed.conversationId, tx.organizationId);
      }
    } else if (parsed.resultCode !== 0 && parsed.conversationId) {
      const tx = await prisma.transaction.findFirst({
        where: { mpesaConversationId: parsed.conversationId },
      });
      if (tx) {
        await prisma.transaction.update({
          where: { id: tx.id },
          data: { status: 'FAILED', failureReason: parsed.resultDesc },
        });
        const { releaseFunds } = await import('../services/wallet.service');
        await releaseFunds(tx.walletId, tx.netAmount);
      }
    }
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch {
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }
});

export default router;

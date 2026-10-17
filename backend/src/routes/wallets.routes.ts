import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth';
import { UserRole } from '@prisma/client';
import { getOrgWallets, getWalletBalance, createWallet, getLedgerEntries, getWalletSummary } from '../services/wallet.service';
import { AppError } from '../utils/AppError';
import { WalletType, TransactionType } from '@prisma/client';

const router = Router();
router.use(authenticate);

// ─── GET /wallets — list wallets for org ──────────────────────────────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    if (!orgId) throw new AppError('No organization', 403, 'NO_ORG');
    const wallets = await getOrgWallets(orgId);
    res.json({ success: true, data: wallets });
  } catch (err) { next(err); }
});

// ─── GET /wallets/summary ─────────────────────────────────────────────────────
router.get('/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    if (!orgId) throw new AppError('No organization', 403, 'NO_ORG');
    const summary = await getWalletSummary(orgId);
    res.json({ success: true, data: summary });
  } catch (err) { next(err); }
});

// ─── POST /wallets — create wallet ────────────────────────────────────────────
router.post('/', authorize(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    if (!orgId) throw new AppError('No organization', 403, 'NO_ORG');
    const schema = z.object({
      type: z.nativeEnum(WalletType),
      name: z.string().min(2).max(100),
      currency: z.string().length(3).default('KES'),
      accountNumber: z.string().optional(),
      bankName: z.string().optional(),
      bankCode: z.string().optional(),
      branchCode: z.string().optional(),
      isDefault: z.boolean().default(false),
    });
    const data = schema.parse(req.body);
    const wallet = await createWallet({ organizationId: orgId, ...data });
    res.status(201).json({ success: true, data: wallet });
  } catch (err) { next(err); }
});

// ─── GET /wallets/:id ─────────────────────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    if (!orgId) throw new AppError('No organization', 403, 'NO_ORG');
    const wallet = await getWalletBalance(req.params.id, orgId);
    res.json({ success: true, data: wallet });
  } catch (err) { next(err); }
});

// ─── GET /wallets/:id/ledger — get ledger entries ─────────────────────────────
router.get('/:id/ledger', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    if (!orgId) throw new AppError('No organization', 403, 'NO_ORG');
    const { page = '1', limit = '50', type, startDate, endDate } = req.query as Record<string, string>;
    const result = await getLedgerEntries({
      walletId: req.params.id,
      organizationId: orgId,
      type: type as TransactionType | undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
});

export default router;

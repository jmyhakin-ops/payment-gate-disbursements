import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAuthFromRequest } from '@/lib/auth';
import { AppError, handleApiError } from '@/lib/errors';
import { UserRole, WalletType, TransactionType } from '@prisma/client';

function requireOrg(orgId: string | null): string {
  if (!orgId) throw new AppError('No organization', 403, 'NO_ORG');
  return orgId;
}

export async function GET(request: NextRequest) {
  try {
    const decoded = getAuthFromRequest(request);
    const orgId = requireOrg(decoded.organizationId);
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const walletId = searchParams.get('walletId');

    if (action === 'summary') {
      const wallets = await prisma.wallet.findMany({ where: { organizationId: orgId } });
      const totalBalance = wallets.reduce((sum, w) => sum + Number(w.balance), 0);
      const totalReserved = wallets.reduce((sum, w) => sum + Number(w.reservedBalance), 0);
      return Response.json({ success: true, data: { wallets, totalBalance, totalReserved, availableBalance: totalBalance - totalReserved } });
    }

    if (walletId && action === 'ledger') {
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '50');
      const type = searchParams.get('type') as TransactionType | null;
      const startDate = searchParams.get('startDate');
      const endDate = searchParams.get('endDate');
      const wallet = await prisma.wallet.findFirst({ where: { id: walletId, organizationId: orgId } });
      if (!wallet) throw new AppError('Wallet not found', 404, 'NOT_FOUND');
      const where: any = { walletId, ...(type ? { type } : {}), ...(startDate || endDate ? { createdAt: { ...(startDate ? { gte: new Date(startDate) } : {}), ...(endDate ? { lte: new Date(endDate) } : {}) } } : {}) };
      const [data, total] = await Promise.all([
        prisma.walletLedger.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
        prisma.walletLedger.count({ where }),
      ]);
      return Response.json({ success: true, data, meta: { total, page, limit }, wallet });
    }

    if (walletId) {
      const wallet = await prisma.wallet.findFirst({ where: { id: walletId, organizationId: orgId } });
      if (!wallet) throw new AppError('Wallet not found', 404, 'NOT_FOUND');
      return Response.json({ success: true, data: wallet });
    }

    const wallets = await prisma.wallet.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: 'desc' } });
    return Response.json({ success: true, data: wallets });
  } catch (err) { return handleApiError(err); }
}

export async function POST(request: NextRequest) {
  try {
    const decoded = getAuthFromRequest(request);
    if (![UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN].includes(decoded.role)) throw new AppError('Access denied', 403, 'FORBIDDEN');
    const orgId = requireOrg(decoded.organizationId);
    const data = z.object({ type: z.nativeEnum(WalletType), name: z.string().min(2).max(100), currency: z.string().length(3).default('KES'), accountNumber: z.string().optional(), bankName: z.string().optional(), bankCode: z.string().optional(), isDefault: z.boolean().default(false) }).parse(await request.json());
    const wallet = await prisma.wallet.create({ data: { organizationId: orgId, balance: 0, reservedBalance: 0, ...data } });
    return Response.json({ success: true, data: wallet }, { status: 201 });
  } catch (err) { return handleApiError(err); }
}

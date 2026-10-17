import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { TransactionType, WalletType } from '@prisma/client';

// ─── Get Org Wallets ──────────────────────────────────────────────────────────
export async function getOrgWallets(organizationId: string) {
  return prisma.wallet.findMany({
    where: { organizationId, isActive: true },
    orderBy: { isDefault: 'desc' },
  });
}

// ─── Get Wallet Balance ───────────────────────────────────────────────────────
export async function getWalletBalance(walletId: string, organizationId: string) {
  const wallet = await prisma.wallet.findFirst({
    where: { id: walletId, organizationId },
  });
  if (!wallet) throw new AppError('Wallet not found', 404, 'WALLET_NOT_FOUND');
  return wallet;
}

// ─── Create Wallet ────────────────────────────────────────────────────────────
export async function createWallet(data: {
  organizationId: string;
  type: WalletType;
  name: string;
  currency?: string;
  accountNumber?: string;
  bankName?: string;
  bankCode?: string;
  branchCode?: string;
  isDefault?: boolean;
}) {
  if (data.isDefault) {
    await prisma.wallet.updateMany({
      where: { organizationId: data.organizationId },
      data: { isDefault: false },
    });
  }
  return prisma.wallet.create({ data });
}

// ─── Reserve Funds (lock for pending tx) ─────────────────────────────────────
export async function reserveFunds(walletId: string, amount: number): Promise<void> {
  const wallet = await prisma.wallet.findUnique({ where: { id: walletId } });
  if (!wallet) throw new AppError('Wallet not found', 404, 'WALLET_NOT_FOUND');

  const available = wallet.balance - wallet.reservedBalance;
  if (available < amount) {
    throw new AppError(
      `Insufficient funds. Available: KES ${available.toLocaleString()}, Required: KES ${amount.toLocaleString()}`,
      422,
      'INSUFFICIENT_FUNDS'
    );
  }

  await prisma.wallet.update({
    where: { id: walletId },
    data: { reservedBalance: { increment: amount } },
  });
}

// ─── Release Reserved Funds (on cancel/reject) ────────────────────────────────
export async function releaseFunds(walletId: string, amount: number): Promise<void> {
  await prisma.wallet.update({
    where: { id: walletId },
    data: { reservedBalance: { decrement: amount } },
  });
}

// ─── Debit Wallet (after payment succeeds) ────────────────────────────────────
export async function debitWallet(
  walletId: string,
  transactionId: string,
  amount: number,
  description: string,
  reference: string
): Promise<void> {
  const wallet = await prisma.wallet.findUnique({ where: { id: walletId } });
  if (!wallet) throw new AppError('Wallet not found', 404, 'WALLET_NOT_FOUND');

  const balanceBefore = wallet.balance;
  const balanceAfter = balanceBefore - amount;

  await prisma.$transaction([
    prisma.wallet.update({
      where: { id: walletId },
      data: {
        balance: { decrement: amount },
        reservedBalance: { decrement: amount },
      },
    }),
    prisma.ledgerEntry.create({
      data: {
        walletId,
        transactionId,
        type: TransactionType.DEBIT,
        amount,
        balanceBefore,
        balanceAfter,
        description,
        reference,
        currency: wallet.currency,
      },
    }),
  ]);
}

// ─── Credit Wallet ────────────────────────────────────────────────────────────
export async function creditWallet(
  walletId: string,
  transactionId: string,
  amount: number,
  description: string,
  reference: string
): Promise<void> {
  const wallet = await prisma.wallet.findUnique({ where: { id: walletId } });
  if (!wallet) throw new AppError('Wallet not found', 404, 'WALLET_NOT_FOUND');

  const balanceBefore = wallet.balance;
  const balanceAfter = balanceBefore + amount;

  await prisma.$transaction([
    prisma.wallet.update({
      where: { id: walletId },
      data: { balance: { increment: amount } },
    }),
    prisma.ledgerEntry.create({
      data: {
        walletId,
        transactionId,
        type: TransactionType.CREDIT,
        amount,
        balanceBefore,
        balanceAfter,
        description,
        reference,
        currency: wallet.currency,
      },
    }),
  ]);
}

// ─── Get Ledger Entries ───────────────────────────────────────────────────────
export async function getLedgerEntries(params: {
  walletId: string;
  organizationId: string;
  startDate?: Date;
  endDate?: Date;
  type?: TransactionType;
  page?: number;
  limit?: number;
}) {
  const { walletId, organizationId, startDate, endDate, type, page = 1, limit = 50 } = params;

  // Verify ownership
  const wallet = await prisma.wallet.findFirst({ where: { id: walletId, organizationId } });
  if (!wallet) throw new AppError('Wallet not found', 404, 'WALLET_NOT_FOUND');

  const skip = (page - 1) * limit;
  const where = {
    walletId,
    ...(type && { type }),
    ...(startDate || endDate ? { createdAt: { ...(startDate && { gte: startDate }), ...(endDate && { lte: endDate }) } } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.ledgerEntry.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        transaction: { select: { id: true, reference: true, rail: true, status: true, recipientName: true } },
      },
    }),
    prisma.ledgerEntry.count({ where }),
  ]);

  return { data, total, page, limit, pages: Math.ceil(total / limit), wallet };
}

// ─── Get Wallet Summary ───────────────────────────────────────────────────────
export async function getWalletSummary(organizationId: string) {
  const wallets = await prisma.wallet.findMany({
    where: { organizationId, isActive: true },
  });

  const totalBalance = wallets.reduce((sum, w) => sum + w.balance, 0);
  const totalReserved = wallets.reduce((sum, w) => sum + w.reservedBalance, 0);
  const totalAvailable = totalBalance - totalReserved;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [todayDebits, todayCredits, monthDebits, monthCredits] = await Promise.all([
    prisma.ledgerEntry.aggregate({
      where: { wallet: { organizationId }, type: TransactionType.DEBIT, createdAt: { gte: today } },
      _sum: { amount: true },
    }),
    prisma.ledgerEntry.aggregate({
      where: { wallet: { organizationId }, type: TransactionType.CREDIT, createdAt: { gte: today } },
      _sum: { amount: true },
    }),
    prisma.ledgerEntry.aggregate({
      where: { wallet: { organizationId }, type: TransactionType.DEBIT, createdAt: { gte: new Date(today.getFullYear(), today.getMonth(), 1) } },
      _sum: { amount: true },
    }),
    prisma.ledgerEntry.aggregate({
      where: { wallet: { organizationId }, type: TransactionType.CREDIT, createdAt: { gte: new Date(today.getFullYear(), today.getMonth(), 1) } },
      _sum: { amount: true },
    }),
  ]);

  return {
    wallets,
    summary: {
      totalBalance,
      totalReserved,
      totalAvailable,
      todayDebits: todayDebits._sum.amount || 0,
      todayCredits: todayCredits._sum.amount || 0,
      monthDebits: monthDebits._sum.amount || 0,
      monthCredits: monthCredits._sum.amount || 0,
    },
  };
}

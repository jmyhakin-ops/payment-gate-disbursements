import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthFromRequest } from '@/lib/auth';
import { AppError, handleApiError } from '@/lib/errors';
import { UserRole } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const decoded = getAuthFromRequest(request);
    const isSuperAdmin = decoded.role === UserRole.SUPER_ADMIN;
    const orgId = decoded.organizationId;
    if (!orgId && !isSuperAdmin) throw new AppError('No organization', 403, 'NO_ORG');

    const where = isSuperAdmin && !orgId ? {} : { organizationId: orgId! };
    const wallets = await prisma.wallet.findMany({ where });
    const totalBalance = wallets.reduce((sum, w) => sum + Number(w.balance), 0);
    const totalReserved = wallets.reduce((sum, w) => sum + Number(w.reservedBalance), 0);
    return Response.json({
      success: true,
      data: {
        wallets,
        totalBalance,
        totalReserved,
        availableBalance: totalBalance - totalReserved,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

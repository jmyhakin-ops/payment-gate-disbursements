import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthFromRequest } from '@/lib/auth';
import { AppError, handleApiError } from '@/lib/errors';
import { TransactionStatus } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const decoded = getAuthFromRequest(request);
    const orgId = decoded.organizationId;
    if (!orgId) throw new AppError('No organization linked', 403, 'NO_ORG');
    const data = await prisma.transaction.findMany({
      where: { organizationId: orgId, status: TransactionStatus.PENDING_CHECKER },
      include: { maker: { select: { id: true, firstName: true, lastName: true, email: true } }, wallet: { select: { id: true, name: true, type: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return Response.json({ success: true, data });
  } catch (err) { return handleApiError(err); }
}

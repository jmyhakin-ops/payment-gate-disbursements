import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthFromRequest } from '@/lib/auth';
import { AppError, handleApiError } from '@/lib/errors';
import { UserRole, TransactionStatus } from '@prisma/client';

// GET /api/v1/payments/[id]
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const decoded = getAuthFromRequest(request);
    const orgId = decoded.organizationId;
    if (!orgId && decoded.role !== UserRole.SUPER_ADMIN) throw new AppError('No organization linked', 403, 'NO_ORG');

    const tx = await prisma.transaction.findFirst({
      where: {
        id: params.id,
        ...(decoded.role !== UserRole.SUPER_ADMIN ? { organizationId: orgId! } : {}),
      },
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
    return Response.json({ success: true, data: tx });
  } catch (err) { return handleApiError(err); }
}

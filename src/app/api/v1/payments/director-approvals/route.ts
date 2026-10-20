import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthFromRequest } from '@/lib/auth';
import { AppError, handleApiError } from '@/lib/errors';
import { TransactionStatus, UserRole } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const decoded = getAuthFromRequest(request);
    const orgId = decoded.organizationId;
    const isSuperAdmin = decoded.role === UserRole.SUPER_ADMIN;
    if (!orgId && !isSuperAdmin) throw new AppError('No organization linked', 403, 'NO_ORG');

    // Super Admin sees ALL pending-director transactions across all orgs
    const where = isSuperAdmin && !orgId
      ? { status: TransactionStatus.PENDING_DIRECTOR }
      : { organizationId: orgId!, status: TransactionStatus.PENDING_DIRECTOR };

    const data = await prisma.transaction.findMany({
      where,
      include: {
        maker: { select: { id: true, firstName: true, lastName: true } },
        wallet: { select: { id: true, name: true, type: true } },
        approvalWorkflow: {
          include: {
            checker: { select: { id: true, firstName: true, lastName: true } },
            directorApprovals: {
              include: { director: { select: { id: true, firstName: true, lastName: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return Response.json({ success: true, data });
  } catch (err) { return handleApiError(err); }
}

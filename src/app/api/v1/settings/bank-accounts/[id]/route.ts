import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthFromRequest } from '@/lib/auth';
import { AppError, handleApiError } from '@/lib/errors';
import { UserRole } from '@prisma/client';

// DELETE /api/v1/settings/bank-accounts/[id]
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const decoded = getAuthFromRequest(request);
    if (![UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN].includes(decoded.role)) {
      throw new AppError('Access denied', 403, 'FORBIDDEN');
    }
    const orgId = decoded.organizationId;
    if (!orgId) throw new AppError('No organization linked', 403, 'NO_ORG');

    await prisma.bankAccount.updateMany({
      where: { id: params.id, organizationId: orgId },
      data: { isActive: false },
    });
    return Response.json({ success: true, message: 'Bank account removed' });
  } catch (err) { return handleApiError(err); }
}

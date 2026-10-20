import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthFromRequest } from '@/lib/auth';
import { AppError, handleApiError } from '@/lib/errors';
import { UserRole } from '@prisma/client';

// DELETE /api/v1/settings/bank-accounts/[id]
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const decoded = getAuthFromRequest(request);
    const orgId = decoded.organizationId;
    const isSuperAdmin = decoded.role === UserRole.SUPER_ADMIN;
    if (![UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN].includes(decoded.role)) {
      throw new AppError('Access denied', 403, 'FORBIDDEN');
    }
    if (!orgId && !isSuperAdmin) throw new AppError('No organization linked', 403, 'NO_ORG');

    const where = isSuperAdmin && !orgId ? { id: params.id } : { id: params.id, organizationId: orgId! };
    await prisma.bankAccount.updateMany({ where, data: { isActive: false } });
    return Response.json({ success: true, message: 'Bank account removed' });
  } catch (err) { return handleApiError(err); }
}

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthFromRequest } from '@/lib/auth';
import { AppError, handleApiError } from '@/lib/errors';
import { UserRole } from '@prisma/client';

// PUT /api/v1/settings/api-credentials/[id]/activate
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const decoded = getAuthFromRequest(request);
    if (![UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN].includes(decoded.role)) {
      throw new AppError('Access denied', 403, 'FORBIDDEN');
    }
    const orgId = decoded.organizationId;
    if (!orgId) throw new AppError('No organization linked', 403, 'NO_ORG');

    const cred = await prisma.apiCredential.findFirst({ where: { id: params.id, organizationId: orgId } });
    if (!cred) throw new AppError('Credential not found', 404, 'NOT_FOUND');

    const updated = await prisma.apiCredential.update({
      where: { id: params.id },
      data: { isActive: true, updatedAt: new Date() },
    });

    return Response.json({ success: true, message: 'Credential activated', data: { isActive: updated.isActive } });
  } catch (err) { return handleApiError(err); }
}

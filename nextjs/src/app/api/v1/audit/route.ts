import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthFromRequest } from '@/lib/auth';
import { AppError, handleApiError } from '@/lib/errors';
import { UserRole, AuditAction } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const decoded = getAuthFromRequest(request);
    if (![UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.FINANCE_MANAGER].includes(decoded.role)) throw new AppError('Access denied', 403, 'FORBIDDEN');
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const userId = searchParams.get('userId');
    const action = searchParams.get('action');
    const resource = searchParams.get('resource');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const isSuperAdmin = decoded.role === UserRole.SUPER_ADMIN;
    const orgId = isSuperAdmin ? undefined : decoded.organizationId || undefined;

    const where: any = {
      ...(orgId ? { organizationId: orgId } : {}),
      ...(userId ? { userId } : {}),
      ...(action ? { action: action as AuditAction } : {}),
      ...(resource ? { resource } : {}),
      ...(startDate || endDate ? { createdAt: { ...(startDate ? { gte: new Date(startDate) } : {}), ...(endDate ? { lte: new Date(endDate) } : {}) } } : {}),
    };

    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' }, include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } }),
      prisma.auditLog.count({ where }),
    ]);
    return Response.json({ success: true, data, meta: { total, page, limit, pages: Math.ceil(total / limit) } });
  } catch (err) { return handleApiError(err); }
}

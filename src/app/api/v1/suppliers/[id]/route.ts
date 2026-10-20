import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAuthFromRequest } from '@/lib/auth';
import { AppError, handleApiError } from '@/lib/errors';
import { SupplierStatus, UserRole } from '@prisma/client';

function requireOrg(orgId: string | null, role: UserRole): string {
  if (!orgId && role !== UserRole.SUPER_ADMIN) throw new AppError('No organization', 403, 'NO_ORG');
  return orgId!;
}

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  type: z.enum(['MPESA_B2C', 'MPESA_PAYBILL', 'MPESA_TILL', 'BANK', 'RTGS']).optional(),
  category: z.string().optional(),
  phone: z.string().optional(),
  paybillNumber: z.string().optional(),
  tillNumber: z.string().optional(),
  accountRef: z.string().optional(),
  bankCode: z.string().optional(),
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  accountName: z.string().optional(),
  branchName: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  kraPin: z.string().optional(),
  contactPerson: z.string().optional(),
  contactPhone: z.string().optional(),
  notes: z.string().optional(),
  status: z.nativeEnum(SupplierStatus).optional(),
});

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const decoded = getAuthFromRequest(request);
    const isSuperAdmin = decoded.role === UserRole.SUPER_ADMIN;
    const orgId = decoded.organizationId;
    if (!orgId && !isSuperAdmin) throw new AppError('No organization', 403, 'NO_ORG');

    // Super Admin can look up any supplier; others only see their org
    const where: any = isSuperAdmin ? { id: params.id } : { id: params.id, organizationId: orgId };
    const supplier = await prisma.supplier.findFirst({ where });
    if (!supplier) throw new AppError('Supplier not found', 404, 'NOT_FOUND');

    const txWhere: any = isSuperAdmin
      ? { OR: [{ recipientPhone: supplier.phone ?? undefined }, { recipientName: { contains: supplier.name, mode: 'insensitive' } }] }
      : { organizationId: orgId, OR: [{ recipientPhone: supplier.phone ?? undefined }, { recipientName: { contains: supplier.name, mode: 'insensitive' } }] };

    const recentTx = await prisma.transaction.findMany({
      where: txWhere,
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true, reference: true, amount: true, status: true, rail: true,
        createdAt: true, completedAt: true, description: true,
        maker: { select: { firstName: true, lastName: true } },
      },
    });

    return Response.json({ success: true, data: { ...supplier, recentTransactions: recentTx } });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const decoded = getAuthFromRequest(request);
    const isSuperAdmin = decoded.role === UserRole.SUPER_ADMIN;
    const orgId = decoded.organizationId;
    if (!orgId && !isSuperAdmin) throw new AppError('No organization', 403, 'NO_ORG');

    const where: any = isSuperAdmin ? { id: params.id } : { id: params.id, organizationId: orgId };
    const existing = await prisma.supplier.findFirst({ where });
    if (!existing) throw new AppError('Supplier not found', 404, 'NOT_FOUND');

    const body = await request.json();
    const data = updateSchema.parse(body);
    const clean: any = { ...data };
    for (const key of Object.keys(clean)) { if (clean[key] === '') clean[key] = null; }

    const updated = await prisma.supplier.update({ where: { id: params.id }, data: clean });
    return Response.json({ success: true, data: updated });
  } catch (err) { return handleApiError(err); }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const decoded = getAuthFromRequest(request);
    const isSuperAdmin = decoded.role === UserRole.SUPER_ADMIN;
    const orgId = decoded.organizationId;
    if (!orgId && !isSuperAdmin) throw new AppError('No organization', 403, 'NO_ORG');

    const where: any = isSuperAdmin ? { id: params.id } : { id: params.id, organizationId: orgId };
    const existing = await prisma.supplier.findFirst({ where });
    if (!existing) throw new AppError('Supplier not found', 404, 'NOT_FOUND');

    await prisma.supplier.delete({ where: { id: params.id } });
    return Response.json({ success: true, message: 'Supplier deleted' });
  } catch (err) { return handleApiError(err); }
}

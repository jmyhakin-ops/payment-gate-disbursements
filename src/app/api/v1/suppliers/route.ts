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

const createSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  type: z.enum(['MPESA_B2C', 'MPESA_PAYBILL', 'MPESA_TILL', 'BANK', 'RTGS']).default('MPESA_B2C'),
  category: z.string().optional(),
  // M-Pesa fields
  phone: z.string().optional(),
  paybillNumber: z.string().optional(),
  tillNumber: z.string().optional(),
  accountRef: z.string().optional(),
  // Bank fields
  bankCode: z.string().optional(),
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  accountName: z.string().optional(),
  branchName: z.string().optional(),
  // Contact & compliance
  email: z.string().email().optional().or(z.literal('')),
  kraPin: z.string().optional(),
  contactPerson: z.string().optional(),
  contactPhone: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const decoded = getAuthFromRequest(request);
    const isSuperAdmin = decoded.role === UserRole.SUPER_ADMIN;
    const orgId = decoded.organizationId;
    if (!orgId && !isSuperAdmin) throw new AppError('No organization', 403, 'NO_ORG');
    const { searchParams } = new URL(request.url);

    const search   = searchParams.get('search') ?? '';
    const type     = searchParams.get('type') ?? '';
    const status   = searchParams.get('status') ?? '';
    const dateFrom = searchParams.get('dateFrom');
    const dateTo   = searchParams.get('dateTo');
    const sortBy   = searchParams.get('sortBy') ?? 'totalPaid';
    const sortDir  = (searchParams.get('sortDir') ?? 'desc') as 'asc' | 'desc';
    const page     = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
    const limit    = Math.min(100, parseInt(searchParams.get('limit') ?? '20'));
    const skip     = (page - 1) * limit;

    // Super Admin sees ALL suppliers across all orgs; others see only their org
    const where: any = isSuperAdmin ? {} : { organizationId: orgId };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { paybillNumber: { contains: search } },
        { tillNumber: { contains: search } },
        { accountNumber: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
        { kraPin: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (type) where.type = type;
    if (status && Object.values(SupplierStatus).includes(status as SupplierStatus)) {
      where.status = status as SupplierStatus;
    }
    if (dateFrom || dateTo) {
      where.lastPaymentAt = {};
      if (dateFrom) where.lastPaymentAt.gte = new Date(dateFrom);
      if (dateTo) where.lastPaymentAt.lte = new Date(dateTo);
    }

    // Valid sort fields
    const validSortFields = ['name', 'totalPaid', 'transactionCount', 'lastPaymentAt', 'createdAt'];
    const orderByField = validSortFields.includes(sortBy) ? sortBy : 'totalPaid';

    const [suppliers, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        orderBy: { [orderByField]: sortDir },
        skip,
        take: limit,
      }),
      prisma.supplier.count({ where }),
    ]);

    // Stats — Super Admin sees platform-wide totals
    const statsWhere = isSuperAdmin ? {} : { organizationId: orgId };
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const [statsTotal, statsActive, statsThisMonth, totalPaidAgg] = await Promise.all([
      prisma.supplier.count({ where: statsWhere }),
      prisma.supplier.count({ where: { ...statsWhere, status: 'ACTIVE' } }),
      prisma.supplier.aggregate({
        where: { ...statsWhere, lastPaymentAt: { gte: startOfMonth } },
        _sum: { lastPaymentAmount: true },
      }),
      prisma.supplier.aggregate({
        where: statsWhere,
        _sum: { totalPaid: true },
      }),
    ]);

    return Response.json({
      success: true,
      data: suppliers,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        page,
        limit,
      },
      stats: {
        total: statsTotal,
        active: statsActive,
        totalPaid: Number(totalPaidAgg._sum.totalPaid ?? 0),
        thisMonth: Number(statsThisMonth._sum.lastPaymentAmount ?? 0),
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const decoded = getAuthFromRequest(request);
    const orgId = requireOrg(decoded.organizationId, decoded.role);
    const body = await request.json();
    const data = createSchema.parse(body);

    // Clean up empty strings
    const clean: any = { ...data };
    for (const key of Object.keys(clean)) {
      if (clean[key] === '') clean[key] = null;
    }

    const supplier = await prisma.supplier.create({
      data: {
        ...clean,
        organizationId: orgId,
      },
    });

    return Response.json({ success: true, data: supplier }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

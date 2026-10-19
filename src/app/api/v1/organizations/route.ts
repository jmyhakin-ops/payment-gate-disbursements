import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAuthFromRequest } from '@/lib/auth';
import { AppError, handleApiError } from '@/lib/errors';
import { UserRole, OrgStatus, PaymentRail } from '@prisma/client';
import crypto from 'crypto';

function requireRole(role: UserRole, ...allowed: UserRole[]) {
  if (!allowed.includes(role)) throw new AppError('Access denied', 403, 'FORBIDDEN');
}

export async function GET(request: NextRequest) {
  try {
    const decoded = getAuthFromRequest(request);
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'me') {
      if (!decoded.organizationId) throw new AppError('No organization', 404, 'NO_ORG');
      const org = await prisma.organization.findUnique({
        where: { id: decoded.organizationId },
        include: { directors: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } }, _count: { select: { users: true, transactions: true, wallets: true } } },
      });
      if (!org) throw new AppError('Organization not found', 404, 'NOT_FOUND');
      return Response.json({ success: true, data: org });
    }

    requireRole(decoded.role, UserRole.SUPER_ADMIN);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const where: any = {
      ...(status ? { status: status as OrgStatus } : {}),
      ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }] } : {}),
    };
    const [data, total] = await Promise.all([
      prisma.organization.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' }, include: { _count: { select: { users: true, transactions: true, wallets: true } } } }),
      prisma.organization.count({ where }),
    ]);
    return Response.json({ success: true, data, meta: { total, page, limit, pages: Math.ceil(total / limit) } });
  } catch (err) { return handleApiError(err); }
}

export async function POST(request: NextRequest) {
  try {
    const decoded = getAuthFromRequest(request);
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'activate') {
      requireRole(decoded.role, UserRole.ORG_ADMIN);
      const { activationCode } = z.object({ activationCode: z.string() }).parse(body);
      const orgId = decoded.organizationId;
      if (!orgId) throw new AppError('No organization', 403, 'NO_ORG');
      const org = await prisma.organization.findFirst({ where: { id: orgId, activationCode } });
      if (!org) throw new AppError('Invalid activation code', 400, 'INVALID_CODE');
      if (org.status === OrgStatus.ACTIVE) throw new AppError('Already active', 409, 'ALREADY_ACTIVE');
      await prisma.organization.update({ where: { id: orgId }, data: { status: OrgStatus.ACTIVE, activatedAt: new Date(), activatedByUserId: decoded.userId } });
      return Response.json({ success: true, message: 'Organization activated successfully' });
    }

    if (action === 'add-director') {
      requireRole(decoded.role, UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN);
      const orgId = decoded.organizationId;
      if (!orgId) throw new AppError('No organization', 403, 'NO_ORG');
      const data = z.object({ userId: z.string().uuid(), name: z.string().min(2), email: z.string().email(), phone: z.string(), nationalId: z.string() }).parse(body);
      const user = await prisma.user.findFirst({ where: { id: data.userId, organizationId: orgId } });
      if (!user) throw new AppError('User not found in this organization', 404, 'NOT_FOUND');
      const director = await prisma.organizationDirector.create({ data: { organizationId: orgId, ...data } });
      await prisma.user.update({ where: { id: data.userId }, data: { role: UserRole.DIRECTOR } });
      return Response.json({ success: true, data: director }, { status: 201 });
    }

    // Create org (super admin only)
    requireRole(decoded.role, UserRole.SUPER_ADMIN);
    const schema = z.object({ name: z.string().min(2), legalName: z.string().min(2), registrationNumber: z.string().min(4), kraPin: z.string().min(10), industry: z.string(), address: z.string(), city: z.string(), phone: z.string(), email: z.string().email(), website: z.string().url().optional(), requiresDirectorApproval: z.boolean().default(true), makerCheckerEnabled: z.boolean().default(true), minApprovalAmount: z.number().min(0).default(0), maxTransactionLimit: z.number().min(1).default(5000000), dailyTransactionLimit: z.number().min(1).default(10000000), monthlyTransactionLimit: z.number().min(1).default(100000000), allowedRails: z.array(z.nativeEnum(PaymentRail)).min(1), directorCount: z.number().min(1).max(10).default(2) });
    const data = schema.parse(body);
    const activationCode = crypto.randomBytes(8).toString('hex').toUpperCase();
    const org = await prisma.organization.create({ data: { ...data, activationCode, status: OrgStatus.PENDING_APPROVAL } });
    return Response.json({ success: true, data: org }, { status: 201 });
  } catch (err) { return handleApiError(err); }
}

export async function PUT(request: NextRequest) {
  try {
    const decoded = getAuthFromRequest(request);
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const orgId = searchParams.get('orgId');

    if (action === 'approve') {
      requireRole(decoded.role, UserRole.SUPER_ADMIN);
      const org = await prisma.organization.findUnique({ where: { id: orgId! } });
      if (!org) throw new AppError('Not found', 404, 'NOT_FOUND');
      const updated = await prisma.organization.update({ where: { id: orgId! }, data: { status: OrgStatus.ACTIVE, activatedAt: new Date(), activatedByUserId: decoded.userId } });
      return Response.json({ success: true, data: updated });
    }
    if (action === 'suspend') {
      requireRole(decoded.role, UserRole.SUPER_ADMIN);
      await prisma.organization.update({ where: { id: orgId! }, data: { status: OrgStatus.SUSPENDED } });
      return Response.json({ success: true, message: 'Organization suspended' });
    }

    // Update own org
    requireRole(decoded.role, UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN);
    const targetOrgId = decoded.role === UserRole.SUPER_ADMIN ? body.organizationId : decoded.organizationId;
    if (!targetOrgId) throw new AppError('No organization', 403, 'NO_ORG');
    const schema = z.object({ name: z.string().optional(), address: z.string().optional(), city: z.string().optional(), phone: z.string().optional(), website: z.string().url().optional().or(z.literal('')), logoUrl: z.string().optional(), industry: z.string().optional(), requiresDirectorApproval: z.boolean().optional(), makerCheckerEnabled: z.boolean().optional(), minApprovalAmount: z.number().min(0).optional(), maxTransactionLimit: z.number().min(1).optional(), directorCount: z.number().min(1).max(10).optional() });
    const data = schema.parse(body);
    const updated = await prisma.organization.update({ where: { id: targetOrgId }, data });
    return Response.json({ success: true, data: updated });
  } catch (err) { return handleApiError(err); }
}

export async function DELETE(request: NextRequest) {
  try {
    const decoded = getAuthFromRequest(request);
    requireRole(decoded.role, UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN);
    const { searchParams } = new URL(request.url);
    const directorId = searchParams.get('directorId')!;
    await prisma.organizationDirector.update({ where: { id: directorId }, data: { isActive: false } });
    return Response.json({ success: true, message: 'Director removed' });
  } catch (err) { return handleApiError(err); }
}

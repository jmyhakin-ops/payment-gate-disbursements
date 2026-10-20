import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAuthFromRequest } from '@/lib/auth';
import { AppError, handleApiError } from '@/lib/errors';
import { UserRole } from '@prisma/client';
import crypto from 'crypto';

// GET /api/v1/settings/bank-accounts
export async function GET(request: NextRequest) {
  try {
    const decoded = getAuthFromRequest(request);
    const orgId = decoded.organizationId;
    if (!orgId) throw new AppError('No organization linked', 403, 'NO_ORG');

    const accounts = await prisma.bankAccount.findMany({
      where: { organizationId: orgId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    return Response.json({ success: true, data: accounts });
  } catch (err) { return handleApiError(err); }
}

// POST /api/v1/settings/bank-accounts
export async function POST(request: NextRequest) {
  try {
    const decoded = getAuthFromRequest(request);
    const orgId = decoded.organizationId;
    if (!orgId) throw new AppError('No organization linked', 403, 'NO_ORG');
    if (![UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN].includes(decoded.role)) {
      throw new AppError('Access denied', 403, 'FORBIDDEN');
    }

    const body = await request.json();
    const data = z.object({
      accountName: z.string().min(2),
      accountNumber: z.string().min(6),
      bankName: z.string().min(2),
      bankCode: z.string().min(2),
      branchCode: z.string().optional(),
      swiftCode: z.string().optional(),
      pesaLinkEnabled: z.boolean().default(true),
      rtgsEnabled: z.boolean().default(false),
    }).parse(body);

    const account = await prisma.bankAccount.create({
      data: { id: crypto.randomUUID(), organizationId: orgId, updatedAt: new Date(), ...data },
    });
    return Response.json({ success: true, data: account }, { status: 201 });
  } catch (err) { return handleApiError(err); }
}

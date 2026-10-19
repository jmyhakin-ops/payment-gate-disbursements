import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAuthFromRequest } from '@/lib/auth';
import { AppError, handleApiError } from '@/lib/errors';
import { UserRole, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

function requireRole(role: UserRole, ...allowed: UserRole[]) {
  if (!allowed.includes(role)) throw new AppError('Access denied', 403, 'FORBIDDEN');
}

// ─── GET /api/v1/users ────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const decoded = getAuthFromRequest(request);
    const { searchParams } = new URL(request.url);
    const path = searchParams.get('_path') || '';

    if (path === 'me/notifications') {
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '20');
      const unreadOnly = searchParams.get('unreadOnly') === 'true';
      const where = { userId: decoded.userId, ...(unreadOnly ? { isRead: false } : {}) };
      const [data, total, unreadCount] = await Promise.all([
        prisma.notification.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
        prisma.notification.count({ where }),
        prisma.notification.count({ where: { userId: decoded.userId, isRead: false } }),
      ]);
      return Response.json({ success: true, data, meta: { total, unreadCount, page, limit } });
    }

    requireRole(decoded.role, UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.FINANCE_MANAGER);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const role = searchParams.get('role');
    const search = searchParams.get('search');
    const isSuperAdmin = decoded.role === UserRole.SUPER_ADMIN;
    const orgId = isSuperAdmin ? undefined : decoded.organizationId!;

    const where: any = {
      ...(orgId ? { organizationId: orgId } : {}),
      ...(status ? { status: status as UserStatus } : {}),
      ...(role ? { role: role as UserRole } : {}),
      ...(search ? { OR: [{ firstName: { contains: search, mode: 'insensitive' } }, { lastName: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }] } : {}),
    };

    const [data, total] = await Promise.all([
      prisma.user.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' }, select: { id: true, firstName: true, lastName: true, email: true, phone: true, role: true, status: true, department: true, jobTitle: true, avatarUrl: true, twoFactorEnabled: true, emailVerified: true, lastLoginAt: true, createdAt: true, organization: { select: { id: true, name: true } } } }),
      prisma.user.count({ where }),
    ]);
    return Response.json({ success: true, data, meta: { total, page, limit, pages: Math.ceil(total / limit) } });
  } catch (err) { return handleApiError(err); }
}

// ─── POST /api/v1/users ───────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const decoded = getAuthFromRequest(request);
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'invite') {
      requireRole(decoded.role, UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN);
      const data = z.object({ email: z.string().email(), role: z.nativeEnum(UserRole), department: z.string().optional(), jobTitle: z.string().optional() }).parse(body);
      const orgId = decoded.organizationId;
      if (!orgId) throw new AppError('No organization', 403, 'NO_ORG');
      const existing = await prisma.user.findUnique({ where: { email: data.email } });
      if (existing) throw new AppError('User already exists', 409, 'USER_EXISTS');
      const token = crypto.randomBytes(32).toString('hex');
      const invitation = await prisma.userInvitation.create({
        data: { organizationId: orgId, invitedById: decoded.userId, email: data.email, role: data.role, token, expiresAt: new Date(Date.now() + 48 * 3600000) },
      });
      return Response.json({ success: true, message: `Invitation sent to ${data.email}`, data: { id: invitation.id, token } }, { status: 201 });
    }

    if (action === 'accept-invitation') {
      const data = z.object({ token: z.string(), firstName: z.string().min(2), lastName: z.string().min(2), password: z.string().min(8), phone: z.string().optional() }).parse(body);
      const invitation = await prisma.userInvitation.findFirst({ where: { token: data.token, acceptedAt: null, expiresAt: { gt: new Date() } } });
      if (!invitation) throw new AppError('Invalid or expired invitation', 400, 'INVALID_INVITATION');
      const passwordHash = await bcrypt.hash(data.password, 12);
      const user = await prisma.user.create({
        data: { email: invitation.email, passwordHash, firstName: data.firstName, lastName: data.lastName, phone: data.phone, role: invitation.role, organizationId: invitation.organizationId, status: UserStatus.ACTIVE, emailVerified: true },
        select: { id: true },
      });
      await prisma.userInvitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date(), invitedUserId: user.id } });
      return Response.json({ success: true, message: 'Invitation accepted. You can now login.', data: { userId: user.id } });
    }

    if (action === 'notifications-read-all') {
      await prisma.notification.updateMany({ where: { userId: decoded.userId, isRead: false }, data: { isRead: true, readAt: new Date() } });
      return Response.json({ success: true, message: 'All notifications marked as read' });
    }

    return Response.json({ success: false, message: 'Unknown action' }, { status: 400 });
  } catch (err) { return handleApiError(err); }
}

// ─── PUT /api/v1/users ────────────────────────────────────────────────────────
export async function PUT(request: NextRequest) {
  try {
    const decoded = getAuthFromRequest(request);
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId')!;
    const action = searchParams.get('action');

    if (action === 'suspend') {
      requireRole(decoded.role, UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN);
      if (userId === decoded.userId) throw new AppError('Cannot suspend yourself', 400, 'SELF_SUSPEND');
      await prisma.user.update({ where: { id: userId }, data: { status: UserStatus.SUSPENDED, refreshTokens: [] } });
      return Response.json({ success: true, message: 'User suspended' });
    }
    if (action === 'activate') {
      requireRole(decoded.role, UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN);
      await prisma.user.update({ where: { id: userId }, data: { status: UserStatus.ACTIVE } });
      return Response.json({ success: true, message: 'User activated' });
    }

    requireRole(decoded.role, UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN);
    const data = z.object({ firstName: z.string().min(2).optional(), lastName: z.string().min(2).optional(), phone: z.string().optional(), department: z.string().optional(), jobTitle: z.string().optional(), role: z.nativeEnum(UserRole).optional(), status: z.nativeEnum(UserStatus).optional() }).parse(body);
    const updated = await prisma.user.update({ where: { id: userId }, data, select: { id: true, firstName: true, lastName: true, email: true, role: true, status: true, department: true, jobTitle: true, phone: true, updatedAt: true } });
    return Response.json({ success: true, data: updated });
  } catch (err) { return handleApiError(err); }
}

// ─── DELETE /api/v1/users ─────────────────────────────────────────────────────
export async function DELETE(request: NextRequest) {
  try {
    const decoded = getAuthFromRequest(request);
    requireRole(decoded.role, UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN);
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId')!;
    if (userId === decoded.userId) throw new AppError('Cannot delete yourself', 400, 'SELF_DELETE');
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');
    await prisma.user.update({ where: { id: userId }, data: { status: UserStatus.INACTIVE, email: `deleted_${Date.now()}_${user.email}` } });
    return Response.json({ success: true, message: 'User deactivated' });
  } catch (err) { return handleApiError(err); }
}

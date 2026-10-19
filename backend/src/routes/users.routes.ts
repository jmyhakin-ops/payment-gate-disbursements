import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authenticate, authorize } from '../middleware/auth';
import { UserRole, UserStatus } from '@prisma/client';
import { hashPassword, registerUser } from '../services/auth.service';
import { sendEmail, emailTemplates } from '../services/notification.service';
import { auditLog } from '../services/audit.service';
import { generateSecureToken } from '../services/encryption.service';
import { AppError } from '../utils/AppError';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
router.use(authenticate);

// ─── GET /users — list org users ──────────────────────────────────────────────
router.get('/', authorize(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.FINANCE_MANAGER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = '1', limit = '20', status, role, search } = req.query as Record<string, string>;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const isSuperAdmin = req.user!.role === UserRole.SUPER_ADMIN;
    const orgId = isSuperAdmin ? undefined : req.user!.organizationId!;

    const where = {
      ...(orgId ? { organizationId: orgId } : {}),
      ...(status ? { status: status as UserStatus } : {}),
      ...(role ? { role: role as UserRole } : {}),
      ...(search ? {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' as const } },
          { lastName: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
        ],
      } : {}),
    };

    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where, skip, take: limitNum,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, firstName: true, lastName: true, email: true, phone: true,
          role: true, status: true, department: true, jobTitle: true, avatarUrl: true,
          twoFactorEnabled: true, emailVerified: true, lastLoginAt: true, createdAt: true,
          organization: { select: { id: true, name: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({ success: true, data, meta: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) } });
  } catch (err) { next(err); }
});

// ─── GET /users/:id ───────────────────────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true, firstName: true, lastName: true, email: true, phone: true,
        role: true, status: true, department: true, jobTitle: true, avatarUrl: true,
        nationalId: true, twoFactorEnabled: true, emailVerified: true,
        lastLoginAt: true, lastLoginIp: true, createdAt: true, updatedAt: true,
        organizationId: true, preferences: true,
        organization: { select: { id: true, name: true } },
        directorProfile: { select: { id: true, isActive: true } },
      },
    });
    if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');
    if (req.user!.role !== UserRole.SUPER_ADMIN && user.organizationId !== req.user!.organizationId) {
      throw new AppError('Access denied', 403, 'FORBIDDEN');
    }
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
});

// ─── POST /users/invite — invite user to org ──────────────────────────────────
router.post('/invite', authorize(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      email: z.string().email(),
      role: z.nativeEnum(UserRole),
      department: z.string().optional(),
      jobTitle: z.string().optional(),
    });
    const data = schema.parse(req.body);
    const orgId = req.user!.organizationId;
    if (!orgId) throw new AppError('No organization context', 403, 'NO_ORG');

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new AppError('User already exists with this email', 409, 'USER_EXISTS');

    const token = generateSecureToken();
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    const invitation = await prisma.userInvitation.create({
      data: { organizationId: orgId, invitedById: req.user!.id, email: data.email, role: data.role, token, expiresAt },
    });

    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } });
    await sendEmail({
      to: data.email,
      subject: `Invitation to join ${org?.name} on KenyaPay`,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f5f5f5;"><div style="background:#1a56db;padding:30px;text-align:center;"><h1 style="color:white;margin:0;">KenyaPay Platform</h1></div><div style="background:white;padding:30px;border-radius:0 0 8px 8px;"><h2>You're Invited!</h2><p>You have been invited to join <strong>${org?.name}</strong> on the KenyaPay Multi-Rail Payment Platform as a <strong>${data.role.replace('_', ' ')}</strong>.</p><div style="text-align:center;margin:24px 0;"><a href="${process.env.FRONTEND_URL}/accept-invitation?token=${token}" style="background:#1a56db;color:white;padding:14px 28px;text-decoration:none;border-radius:6px;display:inline-block;font-size:16px;">Accept Invitation</a></div><p style="color:#6b7280;font-size:13px;">This invitation expires in 48 hours.</p></div></div>`,
    });

    await auditLog({
      organizationId: orgId,
      userId: req.user!.id,
      action: 'USER_INVITE',
      description: `Invited ${data.email} as ${data.role}`,
      newValues: { email: data.email, role: data.role },
    });

    res.status(201).json({ success: true, message: `Invitation sent to ${data.email}`, data: { id: invitation.id } });
  } catch (err) { next(err); }
});

// ─── POST /users/accept-invitation ───────────────────────────────────────────
router.post('/accept-invitation', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      token: z.string(),
      firstName: z.string().min(2),
      lastName: z.string().min(2),
      password: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/),
      phone: z.string().optional(),
    });
    const data = schema.parse(req.body);

    const invitation = await prisma.userInvitation.findFirst({
      where: { token: data.token, acceptedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!invitation) throw new AppError('Invalid or expired invitation', 400, 'INVALID_INVITATION');

    const { user } = await registerUser({
      email: invitation.email,
      password: data.password,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      role: invitation.role,
      organizationId: invitation.organizationId,
    });

    await prisma.$transaction([
      prisma.userInvitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date(), invitedUserId: user.id } }),
      prisma.user.update({ where: { id: user.id }, data: { emailVerified: true, status: UserStatus.ACTIVE } }),
    ]);

    res.json({ success: true, message: 'Invitation accepted. You can now login.', data: { userId: user.id } });
  } catch (err) { next(err); }
});

// ─── PUT /users/:id — update user ────────────────────────────────────────────
router.put('/:id', authorize(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      firstName: z.string().min(2).optional(),
      lastName: z.string().min(2).optional(),
      phone: z.string().optional(),
      department: z.string().optional(),
      jobTitle: z.string().optional(),
      role: z.nativeEnum(UserRole).optional(),
      status: z.nativeEnum(UserStatus).optional(),
      preferences: z.record(z.unknown()).optional(),
    });
    const data = schema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError('User not found', 404, 'NOT_FOUND');
    if (req.user!.role !== UserRole.SUPER_ADMIN && existing.organizationId !== req.user!.organizationId) {
      throw new AppError('Access denied', 403, 'FORBIDDEN');
    }

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: data as any,
      select: {
        id: true, firstName: true, lastName: true, email: true, role: true, status: true,
        department: true, jobTitle: true, phone: true, updatedAt: true,
      },
    });

    await auditLog({
      organizationId: req.user!.organizationId || undefined,
      userId: req.user!.id,
      action: 'UPDATE',
      resource: 'User',
      resourceId: req.params.id,
      description: `User updated: ${existing.email}`,
      oldValues: existing,
      newValues: data,
    });

    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

// ─── PUT /users/:id/suspend ───────────────────────────────────────────────────
router.put('/:id/suspend', authorize(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.params.id === req.user!.id) throw new AppError('Cannot suspend yourself', 400, 'SELF_SUSPEND');
    await prisma.user.update({ where: { id: req.params.id }, data: { status: UserStatus.SUSPENDED, refreshTokens: [] } });
    await auditLog({ organizationId: req.user!.organizationId || undefined, userId: req.user!.id, action: 'USER_SUSPEND', resource: 'User', resourceId: req.params.id, description: 'User suspended' });
    res.json({ success: true, message: 'User suspended' });
  } catch (err) { next(err); }
});

// ─── PUT /users/:id/activate ──────────────────────────────────────────────────
router.put('/:id/activate', authorize(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.user.update({ where: { id: req.params.id }, data: { status: UserStatus.ACTIVE } });
    res.json({ success: true, message: 'User activated' });
  } catch (err) { next(err); }
});

// ─── DELETE /users/:id ────────────────────────────────────────────────────────
router.delete('/:id', authorize(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.params.id === req.user!.id) throw new AppError('Cannot delete yourself', 400, 'SELF_DELETE');
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');
    await prisma.user.update({ where: { id: req.params.id }, data: { status: UserStatus.INACTIVE, email: `deleted_${Date.now()}_${user.email}` } });
    await auditLog({ organizationId: req.user!.organizationId || undefined, userId: req.user!.id, action: 'DELETE', resource: 'User', resourceId: req.params.id, description: `User deleted: ${user.email}` });
    res.json({ success: true, message: 'User deactivated' });
  } catch (err) { next(err); }
});

// ─── GET /users/me/notifications ─────────────────────────────────────────────
router.get('/me/notifications', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = '1', limit = '20', unreadOnly = 'false' } = req.query as Record<string, string>;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const where = { userId: req.user!.id, ...(unreadOnly === 'true' ? { isRead: false } : {}) };
    const [data, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({ where, skip, take: limitNum, orderBy: { createdAt: 'desc' } }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId: req.user!.id, isRead: false } }),
    ]);
    res.json({ success: true, data, meta: { total, unreadCount, page: pageNum, limit: limitNum } });
  } catch (err) { next(err); }
});

// ─── PUT /users/me/notifications/read-all ────────────────────────────────────
router.put('/me/notifications/read-all', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.notification.updateMany({ where: { userId: req.user!.id, isRead: false }, data: { isRead: true, readAt: new Date() } });
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) { next(err); }
});

export default router;

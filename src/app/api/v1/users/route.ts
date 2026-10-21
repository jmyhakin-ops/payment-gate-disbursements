import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAuthFromRequest } from '@/lib/auth';
import { AppError, handleApiError } from '@/lib/errors';
import { UserRole, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

// ─── Decrypt SMTP credentials ─────────────────────────────────────────────────
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'kenyapay-default-key-32-chars-pad';

function decryptCreds(enc: string): Record<string, string> {
  try {
    const [ivHex, encrypted] = enc.split(':');
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(ivHex, 'hex'));
    const plain = decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
    return JSON.parse(plain);
  } catch { return {}; }
}

// ─── Send invitation email via saved SMTP settings ────────────────────────────
async function sendInvitationEmail(orgId: string, toEmail: string, token: string, role: string) {
  try {
    // 1) Look for active SMTP cred in this org
    let smtpCred = await prisma.apiCredential.findFirst({
      where: { organizationId: orgId, type: 'SMTP_EMAIL', isActive: true },
    });
    // 2) Any SMTP in this org (active or not)
    if (!smtpCred) {
      smtpCred = await prisma.apiCredential.findFirst({
        where: { organizationId: orgId, type: 'SMTP_EMAIL' },
      });
    }
    // 3) Any SMTP anywhere in the system (Super Admin may have saved under a different org)
    if (!smtpCred) {
      smtpCred = await prisma.apiCredential.findFirst({
        where: { type: 'SMTP_EMAIL' },
        orderBy: { updatedAt: 'desc' }, // use most recently updated
      });
    }
    if (!smtpCred) {
      return { sent: false, reason: 'No SMTP credentials configured. Go to Settings → API Credentials → Email (SMTP) and save your settings.' };
    }
    const creds = decryptCreds(smtpCred.credentials as string);
    return await doSendEmail(creds, toEmail, token, role);
  } catch (e: any) {
    return { sent: false, reason: e.message };
  }
}

async function doSendEmail(creds: Record<string, string>, toEmail: string, token: string, role: string) {
  const host = creds.host || creds.smtpHost;
  const port = parseInt(creds.port || creds.smtpPort || '587');
  const user = creds.username || creds.user || creds.email;
  const pass = creds.password || creds.pass || creds.appToken;
  const fromName = creds.fromName || 'KenyaPay';
  const fromEmail = creds.fromEmail || user;

  if (!host || !user || !pass) return { sent: false, reason: 'Incomplete SMTP settings (host/username/password required).' };

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });

  const acceptUrl = `${process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://payment-gate-disbursements.vercel.app'}/accept-invitation?token=${token}`;

  await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: toEmail,
    subject: `You're invited to join KenyaPay as ${role}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px;border:1px solid #e5e7eb;border-radius:12px">
        <h2 style="color:#4f46e5;margin-bottom:8px">You're invited to KenyaPay 🎉</h2>
        <p style="color:#374151">You have been invited to join the platform as <strong>${role}</strong>.</p>
        <p style="color:#374151">Click the button below to accept your invitation and set your password. This link expires in <strong>48 hours</strong>.</p>
        <a href="${acceptUrl}" style="display:inline-block;margin:20px 0;padding:14px 28px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold">Accept Invitation</a>
        <p style="color:#6b7280;font-size:13px">Or paste this link in your browser:<br/><span style="color:#4f46e5">${acceptUrl}</span></p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
        <p style="color:#9ca3af;font-size:12px">If you did not expect this invitation, you can safely ignore this email.</p>
      </div>
    `,
  });

  return { sent: true };
}

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
      const data = z.object({
        email: z.string().email(),
        role: z.nativeEnum(UserRole),
        department: z.string().optional(),
        jobTitle: z.string().optional(),
        organizationId: z.string().uuid().optional(),
      }).parse(body);

      const isSuperAdmin = decoded.role === UserRole.SUPER_ADMIN;
      // Determine target org: body.organizationId (SA can pass it) or decoded org
      let orgId = data.organizationId ?? decoded.organizationId;
      if (!orgId && isSuperAdmin) {
        // Super Admin: auto-pick first org in system
        const firstOrg = await prisma.organization.findFirst({ orderBy: { createdAt: 'asc' } });
        if (!firstOrg) throw new AppError('No organization found. Create an organization first.', 400, 'NO_ORG');
        orgId = firstOrg.id;
      }
      if (!orgId) throw new AppError('No organization', 403, 'NO_ORG');

      // Check duplicate invitation or existing user
      const existing = await prisma.user.findUnique({ where: { email: data.email } });
      if (existing) throw new AppError('A user with this email already exists', 409, 'USER_EXISTS');

      // If a pending invite already exists — resend it instead of blocking
      const pendingInvite = await prisma.userInvitation.findFirst({
        where: { email: data.email, acceptedAt: null, expiresAt: { gt: new Date() } },
      });

      let invitation = pendingInvite;
      if (!invitation) {
        // Create new invitation
        const token = crypto.randomBytes(32).toString('hex');
        invitation = await prisma.userInvitation.create({
          data: {
            organizationId: orgId,
            invitedById: decoded.userId,
            email: data.email,
            role: data.role,
            token,
            expiresAt: new Date(Date.now() + 48 * 3600000),
          },
        });
      } else {
        // Extend expiry by 48 hours from now on resend
        invitation = await prisma.userInvitation.update({
          where: { id: invitation.id },
          data: { expiresAt: new Date(Date.now() + 48 * 3600000) },
        });
      }

      // Send invitation email via SMTP
      const emailResult = await sendInvitationEmail(orgId, data.email, invitation.token, data.role);

      const acceptUrl = `${process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://payment-gate-disbursements.vercel.app'}/accept-invitation?token=${invitation.token}`;
      const wasResent = !!pendingInvite;

      return Response.json({
        success: true,
        message: emailResult.sent
          ? `Invitation ${wasResent ? 'resent' : 'sent'} successfully to ${data.email}`
          : `Invitation saved — email not sent: ${emailResult.reason}. Share the link below manually.`,
        data: { id: invitation.id, token: invitation.token, acceptUrl, emailSent: emailResult.sent, wasResent },
      }, { status: 201 });
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

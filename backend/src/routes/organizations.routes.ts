import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authenticate, authorize } from '../middleware/auth';
import { UserRole, OrgStatus, PaymentRail } from '@prisma/client';
import { auditLog } from '../services/audit.service';
import { AppError } from '../utils/AppError';
import { generateSecureToken } from '../services/encryption.service';
import { sendEmail } from '../services/notification.service';

const router = Router();
router.use(authenticate);

// ─── GET /organizations — list all (super admin) ──────────────────────────────
router.get('/', authorize(UserRole.SUPER_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = '1', limit = '20', status, search } = req.query as Record<string, string>;
    const pageNum = parseInt(page, 10); const limitNum = parseInt(limit, 10);
    const where = {
      ...(status ? { status: status as OrgStatus } : {}),
      ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' as const } }, { email: { contains: search, mode: 'insensitive' as const } }, { registrationNumber: { contains: search, mode: 'insensitive' as const } }] } : {}),
    };
    const [data, total] = await Promise.all([
      prisma.organization.findMany({ where, skip: (pageNum - 1) * limitNum, take: limitNum, orderBy: { createdAt: 'desc' }, include: { _count: { select: { users: true, transactions: true, wallets: true } } } }),
      prisma.organization.count({ where }),
    ]);
    res.json({ success: true, data, meta: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) } });
  } catch (err) { next(err); }
});

// ─── GET /organizations/me — get own org ──────────────────────────────────────
router.get('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user!.organizationId) throw new AppError('No organization', 404, 'NO_ORG');
    const org = await prisma.organization.findUnique({
      where: { id: req.user!.organizationId },
      include: {
        directors: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } },
        _count: { select: { users: true, transactions: true, wallets: true } },
      },
    });
    if (!org) throw new AppError('Organization not found', 404, 'NOT_FOUND');
    res.json({ success: true, data: org });
  } catch (err) { next(err); }
});

// ─── POST /organizations — register new org ───────────────────────────────────
router.post('/', authorize(UserRole.SUPER_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      name: z.string().min(2).max(100),
      legalName: z.string().min(2).max(200),
      registrationNumber: z.string().min(4),
      kraPin: z.string().min(10).max(15),
      industry: z.string(),
      address: z.string(),
      city: z.string(),
      phone: z.string(),
      email: z.string().email(),
      website: z.string().url().optional(),
      requiresDirectorApproval: z.boolean().default(true),
      makerCheckerEnabled: z.boolean().default(true),
      minApprovalAmount: z.number().min(0).default(0),
      maxTransactionLimit: z.number().min(1).default(5000000),
      dailyTransactionLimit: z.number().min(1).default(10000000),
      monthlyTransactionLimit: z.number().min(1).default(100000000),
      allowedRails: z.array(z.nativeEnum(PaymentRail)).min(1),
      directorCount: z.number().min(1).max(10).default(2),
    });
    const data = schema.parse(req.body);
    const activationCode = generateSecureToken(16).toUpperCase();

    const org = await prisma.organization.create({
      data: { ...data, activationCode, status: OrgStatus.PENDING_APPROVAL },
    });

    await auditLog({
      userId: req.user!.id,
      action: 'CREATE',
      resource: 'Organization',
      resourceId: org.id,
      description: `Organization created: ${org.name}`,
      newValues: { name: org.name, email: org.email },
    });

    res.status(201).json({ success: true, data: org });
  } catch (err) { next(err); }
});

// ─── PUT /organizations/me — update own org ───────────────────────────────────
router.put('/me', authorize(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.role === UserRole.SUPER_ADMIN ? req.body.organizationId : req.user!.organizationId;
    if (!orgId) throw new AppError('No organization', 403, 'NO_ORG');
    const schema = z.object({
      name: z.string().optional(), address: z.string().optional(), city: z.string().optional(),
      phone: z.string().optional(), website: z.string().url().optional().or(z.literal('')),
      logoUrl: z.string().optional(), industry: z.string().optional(),
      requiresDirectorApproval: z.boolean().optional(),
      makerCheckerEnabled: z.boolean().optional(),
      minApprovalAmount: z.number().min(0).optional(),
      maxTransactionLimit: z.number().min(1).optional(),
      dailyTransactionLimit: z.number().min(1).optional(),
      monthlyTransactionLimit: z.number().min(1).optional(),
      allowedRails: z.array(z.nativeEnum(PaymentRail)).optional(),
      directorCount: z.number().min(1).max(10).optional(),
    });
    const data = schema.parse(req.body);
    const old = await prisma.organization.findUnique({ where: { id: orgId } });
    const updated = await prisma.organization.update({ where: { id: orgId }, data });
    await auditLog({ organizationId: orgId, userId: req.user!.id, action: 'UPDATE', resource: 'Organization', resourceId: orgId, description: 'Organization settings updated', oldValues: old, newValues: data });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

// ─── PUT /organizations/:id/approve — super admin approves org ────────────────
router.put('/:id/approve', authorize(UserRole.SUPER_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const org = await prisma.organization.findUnique({ where: { id: req.params.id } });
    if (!org) throw new AppError('Organization not found', 404, 'NOT_FOUND');
    const updated = await prisma.organization.update({
      where: { id: req.params.id },
      data: { status: OrgStatus.ACTIVE, activatedAt: new Date(), activatedByUserId: req.user!.id },
    });
    await sendEmail({
      to: org.email,
      subject: 'Your KenyaPay Organization Has Been Approved',
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;"><div style="background:#16a34a;padding:30px;text-align:center;"><h1 style="color:white;">✅ Organization Approved!</h1></div><div style="background:white;padding:30px;"><h2>Congratulations!</h2><p>Your organization <strong>${org.name}</strong> has been approved on the KenyaPay Platform.</p><p><strong>Activation Code:</strong> <code style="background:#f3f4f6;padding:4px 8px;border-radius:4px;font-size:16px;">${org.activationCode}</code></p><p>You can now log in and start using the payment platform.</p></div></div>`,
    });
    await auditLog({ userId: req.user!.id, action: 'UPDATE', resource: 'Organization', resourceId: req.params.id, description: `Organization approved: ${org.name}` });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

// ─── PUT /organizations/:id/suspend ──────────────────────────────────────────
router.put('/:id/suspend', authorize(UserRole.SUPER_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reason } = z.object({ reason: z.string().min(5) }).parse(req.body);
    const org = await prisma.organization.findUnique({ where: { id: req.params.id } });
    if (!org) throw new AppError('Not found', 404, 'NOT_FOUND');
    await prisma.organization.update({ where: { id: req.params.id }, data: { status: OrgStatus.SUSPENDED } });
    await auditLog({ userId: req.user!.id, action: 'UPDATE', resource: 'Organization', resourceId: req.params.id, description: `Org suspended: ${reason}` });
    res.json({ success: true, message: 'Organization suspended' });
  } catch (err) { next(err); }
});

// ─── POST /organizations/me/activate — activate org with code ─────────────────
router.post('/me/activate', authorize(UserRole.ORG_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { activationCode } = z.object({ activationCode: z.string() }).parse(req.body);
    const orgId = req.user!.organizationId;
    if (!orgId) throw new AppError('No organization', 403, 'NO_ORG');
    const org = await prisma.organization.findFirst({ where: { id: orgId, activationCode } });
    if (!org) throw new AppError('Invalid activation code', 400, 'INVALID_CODE');
    if (org.status === OrgStatus.ACTIVE) throw new AppError('Organization is already active', 409, 'ALREADY_ACTIVE');
    await prisma.organization.update({ where: { id: orgId }, data: { status: OrgStatus.ACTIVE, activatedAt: new Date(), activatedByUserId: req.user!.id } });
    res.json({ success: true, message: 'Organization activated successfully' });
  } catch (err) { next(err); }
});

// ─── POST /organizations/me/directors — add director ─────────────────────────
router.post('/me/directors', authorize(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    if (!orgId) throw new AppError('No organization', 403, 'NO_ORG');
    const schema = z.object({
      userId: z.string().uuid(),
      name: z.string().min(2),
      email: z.string().email(),
      phone: z.string(),
      nationalId: z.string(),
    });
    const data = schema.parse(req.body);
    const user = await prisma.user.findFirst({ where: { id: data.userId, organizationId: orgId } });
    if (!user) throw new AppError('User not found in this organization', 404, 'NOT_FOUND');

    const director = await prisma.organizationDirector.create({ data: { organizationId: orgId, ...data } });
    await prisma.user.update({ where: { id: data.userId }, data: { role: UserRole.DIRECTOR } });

    await auditLog({ organizationId: orgId, userId: req.user!.id, action: 'CREATE', resource: 'Director', resourceId: director.id, description: `Director added: ${data.name}` });
    res.status(201).json({ success: true, data: director });
  } catch (err) { next(err); }
});

// ─── DELETE /organizations/me/directors/:directorId ───────────────────────────
router.delete('/me/directors/:directorId', authorize(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    if (!orgId) throw new AppError('No organization', 403, 'NO_ORG');
    await prisma.organizationDirector.update({ where: { id: req.params.directorId }, data: { isActive: false } });
    res.json({ success: true, message: 'Director removed' });
  } catch (err) { next(err); }
});

export default router;

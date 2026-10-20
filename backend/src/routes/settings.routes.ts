import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authenticate, authorize } from '../middleware/auth';
import { UserRole, ApiCredentialType } from '@prisma/client';
import { encryptCredentials, decryptCredentials, maskCredential } from '../services/encryption.service';
import { auditLog } from '../services/audit.service';
import { AppError } from '../utils/AppError';
import axios from 'axios';

const router = Router();
router.use(authenticate);

// ─── GET /settings — get all org system settings ──────────────────────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    const settings = await prisma.systemSetting.findMany({
      where: { organizationId: orgId || null },
      orderBy: { category: 'asc' },
    });
    const sanitized = settings.map((s) => ({
      ...s,
      value: s.isEncrypted ? maskCredential(s.value) : s.value,
    }));
    res.json({ success: true, data: sanitized });
  } catch (err) { next(err); }
});

// ─── PUT /settings — upsert a setting ────────────────────────────────────────
router.put('/', authorize(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      key: z.string(),
      value: z.string(),
      category: z.string().default('general'),
      description: z.string().optional(),
      isEncrypted: z.boolean().default(false),
    });
    const data = schema.parse(req.body);
    const orgId = req.user!.role === UserRole.SUPER_ADMIN && !req.user!.organizationId ? null : req.user!.organizationId;

    const setting = await prisma.systemSetting.upsert({
      where: { organizationId_key: { organizationId: orgId || '', key: data.key } },
      create: { organizationId: orgId, ...data },
      update: { value: data.value, isEncrypted: data.isEncrypted, description: data.description },
    });

    await auditLog({
      organizationId: orgId || undefined,
      userId: req.user!.id,
      action: 'SETTINGS_CHANGE',
      resource: 'SystemSetting',
      resourceId: setting.id,
      description: `Setting updated: ${data.key}`,
      newValues: { key: data.key, category: data.category },
    });

    res.json({ success: true, data: { ...setting, value: data.isEncrypted ? maskCredential(setting.value) : setting.value } });
  } catch (err) { next(err); }
});

// ─── GET /settings/api-credentials — list all API creds for org ───────────────
router.get('/api-credentials', authorize(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.FINANCE_MANAGER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId || null;
    if (!orgId && req.user!.role !== UserRole.SUPER_ADMIN) {
      throw new AppError('No organization', 403, 'NO_ORG');
    }
    const creds = await prisma.apiCredential.findMany({
      where: { organizationId: orgId ?? undefined },
      orderBy: { type: 'asc' },
    });
    // Return masked version
    const masked = creds.map((c) => {
      const decrypted = decryptCredentials(c.credentials);
      const maskedCreds: Record<string, string> = {};
      Object.keys(decrypted).forEach((k) => { maskedCreds[k] = maskCredential(decrypted[k]); });
      return { ...c, credentials: maskedCreds };
    });
    res.json({ success: true, data: masked });
  } catch (err) { next(err); }
});

// ─── POST /settings/api-credentials — save/update API cred ───────────────────
router.post('/api-credentials', authorize(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      type: z.nativeEnum(ApiCredentialType),
      name: z.string().min(2).max(100),
      environment: z.enum(['sandbox', 'production']),
      credentials: z.record(z.string()),
      webhookSecret: z.string().optional(),
    });
    const data = schema.parse(req.body);
    // Super Admin can save system-level credentials (null orgId), ORG_ADMIN must have an org
    const orgId = req.user!.organizationId || null;
    if (!orgId && req.user!.role !== UserRole.SUPER_ADMIN) {
      throw new AppError('No organization', 403, 'NO_ORG');
    }

    const encryptedCreds = encryptCredentials(data.credentials);

    const existing = await prisma.apiCredential.findFirst({
      where: { organizationId: orgId ?? undefined, type: data.type, environment: data.environment },
    });

    let result;
    if (existing) {
      result = await prisma.apiCredential.update({
        where: { id: existing.id },
        data: { name: data.name, credentials: encryptedCreds, webhookSecret: data.webhookSecret },
      });
    } else {
      result = await prisma.apiCredential.create({
        data: { organizationId: orgId as string, type: data.type, name: data.name, environment: data.environment, credentials: encryptedCreds, webhookSecret: data.webhookSecret },
      });
    }

    await auditLog({
      organizationId: orgId || undefined,
      userId: req.user!.id,
      action: 'API_CREDENTIAL_CHANGE',
      resource: 'ApiCredential',
      resourceId: result.id,
      description: `API credential saved: ${data.type} (${data.environment})`,
      newValues: { type: data.type, environment: data.environment, name: data.name },
    });

    res.json({ success: true, message: 'API credential saved securely', data: { id: result.id, type: result.type, name: result.name, environment: result.environment, isActive: result.isActive, updatedAt: result.updatedAt } });
  } catch (err) { next(err); }
});

// ─── PUT /settings/api-credentials/:id/activate ───────────────────────────────
router.put('/api-credentials/:id/activate', authorize(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    if (!orgId) throw new AppError('No organization', 403, 'NO_ORG');
    const cred = await prisma.apiCredential.findFirst({ where: { id: req.params.id, organizationId: orgId } });
    if (!cred) throw new AppError('Credential not found', 404, 'NOT_FOUND');

    await prisma.apiCredential.update({ where: { id: req.params.id }, data: { isActive: true } });
    res.json({ success: true, message: 'API credential activated' });
  } catch (err) { next(err); }
});

// ─── POST /settings/api-credentials/:id/test — test connection ────────────────
router.post('/api-credentials/:id/test', authorize(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    if (!orgId) throw new AppError('No organization', 403, 'NO_ORG');
    const cred = await prisma.apiCredential.findFirst({ where: { id: req.params.id, organizationId: orgId } });
    if (!cred) throw new AppError('Credential not found', 404, 'NOT_FOUND');

    const decrypted = decryptCredentials(cred.credentials);
    let testStatus = 'success';
    let testMessage = 'Connection test successful';

    try {
      if (cred.type === ApiCredentialType.MPESA_DARAJA) {
        const auth = Buffer.from(`${decrypted.consumerKey}:${decrypted.consumerSecret}`).toString('base64');
        const res2 = await axios.get(`${decrypted.baseUrl || 'https://sandbox.safaricom.co.ke'}/oauth/v1/generate?grant_type=client_credentials`, {
          headers: { Authorization: `Basic ${auth}` }, timeout: 10000,
        });
        testMessage = res2.data.access_token ? 'M-Pesa credentials valid — token obtained' : 'M-Pesa auth failed';
      } else if (cred.type === ApiCredentialType.SMTP_EMAIL) {
        const nodemailer = await import('nodemailer');
        const transporter = nodemailer.createTransport({ host: decrypted.host, port: parseInt(decrypted.port || '587'), auth: { user: decrypted.user, pass: decrypted.pass } });
        await transporter.verify();
        testMessage = 'SMTP connection verified successfully';
      } else {
        testMessage = `${cred.type} credential saved. Full test requires live integration.`;
      }
    } catch (testErr: unknown) {
      testStatus = 'failed';
      testMessage = testErr instanceof Error ? testErr.message : 'Test failed';
    }

    await prisma.apiCredential.update({
      where: { id: req.params.id },
      data: { lastTestedAt: new Date(), lastTestStatus: testStatus, lastTestMessage: testMessage },
    });

    res.json({ success: true, data: { status: testStatus, message: testMessage } });
  } catch (err) { next(err); }
});

// ─── DELETE /settings/api-credentials/:id ────────────────────────────────────
router.delete('/api-credentials/:id', authorize(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    if (!orgId) throw new AppError('No organization', 403, 'NO_ORG');
    await prisma.apiCredential.deleteMany({ where: { id: req.params.id, organizationId: orgId } });
    await auditLog({ organizationId: orgId, userId: req.user!.id, action: 'DELETE', resource: 'ApiCredential', resourceId: req.params.id, description: 'API credential deleted' });
    res.json({ success: true, message: 'Credential deleted' });
  } catch (err) { next(err); }
});

// ─── GET /settings/bank-accounts — list org bank accounts ────────────────────
router.get('/bank-accounts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    if (!orgId) throw new AppError('No organization', 403, 'NO_ORG');
    const accounts = await prisma.bankAccount.findMany({ where: { organizationId: orgId, isActive: true }, orderBy: { createdAt: 'desc' } });
    res.json({ success: true, data: accounts });
  } catch (err) { next(err); }
});

// ─── POST /settings/bank-accounts ────────────────────────────────────────────
router.post('/bank-accounts', authorize(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.FINANCE_MANAGER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    if (!orgId) throw new AppError('No organization', 403, 'NO_ORG');
    const schema = z.object({
      accountName: z.string().min(2),
      accountNumber: z.string().min(6),
      bankName: z.string().min(2),
      bankCode: z.string().min(2),
      branchCode: z.string().optional(),
      swiftCode: z.string().optional(),
      pesaLinkEnabled: z.boolean().default(true),
      rtgsEnabled: z.boolean().default(false),
    });
    const data = schema.parse(req.body);
    const account = await prisma.bankAccount.create({ data: { organizationId: orgId, ...data } });
    res.status(201).json({ success: true, data: account });
  } catch (err) { next(err); }
});

// ─── DELETE /settings/bank-accounts/:id ──────────────────────────────────────
router.delete('/bank-accounts/:id', authorize(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    if (!orgId) throw new AppError('No organization', 403, 'NO_ORG');
    await prisma.bankAccount.updateMany({ where: { id: req.params.id, organizationId: orgId }, data: { isActive: false } });
    res.json({ success: true, message: 'Bank account removed' });
  } catch (err) { next(err); }
});

export default router;

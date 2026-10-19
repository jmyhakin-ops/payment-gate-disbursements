import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAuthFromRequest } from '@/lib/auth';
import { AppError, handleApiError } from '@/lib/errors';
import { UserRole, ApiCredentialType } from '@prisma/client';
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'kenyapay-default-key-32-chars-pad';
function encrypt(text: string) {
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  return iv.toString('hex') + ':' + cipher.update(text, 'utf8', 'hex') + cipher.final('hex');
}
function decrypt(enc: string) {
  try {
    const [ivHex, encrypted] = enc.split(':');
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(ivHex, 'hex'));
    return decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
  } catch { return enc; }
}
function mask(val: string) { return val.length > 8 ? val.substring(0, 4) + '****' + val.slice(-4) : '****'; }

export async function GET(request: NextRequest) {
  try {
    const decoded = getAuthFromRequest(request);
    const orgId = decoded.organizationId;
    const { searchParams } = new URL(request.url);
    const section = searchParams.get('section');

    if (section === 'api-credentials') {
      if (![UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.FINANCE_MANAGER].includes(decoded.role)) throw new AppError('Access denied', 403, 'FORBIDDEN');
      if (!orgId) throw new AppError('No organization', 403, 'NO_ORG');
      const creds = await prisma.apiCredential.findMany({ where: { organizationId: orgId }, orderBy: { type: 'asc' } });
      const masked = creds.map((c) => {
        let parsedCreds: Record<string, string> = {};
        try { parsedCreds = JSON.parse(decrypt(c.credentials)); } catch { parsedCreds = {}; }
        const maskedCreds: Record<string, string> = {};
        Object.keys(parsedCreds).forEach((k) => { maskedCreds[k] = mask(parsedCreds[k]); });
        return { ...c, credentials: maskedCreds };
      });
      return Response.json({ success: true, data: masked });
    }

    if (section === 'bank-accounts') {
      if (!orgId) throw new AppError('No organization', 403, 'NO_ORG');
      const accounts = await prisma.bankAccount.findMany({ where: { organizationId: orgId, isActive: true }, orderBy: { createdAt: 'desc' } });
      return Response.json({ success: true, data: accounts });
    }

    const settings = await prisma.systemSetting.findMany({ where: { organizationId: orgId || null }, orderBy: { category: 'asc' } });
    return Response.json({ success: true, data: settings.map((s) => ({ ...s, value: s.isEncrypted ? mask(s.value) : s.value })) });
  } catch (err) { return handleApiError(err); }
}

export async function POST(request: NextRequest) {
  try {
    const decoded = getAuthFromRequest(request);
    const orgId = decoded.organizationId;
    if (!orgId) throw new AppError('No organization', 403, 'NO_ORG');
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const section = searchParams.get('section');
    const action = searchParams.get('action');

    if (section === 'api-credentials') {
      if (![UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN].includes(decoded.role)) throw new AppError('Access denied', 403, 'FORBIDDEN');
      const data = z.object({ type: z.nativeEnum(ApiCredentialType), name: z.string().min(2), environment: z.enum(['sandbox', 'production']), credentials: z.record(z.string()), webhookSecret: z.string().optional() }).parse(body);
      const encryptedCreds = encrypt(JSON.stringify(data.credentials));
      const existing = await prisma.apiCredential.findFirst({ where: { organizationId: orgId, type: data.type, environment: data.environment } });
      const result = existing
        ? await prisma.apiCredential.update({ where: { id: existing.id }, data: { name: data.name, credentials: encryptedCreds, webhookSecret: data.webhookSecret } })
        : await prisma.apiCredential.create({ data: { organizationId: orgId, type: data.type, name: data.name, environment: data.environment, credentials: encryptedCreds, webhookSecret: data.webhookSecret } });
      return Response.json({ success: true, message: 'API credential saved', data: { id: result.id, type: result.type, name: result.name, environment: result.environment, isActive: result.isActive } });
    }

    if (section === 'bank-accounts') {
      const data = z.object({ accountName: z.string().min(2), accountNumber: z.string().min(6), bankName: z.string().min(2), bankCode: z.string().min(2), branchCode: z.string().optional(), swiftCode: z.string().optional(), pesaLinkEnabled: z.boolean().default(true), rtgsEnabled: z.boolean().default(false) }).parse(body);
      const account = await prisma.bankAccount.create({ data: { organizationId: orgId, ...data } });
      return Response.json({ success: true, data: account }, { status: 201 });
    }

    return Response.json({ success: false, message: 'Unknown section' }, { status: 400 });
  } catch (err) { return handleApiError(err); }
}

export async function PUT(request: NextRequest) {
  try {
    const decoded = getAuthFromRequest(request);
    const orgId = decoded.organizationId;
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const section = searchParams.get('section');

    if (section === 'api-credentials') {
      if (![UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN].includes(decoded.role)) throw new AppError('Access denied', 403, 'FORBIDDEN');
      const credId = searchParams.get('id')!;
      await prisma.apiCredential.update({ where: { id: credId }, data: { isActive: true } });
      return Response.json({ success: true, message: 'API credential activated' });
    }

    // Update system setting
    if (![UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN].includes(decoded.role)) throw new AppError('Access denied', 403, 'FORBIDDEN');
    const data = z.object({ key: z.string(), value: z.string(), category: z.string().default('general'), description: z.string().optional(), isEncrypted: z.boolean().default(false) }).parse(body);
    const settingOrgId = decoded.role === UserRole.SUPER_ADMIN && !orgId ? null : orgId;
    const setting = await prisma.systemSetting.upsert({
      where: { organizationId_key: { organizationId: settingOrgId || '', key: data.key } },
      create: { organizationId: settingOrgId, ...data },
      update: { value: data.value, isEncrypted: data.isEncrypted, description: data.description },
    });
    return Response.json({ success: true, data: setting });
  } catch (err) { return handleApiError(err); }
}

export async function DELETE(request: NextRequest) {
  try {
    const decoded = getAuthFromRequest(request);
    if (![UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN].includes(decoded.role)) throw new AppError('Access denied', 403, 'FORBIDDEN');
    const orgId = decoded.organizationId;
    if (!orgId) throw new AppError('No organization', 403, 'NO_ORG');
    const { searchParams } = new URL(request.url);
    const section = searchParams.get('section');
    const id = searchParams.get('id')!;

    if (section === 'api-credentials') {
      await prisma.apiCredential.deleteMany({ where: { id, organizationId: orgId } });
      return Response.json({ success: true, message: 'Credential deleted' });
    }
    if (section === 'bank-accounts') {
      await prisma.bankAccount.updateMany({ where: { id, organizationId: orgId }, data: { isActive: false } });
      return Response.json({ success: true, message: 'Bank account removed' });
    }
    return Response.json({ success: false, message: 'Unknown section' }, { status: 400 });
  } catch (err) { return handleApiError(err); }
}

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

function mask(val: string) {
  return val.length > 8 ? val.substring(0, 4) + '****' + val.slice(-4) : '****';
}

// Fields that should be masked (actual secrets) — everything else shown in plaintext
const SECRET_KEYS = new Set([
  'password', 'pass', 'appToken', 'secret', 'consumerSecret', 'apiSecret',
  'clientSecret', 'initiatorPassword', 'passkey', 'privateKey', 'apiKey',
  'consumerKey', 'clientId', 'webhookSecret',
]);

function maskCreds(parsedCreds: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  Object.keys(parsedCreds).forEach((k) => {
    const isSecret = SECRET_KEYS.has(k) || k.toLowerCase().includes('secret') || k.toLowerCase().includes('password') || k.toLowerCase().includes('key') || k.toLowerCase().includes('token');
    out[k] = isSecret ? mask(parsedCreds[k]) : parsedCreds[k];
  });
  return out;
}

// GET /api/v1/settings/api-credentials
export async function GET(request: NextRequest) {
  try {
    const decoded = getAuthFromRequest(request);
    const orgId = decoded.organizationId;
    const isSuperAdmin = decoded.role === UserRole.SUPER_ADMIN;

    if (![UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.FINANCE_MANAGER].includes(decoded.role)) {
      throw new AppError('Access denied', 403, 'FORBIDDEN');
    }
    // Super Admin with no org sees ALL credentials; org-scoped users see their own
    if (!orgId && !isSuperAdmin) throw new AppError('No organization linked to your account.', 403, 'NO_ORG');

    const credWhere = orgId ? { organizationId: orgId } : {};
    const creds = await prisma.apiCredential.findMany({
      where: credWhere,
      orderBy: { type: 'asc' },
    });

    const masked = creds.map((c) => {
      let parsedCreds: Record<string, string> = {};
      try { parsedCreds = JSON.parse(decrypt(c.credentials)); } catch { parsedCreds = {}; }
      return { ...c, credentials: maskCreds(parsedCreds) };
    });

    return Response.json({ success: true, data: masked });
  } catch (err) { return handleApiError(err); }
}

// POST /api/v1/settings/api-credentials
export async function POST(request: NextRequest) {
  try {
    const decoded = getAuthFromRequest(request);
    const orgId = decoded.organizationId;
    const isSuperAdmin = decoded.role === UserRole.SUPER_ADMIN;

    if (![UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN].includes(decoded.role)) {
      throw new AppError('Access denied', 403, 'FORBIDDEN');
    }
    if (!orgId && !isSuperAdmin) throw new AppError('No organization linked to your account.', 403, 'NO_ORG');

    const body = await request.json();
    const data = z.object({
      type: z.nativeEnum(ApiCredentialType),
      name: z.string().min(2),
      environment: z.enum(['sandbox', 'production']),
      credentials: z.record(z.string()),
      webhookSecret: z.string().optional(),
      // Allow passing organizationId for Super Admin to target a specific org
      organizationId: z.string().uuid().optional(),
    }).parse(body);

    // Super Admin can explicitly target an org; otherwise use their own or first org
    let targetOrgId = data.organizationId ?? orgId;
    if (!targetOrgId && isSuperAdmin) {
      const firstOrg = await prisma.organization.findFirst({ orderBy: { createdAt: 'asc' } });
      if (firstOrg) targetOrgId = firstOrg.id;
    }
    if (!targetOrgId) throw new AppError('No organization found. Please create an organization first.', 400, 'MISSING_ORG');

    const encryptedCreds = encrypt(JSON.stringify(data.credentials));

    const existing = await prisma.apiCredential.findFirst({
      where: { organizationId: targetOrgId, type: data.type, environment: data.environment },
    });

    const result = existing
      ? await prisma.apiCredential.update({
          where: { id: existing.id },
          data: { name: data.name, credentials: encryptedCreds, webhookSecret: data.webhookSecret, updatedAt: new Date() },
        })
      : await prisma.apiCredential.create({
          data: {
            id: crypto.randomUUID(),
            organizationId: targetOrgId,
            type: data.type,
            name: data.name,
            environment: data.environment,
            credentials: encryptedCreds,
            webhookSecret: data.webhookSecret,
            isActive: false,
            updatedAt: new Date(),
          },
        });

    return Response.json({
      success: true,
      message: existing ? 'API credential updated successfully' : 'API credential saved successfully',
      data: { id: result.id, type: result.type, name: result.name, environment: result.environment, isActive: result.isActive },
    });
  } catch (err) { return handleApiError(err); }
}

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

// GET /api/v1/settings/api-credentials
export async function GET(request: NextRequest) {
  try {
    const decoded = getAuthFromRequest(request);
    const orgId = decoded.organizationId;

    if (![UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.FINANCE_MANAGER].includes(decoded.role)) {
      throw new AppError('Access denied', 403, 'FORBIDDEN');
    }
    if (!orgId) throw new AppError('No organization linked to your account. Please contact support.', 403, 'NO_ORG');

    const creds = await prisma.apiCredential.findMany({
      where: { organizationId: orgId },
      orderBy: { type: 'asc' },
    });

    const masked = creds.map((c) => {
      let parsedCreds: Record<string, string> = {};
      try { parsedCreds = JSON.parse(decrypt(c.credentials)); } catch { parsedCreds = {}; }
      const maskedCreds: Record<string, string> = {};
      Object.keys(parsedCreds).forEach((k) => { maskedCreds[k] = mask(parsedCreds[k]); });
      return { ...c, credentials: maskedCreds };
    });

    return Response.json({ success: true, data: masked });
  } catch (err) { return handleApiError(err); }
}

// POST /api/v1/settings/api-credentials
export async function POST(request: NextRequest) {
  try {
    const decoded = getAuthFromRequest(request);
    const orgId = decoded.organizationId;

    if (![UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN].includes(decoded.role)) {
      throw new AppError('Access denied', 403, 'FORBIDDEN');
    }
    if (!orgId) throw new AppError('No organization linked to your account. Please contact support.', 403, 'NO_ORG');

    const body = await request.json();
    const data = z.object({
      type: z.nativeEnum(ApiCredentialType),
      name: z.string().min(2),
      environment: z.enum(['sandbox', 'production']),
      credentials: z.record(z.string()),
      webhookSecret: z.string().optional(),
    }).parse(body);

    const encryptedCreds = encrypt(JSON.stringify(data.credentials));

    const existing = await prisma.apiCredential.findFirst({
      where: { organizationId: orgId, type: data.type, environment: data.environment },
    });

    const result = existing
      ? await prisma.apiCredential.update({
          where: { id: existing.id },
          data: { name: data.name, credentials: encryptedCreds, webhookSecret: data.webhookSecret, updatedAt: new Date() },
        })
      : await prisma.apiCredential.create({
          data: {
            id: crypto.randomUUID(),
            organizationId: orgId,
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

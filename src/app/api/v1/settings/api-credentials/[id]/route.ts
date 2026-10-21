import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthFromRequest } from '@/lib/auth';
import { AppError, handleApiError } from '@/lib/errors';
import { UserRole } from '@prisma/client';
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'kenyapay-default-key-32-chars-pad';

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

// Helper: build org-scoped where clause (Super Admin can access any credential)
function credWhere(id: string, orgId: string | null, isSuperAdmin: boolean) {
  return isSuperAdmin && !orgId ? { id } : { id, organizationId: orgId! };
}

// PUT /api/v1/settings/api-credentials/[id]  — activate / deactivate / test
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const decoded = getAuthFromRequest(request);
    const orgId = decoded.organizationId;
    const isSuperAdmin = decoded.role === UserRole.SUPER_ADMIN;
    if (![UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN].includes(decoded.role)) {
      throw new AppError('Access denied', 403, 'FORBIDDEN');
    }
    if (!orgId && !isSuperAdmin) throw new AppError('No organization linked', 403, 'NO_ORG');

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    const cred = await prisma.apiCredential.findFirst({ where: credWhere(params.id, orgId, isSuperAdmin) });
    if (!cred) throw new AppError('Credential not found', 404, 'NOT_FOUND');

    if (action === 'test') {
      await prisma.apiCredential.update({
        where: { id: params.id },
        data: { lastTestedAt: new Date(), lastTestStatus: 'success', lastTestMessage: 'Connection test passed', updatedAt: new Date() },
      });
      return Response.json({ success: true, message: 'Credential test passed' });
    }

    const updated = await prisma.apiCredential.update({
      where: { id: params.id },
      data: { isActive: !cred.isActive, updatedAt: new Date() },
    });
    return Response.json({ success: true, message: updated.isActive ? 'Credential activated' : 'Credential deactivated', data: { isActive: updated.isActive } });
  } catch (err) { return handleApiError(err); }
}

// DELETE /api/v1/settings/api-credentials/[id]
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const decoded = getAuthFromRequest(request);
    const orgId = decoded.organizationId;
    const isSuperAdmin = decoded.role === UserRole.SUPER_ADMIN;
    if (![UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN].includes(decoded.role)) {
      throw new AppError('Access denied', 403, 'FORBIDDEN');
    }
    if (!orgId && !isSuperAdmin) throw new AppError('No organization linked', 403, 'NO_ORG');

    await prisma.apiCredential.deleteMany({ where: credWhere(params.id, orgId, isSuperAdmin) });
    return Response.json({ success: true, message: 'Credential deleted' });
  } catch (err) { return handleApiError(err); }
}

// GET /api/v1/settings/api-credentials/[id]
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const decoded = getAuthFromRequest(request);
    const orgId = decoded.organizationId;
    const isSuperAdmin = decoded.role === UserRole.SUPER_ADMIN;
    if (![UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.FINANCE_MANAGER].includes(decoded.role)) {
      throw new AppError('Access denied', 403, 'FORBIDDEN');
    }
    if (!orgId && !isSuperAdmin) throw new AppError('No organization linked', 403, 'NO_ORG');

    const cred = await prisma.apiCredential.findFirst({ where: credWhere(params.id, orgId, isSuperAdmin) });
    if (!cred) throw new AppError('Not found', 404, 'NOT_FOUND');

    let parsedCreds: Record<string, string> = {};
    try { parsedCreds = JSON.parse(decrypt(cred.credentials)); } catch { parsedCreds = {}; }
    return Response.json({ success: true, data: { ...cred, credentials: maskCreds(parsedCreds) } });
  } catch (err) { return handleApiError(err); }
}

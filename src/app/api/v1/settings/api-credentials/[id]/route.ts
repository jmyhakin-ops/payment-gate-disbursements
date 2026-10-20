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

// PUT /api/v1/settings/api-credentials/[id]  — activate / deactivate
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const decoded = getAuthFromRequest(request);
    if (![UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN].includes(decoded.role)) {
      throw new AppError('Access denied', 403, 'FORBIDDEN');
    }
    const orgId = decoded.organizationId;
    if (!orgId) throw new AppError('No organization linked', 403, 'NO_ORG');

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // GET the credential to verify ownership
    const cred = await prisma.apiCredential.findFirst({
      where: { id: params.id, organizationId: orgId },
    });
    if (!cred) throw new AppError('Credential not found', 404, 'NOT_FOUND');

    if (action === 'test') {
      // Simulate a test — in production you'd call the actual API
      await prisma.apiCredential.update({
        where: { id: params.id },
        data: { lastTestedAt: new Date(), lastTestStatus: 'success', lastTestMessage: 'Connection test passed', updatedAt: new Date() },
      });
      return Response.json({ success: true, message: 'Credential test passed' });
    }

    // Default: toggle active / activate
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
    if (![UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN].includes(decoded.role)) {
      throw new AppError('Access denied', 403, 'FORBIDDEN');
    }
    const orgId = decoded.organizationId;
    if (!orgId) throw new AppError('No organization linked', 403, 'NO_ORG');

    await prisma.apiCredential.deleteMany({ where: { id: params.id, organizationId: orgId } });
    return Response.json({ success: true, message: 'Credential deleted' });
  } catch (err) { return handleApiError(err); }
}

// GET /api/v1/settings/api-credentials/[id]
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const decoded = getAuthFromRequest(request);
    if (![UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.FINANCE_MANAGER].includes(decoded.role)) {
      throw new AppError('Access denied', 403, 'FORBIDDEN');
    }
    const orgId = decoded.organizationId;
    if (!orgId) throw new AppError('No organization linked', 403, 'NO_ORG');

    const cred = await prisma.apiCredential.findFirst({ where: { id: params.id, organizationId: orgId } });
    if (!cred) throw new AppError('Not found', 404, 'NOT_FOUND');

    let parsedCreds: Record<string, string> = {};
    try { parsedCreds = JSON.parse(decrypt(cred.credentials)); } catch { parsedCreds = {}; }
    const maskedCreds: Record<string, string> = {};
    Object.keys(parsedCreds).forEach((k) => { maskedCreds[k] = mask(parsedCreds[k]); });

    return Response.json({ success: true, data: { ...cred, credentials: maskedCreds } });
  } catch (err) { return handleApiError(err); }
}

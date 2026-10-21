import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthFromRequest } from '@/lib/auth';
import { AppError, handleApiError } from '@/lib/errors';
import { UserRole } from '@prisma/client';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'kenyapay-default-key-32-chars-pad';
function decrypt(enc: string) {
  try {
    const [ivHex, encrypted] = enc.split(':');
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(ivHex, 'hex'));
    return decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
  } catch { return enc; }
}

// POST /api/v1/settings/api-credentials/[id]/test
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const decoded = getAuthFromRequest(request);
    const orgId = decoded.organizationId;
    const isSuperAdmin = decoded.role === UserRole.SUPER_ADMIN;
    if (![UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.FINANCE_MANAGER].includes(decoded.role)) {
      throw new AppError('Access denied', 403, 'FORBIDDEN');
    }
    if (!orgId && !isSuperAdmin) throw new AppError('No organization linked', 403, 'NO_ORG');

    const where = isSuperAdmin && !orgId ? { id: params.id } : { id: params.id, organizationId: orgId! };
    const cred = await prisma.apiCredential.findFirst({ where });
    if (!cred) throw new AppError('Credential not found', 404, 'NOT_FOUND');

    let testStatus = 'success';
    let testMessage = 'Credential configuration verified successfully';

    try {
      const credentials = JSON.parse(decrypt(cred.credentials));
      if (cred.type === 'MPESA_DARAJA') {
        if (!credentials.consumerKey || !credentials.consumerSecret || !credentials.passKey || !credentials.shortCode) {
          testStatus = 'failed';
          testMessage = 'Missing required M-Pesa fields: consumerKey, consumerSecret, passKey, shortCode';
        }
      } else if (cred.type === 'PESALINK') {
        if (!credentials.apiKey || !credentials.participantCode) {
          testStatus = 'failed';
          testMessage = 'Missing required PesaLink fields: apiKey, participantCode';
        }
      } else if (cred.type === 'SMTP_EMAIL') {
        const host = credentials.host || credentials.smtpHost;
        const port = parseInt(credentials.port || credentials.smtpPort || '587');
        const user = credentials.username || credentials.user || credentials.email;
        const pass = credentials.password || credentials.pass || credentials.appToken;

        if (!host || !user || !pass) {
          testStatus = 'failed';
          testMessage = 'Missing required SMTP fields (host, username, password)';
        } else {
          try {
            const transporter = nodemailer.createTransport({
              host,
              port,
              secure: credentials.secure === 'true' || port === 465,
              auth: { user, pass },
              tls: { rejectUnauthorized: false },
              connectionTimeout: 8000,
            });
            await transporter.verify();
            testStatus = 'success';
            testMessage = `SMTP server ${host}:${port} authenticated successfully for ${user}`;
          } catch (smtpErr: any) {
            testStatus = 'failed';
            testMessage = `SMTP connection failed: ${smtpErr?.message || 'Authentication or timeout error'}`;
          }
        }
      }
    } catch {
      testStatus = 'failed';
      testMessage = 'Failed to decrypt credentials';
    }

    await prisma.apiCredential.update({
      where: { id: params.id },
      data: {
        lastTestedAt: new Date(),
        lastTestStatus: testStatus,
        lastTestMessage: testMessage,
        isActive: testStatus === 'success',
        updatedAt: new Date(),
      },
    });

    return Response.json({
      success: testStatus === 'success',
      message: testMessage,
      data: { status: testStatus, testedAt: new Date().toISOString() },
    });
  } catch (err) { return handleApiError(err); }
}

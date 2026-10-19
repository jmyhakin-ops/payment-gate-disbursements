import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { AppError, handleApiError } from '@/lib/errors';
import { getAuthFromRequest, generateAccessToken, generateRefreshToken } from '@/lib/auth';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';

// ─── POST /api/v1/auth/2fa/verify  (verify code during login) ─────────────────
export async function POST(request: Request) {
  try {
    const { userId, token } = z.object({ userId: z.string(), token: z.string().length(6) }).parse(await request.json());
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.twoFactorSecret) throw new AppError('2FA not configured', 400, '2FA_NOT_CONFIGURED');

    const verified = speakeasy.totp.verify({ secret: user.twoFactorSecret, encoding: 'base32', token, window: 2 });
    if (!verified) throw new AppError('Invalid 2FA code', 401, 'INVALID_2FA_TOKEN');

    const payload = { userId: user.id, organizationId: user.organizationId, role: user.role, email: user.email };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);
    await prisma.user.update({ where: { id: user.id }, data: { refreshTokens: { push: refreshToken } } });

    return Response.json({
      success: true,
      data: {
        accessToken, refreshToken,
        user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, organizationId: user.organizationId },
      },
    });
  } catch (err) { return handleApiError(err); }
}

import { NextRequest } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { generateAccessToken, generateRefreshToken, getAuthFromRequest } from '@/lib/auth';
import { AppError, handleApiError } from '@/lib/errors';
import { UserStatus } from '@prisma/client';
import crypto from 'crypto';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

// ─── POST /api/v1/auth/login ──────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = z.object({
      email: z.string().email(),
      password: z.string(),
    }).parse(body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');

    if (user.lockoutUntil && user.lockoutUntil > new Date()) {
      const mins = Math.ceil((user.lockoutUntil.getTime() - Date.now()) / 60000);
      throw new AppError(`Account locked. Try again in ${mins} minutes`, 403, 'ACCOUNT_LOCKED');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      const attempts = user.loginAttempts + 1;
      const update: any = { loginAttempts: attempts };
      if (attempts >= 5) update.lockoutUntil = new Date(Date.now() + 30 * 60000);
      await prisma.user.update({ where: { id: user.id }, data: update });
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    if (user.status === UserStatus.SUSPENDED) throw new AppError('Account suspended', 403, 'ACCOUNT_SUSPENDED');
    if (user.status === UserStatus.INACTIVE) throw new AppError('Account inactive', 403, 'ACCOUNT_INACTIVE');

    await prisma.user.update({
      where: { id: user.id },
      data: { loginAttempts: 0, lockoutUntil: null, lastLoginAt: new Date(), lastLoginIp: request.headers.get('x-forwarded-for') || '' },
    });

    if (user.twoFactorEnabled) {
      return Response.json({ success: true, requiresTwoFactor: true, userId: user.id });
    }

    const payload = { userId: user.id, organizationId: user.organizationId, role: user.role, email: user.email };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);
    await prisma.user.update({ where: { id: user.id }, data: { refreshTokens: { push: refreshToken } } });

    return Response.json({
      success: true,
      data: {
        accessToken, refreshToken,
        user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, organizationId: user.organizationId, twoFactorEnabled: user.twoFactorEnabled, avatarUrl: user.avatarUrl },
      },
    });
  } catch (err) { return handleApiError(err); }
}

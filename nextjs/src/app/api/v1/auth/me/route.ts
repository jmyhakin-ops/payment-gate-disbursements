import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAuthFromRequest, generateAccessToken, generateRefreshToken, verifyRefreshToken } from '@/lib/auth';
import { AppError, handleApiError } from '@/lib/errors';
import { UserRole, UserStatus } from '@prisma/client';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

// ─── GET /api/v1/auth/me ──────────────────────────────────────────────────────
export async function GET(request: Request) {
  try {
    const decoded = getAuthFromRequest(request);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true, email: true, firstName: true, lastName: true, role: true,
        organizationId: true, status: true, avatarUrl: true, phone: true,
        department: true, jobTitle: true, twoFactorEnabled: true,
        emailVerified: true, lastLoginAt: true, createdAt: true,
        organization: { select: { id: true, name: true, status: true, allowedRails: true, makerCheckerEnabled: true, requiresDirectorApproval: true, directorCount: true } },
      },
    });
    if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');
    return Response.json({ success: true, data: user });
  } catch (err) { return handleApiError(err); }
}

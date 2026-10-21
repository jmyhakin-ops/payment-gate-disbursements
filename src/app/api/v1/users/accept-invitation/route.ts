import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { AppError, handleApiError } from '@/lib/errors';
import { UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

// POST /api/v1/users/accept-invitation  (PUBLIC - no auth token needed)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = z.object({
      token: z.string().min(1, 'Invitation token is required'),
      firstName: z.string().min(2, 'First name must be at least 2 characters'),
      lastName: z.string().min(2, 'Last name must be at least 2 characters'),
      password: z.string().min(8, 'Password must be at least 8 characters'),
      phone: z.string().optional(),
    }).parse(body);

    const invitation = await prisma.userInvitation.findFirst({
      where: {
        token: data.token,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!invitation) {
      throw new AppError('Invalid or expired invitation link. Please request a new invite.', 400, 'INVALID_INVITATION');
    }

    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { email: invitation.email } });
    if (existing) {
      throw new AppError('An account with this email already exists. Please log in.', 409, 'USER_EXISTS');
    }

    const passwordHash = await bcrypt.hash(data.password, 12);
    const user = await prisma.user.create({
      data: {
        email: invitation.email,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        role: invitation.role,
        organizationId: invitation.organizationId,
        status: UserStatus.ACTIVE,
        emailVerified: true,
      },
      select: { id: true, email: true, firstName: true, lastName: true },
    });

    await prisma.userInvitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date(), invitedUserId: user.id },
    });

    return Response.json({
      success: true,
      message: 'Account created successfully! You can now log in.',
      data: { userId: user.id },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { AppError, handleApiError } from '@/lib/errors';
import { UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

// GET /api/v1/users/accept-invitation?token=...
// PUBLIC endpoint to verify an invitation token before showing the form
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token')?.trim();

    if (!token) {
      throw new AppError('Invitation token is required', 400, 'MISSING_TOKEN');
    }

    const invitation = await prisma.userInvitation.findFirst({
      where: { token },
    });

    if (!invitation) {
      throw new AppError('Invalid invitation link. Please request a new invite.', 404, 'NOT_FOUND');
    }

    if (invitation.acceptedAt) {
      return Response.json({
        success: false,
        valid: false,
        status: 'ACCEPTED',
        message: 'This invitation has already been used. Please log in to your account.',
        data: { email: invitation.email, role: invitation.role },
      }, { status: 400 });
    }

    if (new Date() > invitation.expiresAt) {
      return Response.json({
        success: false,
        valid: false,
        status: 'EXPIRED',
        message: 'This invitation has expired. Please ask your administrator to send a new invite.',
        data: { email: invitation.email, role: invitation.role },
      }, { status: 400 });
    }

    const org = await prisma.organization.findUnique({
      where: { id: invitation.organizationId },
      select: { id: true, name: true },
    });

    return Response.json({
      success: true,
      valid: true,
      data: {
        email: invitation.email,
        role: invitation.role,
        organizationName: org?.name || 'KenyaPay Organization',
        expiresAt: invitation.expiresAt,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

// POST /api/v1/users/accept-invitation
// PUBLIC endpoint to accept the invite, set password, and create the user account
export async function POST(request: NextRequest) {
  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      throw new AppError('Invalid JSON in request body', 400, 'BAD_REQUEST');
    }

    const schema = z.object({
      token: z.string().min(1, 'Invitation token is required'),
      firstName: z.string().min(1, 'First name is required').max(100),
      lastName: z.string().min(1, 'Last name is required').max(100),
      password: z.string().min(8, 'Password must be at least 8 characters'),
      phone: z.string().optional().nullable().or(z.literal('')),
    }).passthrough();

    const data = schema.parse(body);
    const token = data.token.trim();

    const invitation = await prisma.userInvitation.findFirst({
      where: { token },
    });

    if (!invitation) {
      throw new AppError('Invalid invitation link. Please check your link or request a new invite.', 404, 'INVALID_INVITATION');
    }

    if (invitation.acceptedAt) {
      throw new AppError('This invitation has already been accepted. Please log in with your credentials.', 400, 'ALREADY_ACCEPTED');
    }

    if (new Date() > invitation.expiresAt) {
      throw new AppError('This invitation has expired. Please ask your administrator to resend an invitation.', 400, 'INVITATION_EXPIRED');
    }

    // Check if user account with this email already exists
    const cleanEmail = invitation.email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existing) {
      // Mark invite as used so it doesn't linger
      await prisma.userInvitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date(), invitedUserId: existing.id },
      }).catch(() => {});
      throw new AppError(`An account with email "${invitation.email}" already exists. Please log in.`, 409, 'USER_EXISTS');
    }

    const passwordHash = await bcrypt.hash(data.password, 12);
    const cleanPhone = (typeof data.phone === 'string' && data.phone.trim().length > 0) ? data.phone.trim() : null;

    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: cleanEmail,
          passwordHash,
          firstName: data.firstName.trim(),
          lastName: data.lastName.trim(),
          phone: cleanPhone,
          role: invitation.role,
          organizationId: invitation.organizationId,
          status: UserStatus.ACTIVE,
          emailVerified: true,
          refreshTokens: [],
        },
        select: { id: true, email: true, firstName: true, lastName: true, role: true },
      });

      await tx.userInvitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date(), invitedUserId: createdUser.id },
      });

      return createdUser;
    });

    return Response.json({
      success: true,
      message: 'Account created successfully! You can now log in.',
      data: { user },
    }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

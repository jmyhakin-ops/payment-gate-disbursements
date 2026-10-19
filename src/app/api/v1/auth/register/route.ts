import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { AppError, handleApiError } from '@/lib/errors';
import { UserRole, UserStatus } from '@prisma/client';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = z.object({
      email: z.string().email(),
      password: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/),
      firstName: z.string().min(2).max(50),
      lastName: z.string().min(2).max(50),
      phone: z.string().optional(),
    }).parse(body);

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new AppError('Email already registered', 409, 'EMAIL_EXISTS');

    const passwordHash = await bcrypt.hash(data.password, 12);
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');

    const user = await prisma.user.create({
      data: { ...data, passwordHash, emailVerificationToken, status: UserStatus.ACTIVE, role: UserRole.MAKER },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, organizationId: true, status: true, createdAt: true },
    });

    return Response.json({ success: true, message: 'Registration successful.', data: { user } }, { status: 201 });
  } catch (err) { return handleApiError(err); }
}

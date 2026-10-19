import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/errors';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// ─── POST /api/v1/auth/forgot-password ────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(await request.json());
    const user = await prisma.user.findUnique({ where: { email } });
    // Don't reveal if email exists
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await prisma.user.update({ where: { id: user.id }, data: { passwordResetToken: token, passwordResetExpires: expires } });
      // In production: send email with reset link
      console.log(`Password reset token for ${email}: ${token}`);
    }
    return Response.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
  } catch (err) { return handleApiError(err); }
}

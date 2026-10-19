import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { AppError, handleApiError } from '@/lib/errors';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const { token, newPassword } = z.object({ token: z.string(), newPassword: z.string().min(8) }).parse(await request.json());
    const user = await prisma.user.findFirst({ where: { passwordResetToken: token, passwordResetExpires: { gt: new Date() } } });
    if (!user) throw new AppError('Invalid or expired reset token', 400, 'INVALID_RESET_TOKEN');
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, passwordResetToken: null, passwordResetExpires: null, refreshTokens: [], lastPasswordChange: new Date() },
    });
    return Response.json({ success: true, message: 'Password reset successfully' });
  } catch (err) { return handleApiError(err); }
}

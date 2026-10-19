import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAuthFromRequest } from '@/lib/auth';
import { handleApiError } from '@/lib/errors';

export async function POST(request: Request) {
  try {
    const decoded = getAuthFromRequest(request);
    const { refreshToken } = z.object({ refreshToken: z.string() }).parse(await request.json());
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (user) {
      await prisma.user.update({
        where: { id: decoded.userId },
        data: { refreshTokens: user.refreshTokens.filter((t) => t !== refreshToken) },
      });
    }
    return Response.json({ success: true, message: 'Logged out successfully' });
  } catch (err) { return handleApiError(err); }
}

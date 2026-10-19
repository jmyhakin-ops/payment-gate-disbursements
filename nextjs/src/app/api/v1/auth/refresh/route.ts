import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifyRefreshToken, generateAccessToken, generateRefreshToken } from '@/lib/auth';
import { handleApiError } from '@/lib/errors';

export async function POST(request: Request) {
  try {
    const { refreshToken } = z.object({ refreshToken: z.string() }).parse(await request.json());
    const decoded = verifyRefreshToken(refreshToken);
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user || !user.refreshTokens.includes(refreshToken)) {
      return Response.json({ success: false, message: 'Refresh token revoked' }, { status: 401 });
    }
    const payload = { userId: user.id, organizationId: user.organizationId, role: user.role, email: user.email };
    const newAccess = generateAccessToken(payload);
    const newRefresh = generateRefreshToken(payload);
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshTokens: user.refreshTokens.filter((t) => t !== refreshToken).concat(newRefresh) },
    });
    return Response.json({ success: true, data: { accessToken: newAccess, refreshToken: newRefresh } });
  } catch (err) { return handleApiError(err); }
}

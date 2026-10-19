import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import { AppError } from './errors';

export interface JwtPayload {
  userId: string;
  organizationId: string | null;
  role: UserRole;
  email: string;
  iat?: number;
  exp?: number;
}

export interface AuthUser {
  id: string;
  organizationId: string | null;
  role: UserRole;
  email: string;
  firstName: string;
  lastName: string;
}

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;

export function generateAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' } as jwt.SignOptions);
}

export function generateRefreshToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '7d' } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) throw new AppError('Token expired', 401, 'TOKEN_EXPIRED');
    throw new AppError('Invalid token', 401, 'INVALID_TOKEN');
  }
}

export function verifyRefreshToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET) as JwtPayload;
  } catch {
    throw new AppError('Invalid or expired refresh token', 401, 'INVALID_REFRESH_TOKEN');
  }
}

// Extract and verify JWT from Authorization header of a Next.js Request
export function getAuthFromRequest(request: Request): JwtPayload {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AppError('No authentication token', 401, 'UNAUTHORIZED');
  }
  const token = authHeader.split(' ')[1];
  return verifyAccessToken(token);
}

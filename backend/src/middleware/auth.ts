import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';
import { UserRole, UserStatus } from '@prisma/client';

export interface JwtPayload {
  userId: string;
  organizationId: string | null;
  role: UserRole;
  email: string;
  iat?: number;
  exp?: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        organizationId: string | null;
        role: UserRole;
        email: string;
        firstName: string;
        lastName: string;
      };
    }
  }
}

// ─── Authenticate JWT ─────────────────────────────────────────────────────────
export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError('No authentication token provided', 401, 'UNAUTHORIZED');
    }

    const token = authHeader.split(' ')[1];
    let decoded: JwtPayload;

    try {
      decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new AppError('Authentication token expired', 401, 'TOKEN_EXPIRED');
      }
      throw new AppError('Invalid authentication token', 401, 'INVALID_TOKEN');
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        organizationId: true,
        role: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        lockoutUntil: true,
      },
    });

    if (!user) throw new AppError('User not found', 401, 'USER_NOT_FOUND');
    if (user.status === UserStatus.SUSPENDED) throw new AppError('Account suspended', 403, 'ACCOUNT_SUSPENDED');
    if (user.status === UserStatus.INACTIVE) throw new AppError('Account inactive', 403, 'ACCOUNT_INACTIVE');
    if (user.lockoutUntil && user.lockoutUntil > new Date()) {
      throw new AppError('Account temporarily locked', 403, 'ACCOUNT_LOCKED');
    }

    req.user = {
      id: user.id,
      organizationId: user.organizationId,
      role: user.role,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    };

    next();
  } catch (error) {
    next(error);
  }
}

// ─── Role-Based Access Control ────────────────────────────────────────────────
export function authorize(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError('Not authenticated', 401, 'UNAUTHORIZED'));
    }
    if (!roles.includes(req.user.role)) {
      return next(new AppError(
        `Access denied. Required roles: ${roles.join(', ')}`,
        403,
        'FORBIDDEN'
      ));
    }
    next();
  };
}

// ─── Super Admin Only ─────────────────────────────────────────────────────────
export function superAdminOnly(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== UserRole.SUPER_ADMIN) {
    return next(new AppError('Super admin access required', 403, 'FORBIDDEN'));
  }
  next();
}

// ─── Org Membership Check ─────────────────────────────────────────────────────
export function requireOrgMembership(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user?.organizationId) {
    return next(new AppError('You must belong to an organization', 403, 'NO_ORGANIZATION'));
  }
  next();
}

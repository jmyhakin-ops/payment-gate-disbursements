import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';
import { UserRole, UserStatus } from '@prisma/client';
import { JwtPayload } from '../middleware/auth';
import { generateSecureToken } from './encryption.service';
import { logger } from '../config/logger';
import { auditLog } from './audit.service';

const SALT_ROUNDS = 12;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 30;

// ─── Hash Password ────────────────────────────────────────────────────────────
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ─── Generate Tokens ──────────────────────────────────────────────────────────
export function generateAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions);
}

export function generateRefreshToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES_IN } as jwt.SignOptions);
}

export function verifyRefreshToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload;
  } catch {
    throw new AppError('Invalid or expired refresh token', 401, 'INVALID_REFRESH_TOKEN');
  }
}

// ─── Register (create user) ───────────────────────────────────────────────────
export async function registerUser(data: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role?: UserRole;
  organizationId?: string;
  department?: string;
  jobTitle?: string;
}) {
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw new AppError('Email already registered', 409, 'EMAIL_EXISTS');

  const passwordHash = await hashPassword(data.password);
  const emailVerificationToken = generateSecureToken();

  const user = await prisma.user.create({
    data: {
      ...data,
      passwordHash,
      emailVerificationToken,
      status: data.organizationId ? UserStatus.PENDING_VERIFICATION : UserStatus.ACTIVE,
      role: data.role || UserRole.MAKER,
    },
    select: {
      id: true, email: true, firstName: true, lastName: true, role: true,
      organizationId: true, status: true, createdAt: true,
    },
  });

  logger.info(`User registered: ${user.email} (${user.role})`);
  return { user, emailVerificationToken };
}

// ─── Login ────────────────────────────────────────────────────────────────────
export async function loginUser(
  email: string,
  password: string,
  ip?: string,
  userAgent?: string
) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');

  // Check lockout
  if (user.lockoutUntil && user.lockoutUntil > new Date()) {
    const minutes = Math.ceil((user.lockoutUntil.getTime() - Date.now()) / 60000);
    throw new AppError(`Account locked. Try again in ${minutes} minutes`, 403, 'ACCOUNT_LOCKED');
  }

  const passwordValid = await verifyPassword(password, user.passwordHash);
  if (!passwordValid) {
    const attempts = user.loginAttempts + 1;
    const updateData: { loginAttempts: number; lockoutUntil?: Date } = { loginAttempts: attempts };
    if (attempts >= MAX_LOGIN_ATTEMPTS) {
      updateData.lockoutUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60000);
    }
    await prisma.user.update({ where: { id: user.id }, data: updateData });
    throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
  }

  if (user.status === UserStatus.SUSPENDED) throw new AppError('Account suspended. Contact admin.', 403, 'ACCOUNT_SUSPENDED');
  if (user.status === UserStatus.INACTIVE) throw new AppError('Account inactive.', 403, 'ACCOUNT_INACTIVE');

  // Reset login attempts
  await prisma.user.update({
    where: { id: user.id },
    data: { loginAttempts: 0, lockoutUntil: null, lastLoginAt: new Date(), lastLoginIp: ip },
  });

  await auditLog({
    organizationId: user.organizationId || undefined,
    userId: user.id,
    action: 'LOGIN',
    description: `User ${user.email} logged in`,
    ipAddress: ip,
    userAgent,
  });

  const tokenPayload: Omit<JwtPayload, 'iat' | 'exp'> = {
    userId: user.id,
    organizationId: user.organizationId,
    role: user.role,
    email: user.email,
  };

  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  // Store refresh token
  await prisma.user.update({
    where: { id: user.id },
    data: { refreshTokens: { push: refreshToken } },
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      organizationId: user.organizationId,
      twoFactorEnabled: user.twoFactorEnabled,
      avatarUrl: user.avatarUrl,
    },
    requiresTwoFactor: user.twoFactorEnabled,
  };
}

// ─── Refresh Token ────────────────────────────────────────────────────────────
export async function refreshAccessToken(refreshToken: string) {
  const decoded = verifyRefreshToken(refreshToken);
  const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
  if (!user) throw new AppError('User not found', 401, 'USER_NOT_FOUND');
  if (!user.refreshTokens.includes(refreshToken)) {
    throw new AppError('Refresh token revoked', 401, 'TOKEN_REVOKED');
  }

  const tokenPayload: Omit<JwtPayload, 'iat' | 'exp'> = {
    userId: user.id,
    organizationId: user.organizationId,
    role: user.role,
    email: user.email,
  };

  const newAccessToken = generateAccessToken(tokenPayload);
  const newRefreshToken = generateRefreshToken(tokenPayload);

  // Rotate refresh token
  await prisma.user.update({
    where: { id: user.id },
    data: {
      refreshTokens: user.refreshTokens.filter((t) => t !== refreshToken).concat(newRefreshToken),
    },
  });

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}

// ─── Logout ───────────────────────────────────────────────────────────────────
export async function logoutUser(userId: string, refreshToken: string, ip?: string, userAgent?: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user) {
    await prisma.user.update({
      where: { id: userId },
      data: { refreshTokens: user.refreshTokens.filter((t) => t !== refreshToken) },
    });
    await auditLog({
      organizationId: user.organizationId || undefined,
      userId,
      action: 'LOGOUT',
      description: `User ${user.email} logged out`,
      ipAddress: ip,
      userAgent,
    });
  }
}

// ─── Setup 2FA ────────────────────────────────────────────────────────────────
export async function setupTwoFactor(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');

  const secret = speakeasy.generateSecret({
    name: `KenyaPay (${user.email})`,
    issuer: 'KenyaPay Platform',
    length: 32,
  });

  const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);

  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorSecret: secret.base32, twoFactorQrCode: qrCodeUrl },
  });

  return { secret: secret.base32, qrCode: qrCodeUrl };
}

export async function verifyAndEnableTwoFactor(userId: string, token: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.twoFactorSecret) throw new AppError('2FA not set up', 400, 'TWO_FACTOR_NOT_SETUP');

  const verified = speakeasy.totp.verify({
    secret: user.twoFactorSecret,
    encoding: 'base32',
    token,
    window: 2,
  });

  if (!verified) throw new AppError('Invalid 2FA token', 400, 'INVALID_TWO_FACTOR_TOKEN');

  await prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: true } });
}

export async function verifyTwoFactorToken(userId: string, token: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.twoFactorSecret) throw new AppError('2FA not configured', 400, 'TWO_FACTOR_NOT_CONFIGURED');

  const verified = speakeasy.totp.verify({
    secret: user.twoFactorSecret,
    encoding: 'base32',
    token,
    window: 2,
  });

  if (!verified) throw new AppError('Invalid 2FA code', 401, 'INVALID_TWO_FACTOR_TOKEN');
}

// ─── Password Reset ───────────────────────────────────────────────────────────
export async function initiatePasswordReset(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return; // Don't reveal if email exists

  const token = generateSecureToken();
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordResetToken: token, passwordResetExpires: expires },
  });

  return { token, user };
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: token,
      passwordResetExpires: { gt: new Date() },
    },
  });
  if (!user) throw new AppError('Invalid or expired reset token', 400, 'INVALID_RESET_TOKEN');

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      passwordResetToken: null,
      passwordResetExpires: null,
      refreshTokens: [],
      lastPasswordChange: new Date(),
    },
  });
}

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  loginUser, registerUser, refreshAccessToken, logoutUser,
  setupTwoFactor, verifyAndEnableTwoFactor, verifyTwoFactorToken,
  initiatePasswordReset, resetPassword,
} from '../services/auth.service';
import { sendEmail, emailTemplates } from '../services/notification.service';
import { authenticate } from '../middleware/auth';
import { prisma } from '../config/database';

const router = Router();

// ─── POST /auth/register ──────────────────────────────────────────────────────
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/,
        'Password must contain uppercase, lowercase, number and special character'),
      firstName: z.string().min(2).max(50),
      lastName: z.string().min(2).max(50),
      phone: z.string().optional(),
    });
    const data = schema.parse(req.body);
    const { user, emailVerificationToken } = await registerUser(data);

    // Send welcome email
    await sendEmail({
      to: user.email,
      subject: 'Welcome to KenyaPay Platform',
      html: emailTemplates.welcomeEmail({ name: user.firstName, email: user.email, verificationToken: emailVerificationToken }),
    });

    res.status(201).json({ success: true, message: 'Registration successful. Please verify your email.', data: { user } });
  } catch (err) { next(err); }
});

// ─── POST /auth/login ─────────────────────────────────────────────────────────
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = z.object({ email: z.string().email(), password: z.string() }).parse(req.body);
    const result = await loginUser(email, password, req.ip, req.headers['user-agent']);

    if (result.requiresTwoFactor) {
      res.status(200).json({ success: true, requiresTwoFactor: true, userId: result.user.id, message: '2FA required' });
      return;
    }

    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// ─── POST /auth/2fa/verify ────────────────────────────────────────────────────
router.post('/2fa/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, token } = z.object({ userId: z.string(), token: z.string().length(6) }).parse(req.body);
    await verifyTwoFactorToken(userId, token);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) { res.status(404).json({ success: false, message: 'User not found' }); return; }

    const { loginUser: loginFn } = await import('../services/auth.service');
    // Re-issue tokens after 2FA
    const { generateAccessToken, generateRefreshToken } = await import('../services/auth.service');
    const payload = { userId: user.id, organizationId: user.organizationId, role: user.role, email: user.email };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);
    await prisma.user.update({ where: { id: userId }, data: { refreshTokens: { push: refreshToken } } });

    res.json({ success: true, data: { accessToken, refreshToken, user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role } } });
  } catch (err) { next(err); }
});

// ─── POST /auth/refresh ───────────────────────────────────────────────────────
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = z.object({ refreshToken: z.string() }).parse(req.body);
    const tokens = await refreshAccessToken(refreshToken);
    res.json({ success: true, data: tokens });
  } catch (err) { next(err); }
});

// ─── POST /auth/logout ────────────────────────────────────────────────────────
router.post('/logout', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = z.object({ refreshToken: z.string() }).parse(req.body);
    await logoutUser(req.user!.id, refreshToken, req.ip, req.headers['user-agent']);
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) { next(err); }
});

// ─── POST /auth/forgot-password ───────────────────────────────────────────────
router.post('/forgot-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    const result = await initiatePasswordReset(email);
    if (result) {
      await sendEmail({
        to: result.user.email,
        subject: 'KenyaPay — Password Reset',
        html: emailTemplates.passwordResetEmail({ name: result.user.firstName, resetToken: result.token }),
      });
    }
    res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
  } catch (err) { next(err); }
});

// ─── POST /auth/reset-password ────────────────────────────────────────────────
router.post('/reset-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, password } = z.object({
      token: z.string(),
      password: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/),
    }).parse(req.body);
    await resetPassword(token, password);
    res.json({ success: true, message: 'Password reset successfully. Please login.' });
  } catch (err) { next(err); }
});

// ─── GET /auth/me ─────────────────────────────────────────────────────────────
router.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true, email: true, firstName: true, lastName: true, role: true,
        organizationId: true, phone: true, avatarUrl: true, department: true,
        jobTitle: true, twoFactorEnabled: true, emailVerified: true,
        status: true, lastLoginAt: true, preferences: true, createdAt: true,
        organization: { select: { id: true, name: true, status: true, logoUrl: true, allowedRails: true } },
      },
    });
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
});

// ─── POST /auth/2fa/setup ─────────────────────────────────────────────────────
router.post('/2fa/setup', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await setupTwoFactor(req.user!.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// ─── POST /auth/2fa/enable ────────────────────────────────────────────────────
router.post('/2fa/enable', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = z.object({ token: z.string().length(6) }).parse(req.body);
    await verifyAndEnableTwoFactor(req.user!.id, token);
    res.json({ success: true, message: '2FA enabled successfully' });
  } catch (err) { next(err); }
});

// ─── PUT /auth/change-password ────────────────────────────────────────────────
router.put('/change-password', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { currentPassword, newPassword } = z.object({
      currentPassword: z.string(),
      newPassword: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/),
    }).parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) { res.status(404).json({ success: false, message: 'User not found' }); return; }

    const { verifyPassword, hashPassword } = await import('../services/auth.service');
    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) { res.status(400).json({ success: false, error: { code: 'INVALID_PASSWORD', message: 'Current password is incorrect' } }); return; }

    const hash = await hashPassword(newPassword);
    await prisma.user.update({ where: { id: req.user!.id }, data: { passwordHash: hash, lastPasswordChange: new Date(), refreshTokens: [] } });
    res.json({ success: true, message: 'Password changed successfully. Please login again.' });
  } catch (err) { next(err); }
});

// ─── GET /auth/verify-email ───────────────────────────────────────────────────
router.get('/verify-email', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = z.object({ token: z.string() }).parse(req.query);
    const user = await prisma.user.findFirst({ where: { emailVerificationToken: token } });
    if (!user) { res.status(400).json({ success: false, message: 'Invalid verification token' }); return; }
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, emailVerificationToken: null, status: 'ACTIVE' },
    });
    res.json({ success: true, message: 'Email verified successfully' });
  } catch (err) { next(err); }
});

export default router;

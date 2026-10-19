import nodemailer from 'nodemailer';
import axios from 'axios';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { NotificationType } from '@prisma/client';

// ─── Email Transporter ────────────────────────────────────────────────────────
function getEmailTransporter() {
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
}

// ─── Send Email ───────────────────────────────────────────────────────────────
export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<boolean> {
  try {
    const transporter = getEmailTransporter();
    await transporter.sendMail({
      from: env.EMAIL_FROM,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });
    return true;
  } catch (err) {
    logger.error('Email send failed:', err);
    return false;
  }
}

// ─── Send SMS via Africa's Talking ───────────────────────────────────────────
export async function sendSMS(params: {
  to: string;
  message: string;
}): Promise<boolean> {
  try {
    const phone = params.to.startsWith('+') ? params.to : `+254${params.to.replace(/^0/, '')}`;
    const response = await axios.post(
      'https://api.africastalking.com/version1/messaging',
      new URLSearchParams({
        username: env.AT_USERNAME,
        to: phone,
        message: params.message,
        from: env.AT_SENDER_ID,
      }),
      {
        headers: {
          apiKey: env.AT_API_KEY || '',
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
    return response.status === 201;
  } catch (err) {
    logger.error('SMS send failed:', err);
    return false;
  }
}

// ─── Create In-App Notification ───────────────────────────────────────────────
export async function createInAppNotification(params: {
  organizationId?: string;
  userId?: string;
  transactionId?: string;
  subject: string;
  message: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await prisma.notification.create({
    data: {
      organizationId: params.organizationId,
      userId: params.userId,
      transactionId: params.transactionId,
      type: NotificationType.IN_APP,
      channel: 'in_app',
      recipient: params.userId || params.organizationId || 'system',
      subject: params.subject,
      message: params.message,
      metadata: params.metadata as any,
      isSent: true,
      sentAt: new Date(),
    },
  });
}

// ─── Notify Transaction Events ────────────────────────────────────────────────
export async function notifyTransactionUpdate(params: {
  transactionId: string;
  organizationId: string;
  userId: string;
  userEmail: string;
  userPhone?: string;
  subject: string;
  message: string;
  emailHtml: string;
}): Promise<void> {
  const { transactionId, organizationId, userId, userEmail, userPhone, subject, message, emailHtml } = params;

  await Promise.allSettled([
    sendEmail({ to: userEmail, subject, html: emailHtml, text: message }),
    userPhone ? sendSMS({ to: userPhone, message }) : Promise.resolve(),
    createInAppNotification({ organizationId, userId, transactionId, subject, message }),
  ]);
}

// ─── Notify Directors for Approval ───────────────────────────────────────────
export async function notifyDirectorsForApproval(params: {
  organizationId: string;
  transactionId: string;
  transactionRef: string;
  amount: number;
  currency: string;
  recipientName: string;
  makerName: string;
}): Promise<void> {
  const directors = await prisma.organizationDirector.findMany({
    where: { organizationId: params.organizationId, isActive: true },
    include: { user: { select: { email: true, phone: true, firstName: true } } },
  });

  const subject = `[ACTION REQUIRED] Director Approval — ${params.transactionRef}`;
  const html = emailTemplates.directorApprovalRequest(params);
  const smsMsg = `KenyaPay: Director approval needed. Ref: ${params.transactionRef}, Amount: KES ${params.amount.toLocaleString()}. Login to approve.`;

  await Promise.allSettled(
    directors.map(async (d) => {
      await sendEmail({ to: d.user.email, subject, html });
      if (d.user.phone) await sendSMS({ to: d.user.phone, message: smsMsg });
      await createInAppNotification({
        organizationId: params.organizationId,
        userId: d.userId,
        transactionId: params.transactionId,
        subject,
        message: smsMsg,
      });
    })
  );
}

// ─── Email Templates ──────────────────────────────────────────────────────────
export const emailTemplates = {
  welcomeEmail(params: { name: string; email: string; password?: string; verificationToken?: string }) {
    return `
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f5f5f5;">
<div style="background:#1a56db;padding:30px;text-align:center;">
  <h1 style="color:white;margin:0;">KenyaPay Platform</h1>
  <p style="color:#bfdbfe;margin:8px 0 0;">Multi-Rail Payment System</p>
</div>
<div style="background:white;padding:30px;border-radius:0 0 8px 8px;">
  <h2 style="color:#111827;">Welcome, ${params.name}!</h2>
  <p style="color:#6b7280;">Your account has been created on the KenyaPay Platform.</p>
  <p><strong>Email:</strong> ${params.email}</p>
  ${params.password ? `<p><strong>Temporary Password:</strong> <code style="background:#f3f4f6;padding:4px 8px;border-radius:4px;">${params.password}</code></p><p style="color:#ef4444;font-size:13px;">Please change your password immediately after login.</p>` : ''}
  ${params.verificationToken ? `<div style="text-align:center;margin:24px 0;"><a href="${process.env.FRONTEND_URL}/verify-email?token=${params.verificationToken}" style="background:#1a56db;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">Verify Email</a></div>` : ''}
  <p style="color:#6b7280;font-size:13px;margin-top:24px;">If you did not request this, please contact support immediately.</p>
</div>
</body></html>`;
  },

  passwordResetEmail(params: { name: string; resetToken: string }) {
    return `
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f5f5f5;">
<div style="background:#1a56db;padding:30px;text-align:center;">
  <h1 style="color:white;margin:0;">KenyaPay Platform</h1>
</div>
<div style="background:white;padding:30px;border-radius:0 0 8px 8px;">
  <h2 style="color:#111827;">Password Reset Request</h2>
  <p style="color:#6b7280;">Hi ${params.name}, we received a request to reset your password.</p>
  <div style="text-align:center;margin:24px 0;">
    <a href="${process.env.FRONTEND_URL}/reset-password?token=${params.resetToken}" style="background:#dc2626;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">Reset Password</a>
  </div>
  <p style="color:#6b7280;font-size:13px;">This link expires in 1 hour. If you did not request this, ignore this email.</p>
</div>
</body></html>`;
  },

  directorApprovalRequest(params: {
    transactionRef: string;
    amount: number;
    currency: string;
    recipientName: string;
    makerName: string;
  }) {
    return `
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f5f5f5;">
<div style="background:#dc2626;padding:30px;text-align:center;">
  <h1 style="color:white;margin:0;">⚠️ Director Approval Required</h1>
</div>
<div style="background:white;padding:30px;border-radius:0 0 8px 8px;">
  <p style="color:#111827;font-size:16px;">A payment transaction requires your approval before funds are disbursed.</p>
  <table style="width:100%;border-collapse:collapse;margin:20px 0;">
    <tr style="background:#f9fafb;"><td style="padding:10px 14px;color:#6b7280;border:1px solid #e5e7eb;">Reference</td><td style="padding:10px 14px;font-weight:600;border:1px solid #e5e7eb;">${params.transactionRef}</td></tr>
    <tr><td style="padding:10px 14px;color:#6b7280;border:1px solid #e5e7eb;">Amount</td><td style="padding:10px 14px;font-weight:600;color:#dc2626;border:1px solid #e5e7eb;">${params.currency} ${params.amount.toLocaleString()}</td></tr>
    <tr style="background:#f9fafb;"><td style="padding:10px 14px;color:#6b7280;border:1px solid #e5e7eb;">Recipient</td><td style="padding:10px 14px;font-weight:600;border:1px solid #e5e7eb;">${params.recipientName}</td></tr>
    <tr><td style="padding:10px 14px;color:#6b7280;border:1px solid #e5e7eb;">Initiated By</td><td style="padding:10px 14px;font-weight:600;border:1px solid #e5e7eb;">${params.makerName}</td></tr>
  </table>
  <div style="text-align:center;margin:24px 0;">
    <a href="${process.env.FRONTEND_URL}/directors/approvals" style="background:#16a34a;color:white;padding:14px 28px;text-decoration:none;border-radius:6px;display:inline-block;font-size:16px;font-weight:600;">Review & Approve</a>
  </div>
  <p style="color:#ef4444;font-size:13px;text-align:center;">⚠️ Funds will NOT be disbursed until you approve. Please review carefully.</p>
</div>
</body></html>`;
  },

  transactionCompleted(params: { name: string; ref: string; amount: number; currency: string; recipient: string; rail: string }) {
    return `
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f5f5f5;">
<div style="background:#16a34a;padding:30px;text-align:center;">
  <h1 style="color:white;margin:0;">✅ Payment Successful</h1>
</div>
<div style="background:white;padding:30px;border-radius:0 0 8px 8px;">
  <p>Hi ${params.name}, your payment of <strong>${params.currency} ${params.amount.toLocaleString()}</strong> to <strong>${params.recipient}</strong> via <strong>${params.rail}</strong> has been completed.</p>
  <p style="color:#6b7280;">Reference: <code>${params.ref}</code></p>
</div></body></html>`;
  },
};

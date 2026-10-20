import { prisma } from './prisma';
import { UserRole, NotificationType } from '@prisma/client';

interface NotifyDirectorsPayload {
  transactionId: string;
  organizationId: string;
  amount: number;
  supplierName?: string;
  reference?: string;
  message: string;
}

/**
 * Create in-app notifications for all DIRECTOR users in the organization
 * when a payment needs their approval.
 */
export async function notifyDirectorsForApproval(payload: NotifyDirectorsPayload) {
  try {
    const directors = await prisma.user.findMany({
      where: {
        organizationId: payload.organizationId,
        role: { in: [UserRole.DIRECTOR, UserRole.SUPER_ADMIN] },
        status: 'ACTIVE',
      },
      select: { id: true, email: true, phone: true },
    });

    if (directors.length === 0) return;

    const notifications = directors.map((dir) => ({
      organizationId: payload.organizationId,
      userId: dir.id,
      transactionId: payload.transactionId,
      type: NotificationType.IN_APP,
      channel: 'push',
      recipient: dir.email,
      subject: 'Payment Awaiting Your Approval',
      message: payload.message,
      metadata: {
        amount: payload.amount,
        supplierName: payload.supplierName,
        reference: payload.reference,
        sound: true,
        priority: 'high',
        action: 'APPROVAL_NEEDED',
      },
    }));

    await prisma.notification.createMany({ data: notifications });
  } catch (e) {
    console.error('[notifyDirectors] Error creating notifications:', e);
  }
}

/**
 * Create in-app notification for the maker when their payment is approved/rejected.
 */
export async function notifyMakerOfDecision(payload: {
  transactionId: string;
  organizationId: string;
  makerId: string;
  makerEmail: string;
  decision: 'approved' | 'rejected' | 'returned';
  message: string;
  amount?: number;
}) {
  try {
    await prisma.notification.create({
      data: {
        organizationId: payload.organizationId,
        userId: payload.makerId,
        transactionId: payload.transactionId,
        type: NotificationType.IN_APP,
        channel: 'push',
        recipient: payload.makerEmail,
        subject: payload.decision === 'approved'
          ? 'Payment Approved'
          : payload.decision === 'rejected'
          ? 'Payment Rejected'
          : 'Payment Returned',
        message: payload.message,
        metadata: {
          amount: payload.amount,
          decision: payload.decision,
          sound: true,
          priority: 'high',
          action: payload.decision === 'approved' ? 'APPROVAL_COMPLETED' : 'APPROVAL_REJECTED',
        },
      },
    });
  } catch (e) {
    console.error('[notifyMaker] Error creating notification:', e);
  }
}

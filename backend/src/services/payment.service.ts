import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';
import { logger } from '../config/logger';
import {
  PaymentRail, TransactionStatus, TransactionType, ApprovalAction
} from '@prisma/client';
import { reserveFunds, releaseFunds, debitWallet } from './wallet.service';
import { notifyDirectorsForApproval, notifyTransactionUpdate, emailTemplates } from './notification.service';
import { sendB2C, sendB2BPaybill, sendB2BTill } from './mpesa.service';
import { sendPesaLink, sendEquityJenga, sendKCBTransfer } from './bank.service';
import { encryptCredentials, decryptCredentials } from './encryption.service';
import { auditLog } from './audit.service';

// ─── Generate Transaction Reference ──────────────────────────────────────────
function generateRef(rail: PaymentRail): string {
  const prefix: Record<PaymentRail, string> = {
    MPESA_B2C: 'B2C',
    MPESA_B2B_PAYBILL: 'PBL',
    MPESA_B2B_TILL: 'TLL',
    PESALINK: 'PSL',
    RTGS: 'RTG',
    EQUITY_JENGA: 'JNG',
    KCB_OPEN_BANKING: 'KCB',
  };
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix[rail]}-${date}-${rand}`;
}

// ─── Get API credentials for the org ─────────────────────────────────────────
async function getOrgCredentials(organizationId: string, type: string) {
  const cred = await prisma.apiCredential.findFirst({
    where: { organizationId, type: type as never, isActive: true },
  });
  if (!cred) return null;
  return decryptCredentials(cred.credentials);
}

// ─── Initiate a Payment (Draft → Pending Checker) ────────────────────────────
export async function initiatePayment(params: {
  organizationId: string;
  makerId: string;
  walletId: string;
  rail: PaymentRail;
  amount: number;
  description: string;
  narration?: string;
  recipientName: string;
  recipientPhone?: string;
  recipientEmail?: string;
  recipientAccountNo?: string;
  recipientBankCode?: string;
  recipientBankName?: string;
  recipientBranchCode?: string;
  bankAccountId?: string;
  scheduledAt?: Date;
  metadata?: Record<string, unknown>;
}) {
  const org = await prisma.organization.findUnique({ where: { id: params.organizationId } });
  if (!org) throw new AppError('Organization not found', 404, 'ORG_NOT_FOUND');
  if (org.status !== 'ACTIVE') throw new AppError('Organization is not active', 403, 'ORG_NOT_ACTIVE');
  if (!org.allowedRails.includes(params.rail)) {
    throw new AppError(`Payment rail ${params.rail} is not enabled for your organization`, 422, 'RAIL_NOT_ENABLED');
  }
  if (params.amount > org.maxTransactionLimit) {
    throw new AppError(`Amount exceeds maximum transaction limit of KES ${org.maxTransactionLimit.toLocaleString()}`, 422, 'LIMIT_EXCEEDED');
  }

  // Compute charges (simple flat rate example — customize per rail)
  const chargeRate: Record<PaymentRail, number> = {
    MPESA_B2C: 0, MPESA_B2B_PAYBILL: 0, MPESA_B2B_TILL: 0,
    PESALINK: params.amount <= 999 ? 35 : params.amount <= 9999 ? 55 : 75,
    RTGS: 450, EQUITY_JENGA: 100, KCB_OPEN_BANKING: 100,
  };
  const charges = chargeRate[params.rail] || 0;
  const netAmount = params.amount + charges;

  // Reserve funds
  await reserveFunds(params.walletId, netAmount);

  const reference = generateRef(params.rail);
  const requiresDirector = org.requiresDirectorApproval && params.amount >= org.minApprovalAmount;
  const requiresChecker = org.makerCheckerEnabled;

  const tx = await prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.create({
      data: {
        organizationId: params.organizationId,
        walletId: params.walletId,
        bankAccountId: params.bankAccountId,
        makerId: params.makerId,
        reference,
        rail: params.rail,
        type: TransactionType.DEBIT,
        status: requiresChecker ? TransactionStatus.PENDING_CHECKER : TransactionStatus.PENDING_DIRECTOR,
        amount: params.amount,
        charges,
        netAmount,
        description: params.description,
        narration: params.narration,
        recipientName: params.recipientName,
        recipientPhone: params.recipientPhone,
        recipientEmail: params.recipientEmail,
        recipientAccountNo: params.recipientAccountNo,
        recipientBankCode: params.recipientBankCode,
        recipientBankName: params.recipientBankName,
        recipientBranchCode: params.recipientBranchCode,
        metadata: params.metadata,
        scheduledAt: params.scheduledAt,
      },
    });

    await tx.approvalWorkflow.create({
      data: {
        transactionId: transaction.id,
        organizationId: params.organizationId,
        requiresDirector,
        minDirectors: org.directorCount,
      },
    });

    return transaction;
  });

  await auditLog({
    organizationId: params.organizationId,
    userId: params.makerId,
    action: 'INITIATE_PAYMENT',
    resource: 'Transaction',
    resourceId: tx.id,
    description: `Payment initiated: ${reference} — KES ${params.amount.toLocaleString()} to ${params.recipientName}`,
    newValues: { reference, amount: params.amount, rail: params.rail },
  });

  logger.info(`Payment initiated: ${reference}`);
  return tx;
}

// ─── Checker Approval ─────────────────────────────────────────────────────────
export async function checkerApprove(params: {
  transactionId: string;
  checkerId: string;
  organizationId: string;
  action: ApprovalAction;
  note?: string;
}) {
  const workflow = await prisma.approvalWorkflow.findFirst({
    where: { transactionId: params.transactionId, organizationId: params.organizationId },
    include: { transaction: true },
  });
  if (!workflow) throw new AppError('Approval workflow not found', 404, 'WORKFLOW_NOT_FOUND');
  if (workflow.checkerAction) throw new AppError('Transaction already reviewed by checker', 409, 'ALREADY_REVIEWED');
  if (workflow.transaction.makerId === params.checkerId) {
    throw new AppError('Maker cannot check their own transaction', 403, 'SELF_APPROVAL_NOT_ALLOWED');
  }
  if (workflow.transaction.status !== TransactionStatus.PENDING_CHECKER) {
    throw new AppError('Transaction is not pending checker review', 409, 'INVALID_STATUS');
  }

  let newStatus: TransactionStatus;
  if (params.action === ApprovalAction.APPROVED) {
    newStatus = workflow.requiresDirector ? TransactionStatus.PENDING_DIRECTOR : TransactionStatus.PROCESSING;
  } else if (params.action === ApprovalAction.REJECTED) {
    newStatus = TransactionStatus.CHECKER_REJECTED;
  } else {
    newStatus = TransactionStatus.DRAFT; // RETURNED to maker
  }

  await prisma.$transaction([
    prisma.approvalWorkflow.update({
      where: { id: workflow.id },
      data: {
        checkerId: params.checkerId,
        checkerAction: params.action,
        checkerNote: params.note,
        checkerAt: new Date(),
      },
    }),
    prisma.transaction.update({
      where: { id: params.transactionId },
      data: { status: newStatus },
    }),
  ]);

  // If rejected, release reserved funds
  if (params.action === ApprovalAction.REJECTED) {
    await releaseFunds(workflow.transaction.walletId, workflow.transaction.netAmount);
  }

  // If approved and going to directors, notify them
  if (params.action === ApprovalAction.APPROVED && workflow.requiresDirector) {
    const maker = await prisma.user.findUnique({ where: { id: workflow.transaction.makerId }, select: { firstName: true, lastName: true } });
    await notifyDirectorsForApproval({
      organizationId: params.organizationId,
      transactionId: params.transactionId,
      transactionRef: workflow.transaction.reference,
      amount: workflow.transaction.amount,
      currency: workflow.transaction.currency,
      recipientName: workflow.transaction.recipientName,
      makerName: `${maker?.firstName} ${maker?.lastName}`,
    });
  }

  // If approved and no director needed, process it
  if (params.action === ApprovalAction.APPROVED && !workflow.requiresDirector) {
    await processPayment(params.transactionId, params.organizationId);
  }

  await auditLog({
    organizationId: params.organizationId,
    userId: params.checkerId,
    action: 'APPROVE',
    resource: 'Transaction',
    resourceId: params.transactionId,
    description: `Checker ${params.action}: ${workflow.transaction.reference}`,
    newValues: { action: params.action, note: params.note },
  });

  return prisma.transaction.findUnique({ where: { id: params.transactionId } });
}

// ─── Director Approval ────────────────────────────────────────────────────────
export async function directorApprove(params: {
  transactionId: string;
  directorId: string;
  organizationId: string;
  action: ApprovalAction;
  note?: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  const workflow = await prisma.approvalWorkflow.findFirst({
    where: { transactionId: params.transactionId, organizationId: params.organizationId },
    include: { transaction: true, directorApprovals: true },
  });
  if (!workflow) throw new AppError('Approval workflow not found', 404, 'WORKFLOW_NOT_FOUND');
  if (workflow.transaction.status !== TransactionStatus.PENDING_DIRECTOR) {
    throw new AppError('Transaction is not pending director approval', 409, 'INVALID_STATUS');
  }

  // Check director already voted
  const alreadyVoted = workflow.directorApprovals.some((a) => a.directorId === params.directorId);
  if (alreadyVoted) throw new AppError('You have already voted on this transaction', 409, 'ALREADY_VOTED');

  // Verify this user is an actual director for this org
  const directorProfile = await prisma.organizationDirector.findFirst({
    where: { organizationId: params.organizationId, userId: params.directorId, isActive: true },
  });
  if (!directorProfile) throw new AppError('You are not registered as a director for this organization', 403, 'NOT_A_DIRECTOR');

  await prisma.directorApproval.create({
    data: {
      transactionId: params.transactionId,
      approvalWorkflowId: workflow.id,
      directorId: params.directorId,
      action: params.action,
      note: params.note,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    },
  });

  if (params.action === ApprovalAction.REJECTED) {
    await prisma.transaction.update({
      where: { id: params.transactionId },
      data: { status: TransactionStatus.DIRECTOR_REJECTED },
    });
    await releaseFunds(workflow.transaction.walletId, workflow.transaction.netAmount);
  } else {
    const newApprovedCount = workflow.directorsApproved + 1;
    await prisma.approvalWorkflow.update({ where: { id: workflow.id }, data: { directorsApproved: newApprovedCount } });

    if (newApprovedCount >= workflow.minDirectors) {
      await prisma.transaction.update({ where: { id: params.transactionId }, data: { status: TransactionStatus.DIRECTOR_APPROVED } });
      await processPayment(params.transactionId, params.organizationId);
    }
  }

  await auditLog({
    organizationId: params.organizationId,
    userId: params.directorId,
    action: 'DIRECTOR_APPROVAL',
    resource: 'Transaction',
    resourceId: params.transactionId,
    description: `Director ${params.action}: ${workflow.transaction.reference}`,
    newValues: { action: params.action, note: params.note },
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });

  return prisma.transaction.findUnique({ where: { id: params.transactionId } });
}

// ─── Process Payment (send to rail) ──────────────────────────────────────────
export async function processPayment(transactionId: string, organizationId: string): Promise<void> {
  const tx = await prisma.transaction.findUnique({ where: { id: transactionId } });
  if (!tx) throw new AppError('Transaction not found', 404, 'NOT_FOUND');

  await prisma.transaction.update({ where: { id: transactionId }, data: { status: TransactionStatus.PROCESSING, processedAt: new Date() } });

  try {
    let externalRef = '';
    let railResult: { conversationId?: string; transactionRef?: string } = {};

    const mpesaCreds = await getOrgCredentials(organizationId, 'MPESA_DARAJA');
    const pesalinkCreds = await getOrgCredentials(organizationId, 'PESALINK');
    const jengaCreds = await getOrgCredentials(organizationId, 'EQUITY_JENGA');
    const kcbCreds = await getOrgCredentials(organizationId, 'KCB_OPEN_BANKING');

    switch (tx.rail) {
      case PaymentRail.MPESA_B2C: {
        const res = await sendB2C({
          phoneNumber: tx.recipientPhone!,
          amount: tx.amount,
          occasion: tx.description,
          remarks: tx.narration || tx.description,
          credentials: mpesaCreds ? {
            consumerKey: mpesaCreds.consumerKey,
            consumerSecret: mpesaCreds.consumerSecret,
            initiatorName: mpesaCreds.initiatorName,
            initiatorPassword: mpesaCreds.initiatorPassword,
            shortcode: mpesaCreds.shortcode,
            baseUrl: mpesaCreds.baseUrl,
          } : undefined,
        });
        railResult = { conversationId: res.conversationId };
        externalRef = res.conversationId;
        break;
      }
      case PaymentRail.MPESA_B2B_PAYBILL: {
        const res = await sendB2BPaybill({
          receiverShortcode: tx.recipientAccountNo!,
          amount: tx.amount,
          accountReference: tx.reference,
          remarks: tx.narration || tx.description,
          credentials: mpesaCreds ? {
            consumerKey: mpesaCreds.consumerKey,
            consumerSecret: mpesaCreds.consumerSecret,
            initiatorName: mpesaCreds.initiatorName,
            initiatorPassword: mpesaCreds.initiatorPassword,
            shortcode: mpesaCreds.shortcode,
            baseUrl: mpesaCreds.baseUrl,
          } : undefined,
        });
        railResult = { conversationId: res.conversationId };
        externalRef = res.conversationId;
        break;
      }
      case PaymentRail.MPESA_B2B_TILL: {
        const res = await sendB2BTill({
          tillNumber: tx.recipientAccountNo!,
          amount: tx.amount,
          remarks: tx.narration || tx.description,
          credentials: mpesaCreds ? {
            consumerKey: mpesaCreds.consumerKey,
            consumerSecret: mpesaCreds.consumerSecret,
            initiatorName: mpesaCreds.initiatorName,
            initiatorPassword: mpesaCreds.initiatorPassword,
            shortcode: mpesaCreds.shortcode,
            baseUrl: mpesaCreds.baseUrl,
          } : undefined,
        });
        railResult = { conversationId: res.conversationId };
        externalRef = res.conversationId;
        break;
      }
      case PaymentRail.PESALINK: {
        const res = await sendPesaLink({
          amount: tx.amount,
          accountNumber: tx.recipientAccountNo!,
          bankCode: tx.recipientBankCode!,
          accountName: tx.recipientName,
          reference: tx.reference,
          narration: tx.narration || tx.description,
          credentials: pesalinkCreds ? {
            clientId: pesalinkCreds.clientId,
            clientSecret: pesalinkCreds.clientSecret,
            baseUrl: pesalinkCreds.baseUrl,
          } : undefined,
        });
        railResult = { transactionRef: res.transactionRef };
        externalRef = res.transactionRef;
        break;
      }
      case PaymentRail.EQUITY_JENGA:
      case PaymentRail.RTGS: {
        const res = await sendEquityJenga({
          amount: tx.amount,
          accountNumber: tx.recipientAccountNo!,
          bankCode: tx.recipientBankCode!,
          accountName: tx.recipientName,
          reference: tx.reference,
          narration: tx.narration || tx.description,
          credentials: jengaCreds ? {
            apiKey: jengaCreds.apiKey,
            merchantCode: jengaCreds.merchantCode,
            consumerSecret: jengaCreds.consumerSecret,
            baseUrl: jengaCreds.baseUrl,
          } : undefined,
        });
        railResult = { transactionRef: res.transactionRef };
        externalRef = res.transactionRef;
        break;
      }
      case PaymentRail.KCB_OPEN_BANKING: {
        const res = await sendKCBTransfer({
          amount: tx.amount,
          accountNumber: tx.recipientAccountNo!,
          bankCode: tx.recipientBankCode!,
          accountName: tx.recipientName,
          reference: tx.reference,
          narration: tx.narration || tx.description,
          credentials: kcbCreds ? {
            clientId: kcbCreds.clientId,
            clientSecret: kcbCreds.clientSecret,
            baseUrl: kcbCreds.baseUrl,
          } : undefined,
        });
        railResult = { transactionRef: res.transactionRef };
        externalRef = res.transactionRef;
        break;
      }
    }

    await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        externalReference: externalRef,
        mpesaConversationId: railResult.conversationId,
        pesaLinkRef: tx.rail === PaymentRail.PESALINK ? externalRef : undefined,
        rtgsRef: tx.rail === PaymentRail.RTGS ? externalRef : undefined,
      },
    });

    // For synchronous rails (PesaLink, Bank), mark completed immediately
    if ([PaymentRail.PESALINK, PaymentRail.EQUITY_JENGA, PaymentRail.RTGS, PaymentRail.KCB_OPEN_BANKING].includes(tx.rail)) {
      await markTransactionCompleted(transactionId, externalRef, organizationId);
    }
    // M-Pesa results come via webhook callback

  } catch (err) {
    logger.error(`Payment processing failed for ${transactionId}:`, err);
    await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: TransactionStatus.FAILED,
        failureReason: err instanceof Error ? err.message : 'Payment rail error',
      },
    });
    await releaseFunds(tx.walletId, tx.netAmount);
    throw err;
  }
}

// ─── Mark Transaction Completed ───────────────────────────────────────────────
export async function markTransactionCompleted(transactionId: string, externalRef: string, organizationId: string): Promise<void> {
  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: { maker: { select: { email: true, phone: true, firstName: true } } },
  });
  if (!tx) return;

  await prisma.transaction.update({
    where: { id: transactionId },
    data: {
      status: TransactionStatus.COMPLETED,
      completedAt: new Date(),
      externalReference: externalRef,
    },
  });

  await debitWallet(
    tx.walletId,
    transactionId,
    tx.netAmount,
    `Payment to ${tx.recipientName} — ${tx.reference}`,
    tx.reference
  );

  const html = emailTemplates.transactionCompleted({
    name: tx.maker.firstName,
    ref: tx.reference,
    amount: tx.amount,
    currency: tx.currency,
    recipient: tx.recipientName,
    rail: tx.rail,
  });

  await notifyTransactionUpdate({
    transactionId,
    organizationId,
    userId: tx.makerId,
    userEmail: tx.maker.email,
    userPhone: tx.maker.phone || undefined,
    subject: `✅ Payment Completed — ${tx.reference}`,
    message: `Your payment of KES ${tx.amount.toLocaleString()} to ${tx.recipientName} has been completed. Ref: ${tx.reference}`,
    emailHtml: html,
  });
}

// ─── Get Transactions ─────────────────────────────────────────────────────────
export async function getTransactions(params: {
  organizationId: string;
  status?: TransactionStatus;
  rail?: PaymentRail;
  startDate?: Date;
  endDate?: Date;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const { organizationId, status, rail, startDate, endDate, search, page = 1, limit = 20 } = params;
  const skip = (page - 1) * limit;

  const where = {
    organizationId,
    ...(status && { status }),
    ...(rail && { rail }),
    ...(startDate || endDate ? { createdAt: { ...(startDate && { gte: startDate }), ...(endDate && { lte: endDate }) } } : {}),
    ...(search ? {
      OR: [
        { reference: { contains: search, mode: 'insensitive' as const } },
        { recipientName: { contains: search, mode: 'insensitive' as const } },
        { recipientPhone: { contains: search, mode: 'insensitive' as const } },
        { recipientAccountNo: { contains: search, mode: 'insensitive' as const } },
      ],
    } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        maker: { select: { id: true, firstName: true, lastName: true, email: true } },
        approvalWorkflow: {
          include: {
            checker: { select: { id: true, firstName: true, lastName: true } },
            directorApprovals: {
              include: { director: { select: { id: true, firstName: true, lastName: true } } },
            },
          },
        },
        wallet: { select: { id: true, name: true, type: true } },
      },
    }),
    prisma.transaction.count({ where }),
  ]);

  return { data, total, page, limit, pages: Math.ceil(total / limit) };
}

// ─── Get Pending Approvals (for checker queue) ───────────────────────────────
export async function getPendingApprovals(organizationId: string, checkerId: string) {
  return prisma.transaction.findMany({
    where: {
      organizationId,
      status: TransactionStatus.PENDING_CHECKER,
      makerId: { not: checkerId },
    },
    orderBy: { createdAt: 'asc' },
    include: {
      maker: { select: { id: true, firstName: true, lastName: true, email: true } },
      wallet: { select: { id: true, name: true, type: true } },
      approvalWorkflow: true,
    },
  });
}

// ─── Get Pending Director Approvals ──────────────────────────────────────────
export async function getPendingDirectorApprovals(organizationId: string, directorId: string) {
  const votedIds = await prisma.directorApproval.findMany({
    where: { directorId },
    select: { transactionId: true },
  });
  const votedTransactionIds = votedIds.map((v) => v.transactionId);

  return prisma.transaction.findMany({
    where: {
      organizationId,
      status: TransactionStatus.PENDING_DIRECTOR,
      id: { notIn: votedTransactionIds },
    },
    orderBy: { createdAt: 'asc' },
    include: {
      maker: { select: { id: true, firstName: true, lastName: true, email: true } },
      wallet: { select: { id: true, name: true, type: true } },
      approvalWorkflow: {
        include: {
          checker: { select: { id: true, firstName: true, lastName: true } },
          directorApprovals: {
            include: { director: { select: { id: true, firstName: true, lastName: true } } },
          },
        },
      },
    },
  });
}

// ─── Cancel Transaction ───────────────────────────────────────────────────────
export async function cancelTransaction(transactionId: string, userId: string, organizationId: string, reason: string): Promise<void> {
  const tx = await prisma.transaction.findFirst({
    where: { id: transactionId, organizationId },
  });
  if (!tx) throw new AppError('Transaction not found', 404, 'NOT_FOUND');

  const cancelableStatuses: TransactionStatus[] = [
    TransactionStatus.DRAFT,
    TransactionStatus.PENDING_CHECKER,
    TransactionStatus.CHECKER_APPROVED,
    TransactionStatus.PENDING_DIRECTOR,
  ];
  if (!cancelableStatuses.includes(tx.status)) {
    throw new AppError('Transaction cannot be cancelled at this stage', 409, 'CANNOT_CANCEL');
  }
  if (tx.makerId !== userId) {
    throw new AppError('Only the maker can cancel this transaction', 403, 'NOT_AUTHORIZED');
  }

  await prisma.transaction.update({
    where: { id: transactionId },
    data: { status: TransactionStatus.CANCELLED, failureReason: reason },
  });
  await releaseFunds(tx.walletId, tx.netAmount);

  await auditLog({
    organizationId,
    userId,
    action: 'CANCEL_PAYMENT',
    resource: 'Transaction',
    resourceId: transactionId,
    description: `Transaction cancelled: ${tx.reference} — Reason: ${reason}`,
  });
}

// ─── Dashboard Summary ────────────────────────────────────────────────────────
export async function getDashboardSummary(organizationId: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

  const [
    totalTxToday, totalTxMonth, completedToday, completedMonth,
    pendingChecker, pendingDirector, failedMonth,
    totalAmountToday, totalAmountMonth, lastMonthAmount,
    byRail, byStatus,
  ] = await Promise.all([
    prisma.transaction.count({ where: { organizationId, createdAt: { gte: today } } }),
    prisma.transaction.count({ where: { organizationId, createdAt: { gte: monthStart } } }),
    prisma.transaction.count({ where: { organizationId, status: TransactionStatus.COMPLETED, completedAt: { gte: today } } }),
    prisma.transaction.count({ where: { organizationId, status: TransactionStatus.COMPLETED, completedAt: { gte: monthStart } } }),
    prisma.transaction.count({ where: { organizationId, status: TransactionStatus.PENDING_CHECKER } }),
    prisma.transaction.count({ where: { organizationId, status: TransactionStatus.PENDING_DIRECTOR } }),
    prisma.transaction.count({ where: { organizationId, status: TransactionStatus.FAILED, createdAt: { gte: monthStart } } }),
    prisma.transaction.aggregate({ where: { organizationId, status: TransactionStatus.COMPLETED, completedAt: { gte: today } }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { organizationId, status: TransactionStatus.COMPLETED, completedAt: { gte: monthStart } }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { organizationId, status: TransactionStatus.COMPLETED, completedAt: { gte: lastMonthStart, lte: lastMonthEnd } }, _sum: { amount: true } }),
    prisma.transaction.groupBy({ by: ['rail'], where: { organizationId, createdAt: { gte: monthStart } }, _count: { _all: true }, _sum: { amount: true } }),
    prisma.transaction.groupBy({ by: ['status'], where: { organizationId, createdAt: { gte: monthStart } }, _count: { _all: true } }),
  ]);

  const thisMonth = totalAmountMonth._sum.amount || 0;
  const lastMonth = lastMonthAmount._sum.amount || 0;
  const growth = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : 0;

  return {
    today: { transactions: totalTxToday, completed: completedToday, amount: totalAmountToday._sum.amount || 0 },
    month: { transactions: totalTxMonth, completed: completedMonth, amount: thisMonth, failed: failedMonth, growth: Math.round(growth * 100) / 100 },
    pending: { checker: pendingChecker, director: pendingDirector },
    byRail,
    byStatus,
  };
}

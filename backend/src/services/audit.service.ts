import { prisma } from '../config/database';
import { AuditAction } from '@prisma/client';

interface AuditLogInput {
  organizationId?: string;
  userId?: string;
  action: AuditAction;
  resource?: string;
  resourceId?: string;
  oldValues?: unknown;
  newValues?: unknown;
  ipAddress?: string;
  userAgent?: string;
  description: string;
  metadata?: unknown;
}

export async function auditLog(data: AuditLogInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        organizationId: data.organizationId,
        userId: data.userId,
        action: data.action,
        resource: data.resource,
        resourceId: data.resourceId,
        oldValues: data.oldValues ? (data.oldValues as object) : undefined,
        newValues: data.newValues ? (data.newValues as object) : undefined,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        description: data.description,
        metadata: data.metadata ? (data.metadata as object) : undefined,
      },
    });
  } catch (err) {
    // Never let audit logging crash the main flow
    console.error('Audit log failed:', err);
  }
}

export async function getAuditLogs(params: {
  organizationId?: string;
  userId?: string;
  action?: AuditAction;
  resource?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}) {
  const { organizationId, userId, action, resource, startDate, endDate, page = 1, limit = 50 } = params;
  const skip = (page - 1) * limit;

  const where = {
    ...(organizationId && { organizationId }),
    ...(userId && { userId }),
    ...(action && { action }),
    ...(resource && { resource }),
    ...(startDate || endDate
      ? {
          createdAt: {
            ...(startDate && { gte: startDate }),
            ...(endDate && { lte: endDate }),
          },
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { data, total, page, limit, pages: Math.ceil(total / limit) };
}

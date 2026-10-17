import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth';
import { UserRole } from '@prisma/client';
import { getAuditLogs } from '../services/audit.service';
import { AppError } from '../utils/AppError';
import { AuditAction } from '@prisma/client';

const router = Router();
router.use(authenticate);

// ─── GET /audit — list audit logs ─────────────────────────────────────────────
router.get('/', authorize(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.FINANCE_MANAGER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = '1', limit = '50', userId, action, resource, startDate, endDate } = req.query as Record<string, string>;
    const isSuperAdmin = req.user!.role === UserRole.SUPER_ADMIN;
    const orgId = isSuperAdmin ? undefined : req.user!.organizationId || undefined;

    const result = await getAuditLogs({
      organizationId: orgId,
      userId: userId || undefined,
      action: action as AuditAction | undefined,
      resource: resource || undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });

    res.json({ success: true, ...result });
  } catch (err) { next(err); }
});

export default router;

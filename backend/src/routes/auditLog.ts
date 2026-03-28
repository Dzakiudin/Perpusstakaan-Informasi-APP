import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, adminOnly, AuthRequest } from '../middleware/auth';

const router: Router = Router();
const prisma = new PrismaClient();

// Helper to log actions
export async function logAction(
    userId: number | null,
    action: string,
    entity: string,
    entityId: number | null,
    details?: any,
    req?: any
) {
    try {
        await prisma.auditLog.create({
            data: {
                userId,
                action,
                entity,
                entityId,
                details: details ? JSON.stringify(details) : null,
                ipAddress: req?.ip || req?.connection?.remoteAddress || null,
                userAgent: req?.headers?.['user-agent'] || null,
            },
        });
    } catch (error) {
        console.error('Failed to log action:', error);
    }
}

// Get audit logs with pagination and filters
router.get('/', authMiddleware, adminOnly, async (req: AuthRequest, res) => {
    try {
        const { page = '1', limit = '50', action, entity, userId, startDate, endDate } = req.query;
        const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

        const where: any = {};
        if (action) where.action = action;
        if (entity) where.entity = entity;
        if (userId) where.userId = parseInt(userId as string);
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = new Date(startDate as string);
            if (endDate) where.createdAt.lte = new Date(endDate as string);
        }

        const [logs, total] = await Promise.all([
            prisma.auditLog.findMany({
                where,
                skip,
                take: parseInt(limit as string),
                include: { user: { select: { id: true, name: true, email: true } } },
                orderBy: { createdAt: 'desc' },
            }),
            prisma.auditLog.count({ where }),
        ]);

        res.json({
            data: logs.map(log => ({
                ...log,
                details: log.details ? JSON.parse(log.details) : null,
            })),
            pagination: {
                page: parseInt(page as string),
                limit: parseInt(limit as string),
                total,
                totalPages: Math.ceil(total / parseInt(limit as string)),
            },
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get audit logs' });
    }
});

// Get action summary for dashboard
router.get('/summary', authMiddleware, adminOnly, async (req: AuthRequest, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [todayCount, actionCounts, recentLogs] = await Promise.all([
            prisma.auditLog.count({
                where: { createdAt: { gte: today } },
            }),
            prisma.auditLog.groupBy({
                by: ['action'],
                _count: { id: true },
            }),
            prisma.auditLog.findMany({
                take: 10,
                include: { user: { select: { name: true } } },
                orderBy: { createdAt: 'desc' },
            }),
        ]);

        res.json({
            todayCount,
            actionCounts: actionCounts.map(ac => ({
                action: ac.action,
                count: ac._count.id,
            })),
            recentLogs: recentLogs.map(log => ({
                ...log,
                details: log.details ? JSON.parse(log.details) : null,
            })),
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get audit summary' });
    }
});

export default router;

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface AuditLogData {
    userId?: number;
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'LOAN' | 'RETURN';
    entity: string;
    entityId?: number;
    details?: object;
    ipAddress?: string;
    userAgent?: string;
}

export async function logAudit(data: AuditLogData): Promise<void> {
    try {
        await prisma.auditLog.create({
            data: {
                userId: data.userId,
                action: data.action,
                entity: data.entity,
                entityId: data.entityId,
                details: data.details ? JSON.stringify(data.details) : null,
                ipAddress: data.ipAddress,
                userAgent: data.userAgent,
            },
        });
    } catch (error) {
        console.error('Failed to create audit log:', error);
        // Don't throw - logging should not break the main flow
    }
}

export function getClientInfo(req: any): { ipAddress: string; userAgent: string } {
    return {
        ipAddress: req.ip || req.headers['x-forwarded-for'] || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
    };
}

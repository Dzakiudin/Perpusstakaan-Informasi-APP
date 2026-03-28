import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, adminOnly, pustakawanOrAdmin, AuthRequest } from '../middleware/auth';

const router: Router = Router();
const prisma = new PrismaClient();

// Get all classes with search, filter, sort, pagination
router.get('/', authMiddleware, pustakawanOrAdmin, async (req: AuthRequest, res) => {
    try {
        const {
            search,
            hasWali,
            memberCount,
            sortBy = 'name',
            sortOrder = 'asc',
            page,
            limit,
        } = req.query;

        const where: any = {};

        // Search by name or waliKelas
        if (search) {
            where.OR = [
                { name: { contains: search as string } },
                { waliKelas: { contains: search as string } },
            ];
        }

        // Filter by wali kelas status
        if (hasWali === 'yes') {
            where.waliKelas = { not: null };
            // Also exclude empty string
            if (!where.AND) where.AND = [];
            where.AND.push({ waliKelas: { not: '' } });
        } else if (hasWali === 'no') {
            where.OR = [
                { waliKelas: null },
                { waliKelas: '' },
            ];
            // If search is also active, we need to restructure
            if (search) {
                where.AND = [
                    {
                        OR: [
                            { name: { contains: search as string } },
                            { waliKelas: { contains: search as string } },
                        ],
                    },
                    {
                        OR: [
                            { waliKelas: null },
                            { waliKelas: '' },
                        ],
                    },
                ];
                delete where.OR;
            }
        }

        // Filter by member count status
        if (memberCount === 'gt0') {
            where.members = { some: {} };
        } else if (memberCount === 'eq0') {
            where.members = { none: {} };
        }

        // Determine orderBy
        let orderBy: any = { name: 'asc' };
        const order = sortOrder === 'desc' ? 'desc' : 'asc';
        if (sortBy === 'name') {
            orderBy = { name: order };
        } else if (sortBy === 'memberCount') {
            orderBy = { members: { _count: order } };
        }

        // If paginated request
        if (page && limit) {
            const pageNum = parseInt(page as string);
            const limitNum = parseInt(limit as string);
            const skip = (pageNum - 1) * limitNum;

            const [classes, total] = await Promise.all([
                prisma.class.findMany({
                    where,
                    include: {
                        _count: { select: { members: true } },
                    },
                    orderBy,
                    skip,
                    take: limitNum,
                }),
                prisma.class.count({ where }),
            ]);

            return res.json({
                data: classes,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    totalPages: Math.ceil(total / limitNum),
                },
            });
        }

        // Non-paginated (for dropdowns etc.)
        const result = await prisma.class.findMany({
            where,
            include: {
                _count: { select: { members: true } },
            },
            orderBy,
        });

        res.json(result);
    } catch (error) {
        console.error('Get classes error:', error);
        res.status(500).json({ error: 'Failed to get classes' });
    }
});

// Bulk delete classes
router.post('/bulk-delete', authMiddleware, pustakawanOrAdmin, async (req: AuthRequest, res) => {
    try {
        const { ids, selectAll, excludeIds, filters } = req.body;

        let where: any = {};

        if (selectAll && filters) {
            if (filters.search) {
                where.OR = [
                    { name: { contains: filters.search } },
                    { waliKelas: { contains: filters.search } },
                ];
            }
            if (excludeIds && Array.isArray(excludeIds) && excludeIds.length > 0) {
                where.id = { notIn: excludeIds };
            }
        } else if (ids && Array.isArray(ids) && ids.length > 0) {
            where.id = { in: ids };
        } else {
            return res.status(400).json({ error: 'Pilih minimal 1 kelas untuk dihapus' });
        }

        const targetClasses = await prisma.class.findMany({
            where,
            select: { id: true, name: true, _count: { select: { members: true } } },
        });

        if (targetClasses.length === 0) {
            return res.status(404).json({ error: 'Tidak ada kelas yang dipilih' });
        }

        const targetIds = targetClasses.map(c => c.id);
        const totalMembers = targetClasses.reduce((sum, c) => sum + (c._count?.members || 0), 0);

        // Delete all target classes (members get classId = null via SetNull)
        await prisma.class.deleteMany({
            where: { id: { in: targetIds } },
        });

        res.json({
            deleted: targetIds.length,
            membersAffected: totalMembers,
            message: `${targetIds.length} kelas berhasil dihapus.${totalMembers > 0 ? ` ${totalMembers} anggota dipindahkan ke tanpa kelas.` : ''}`,
        });
    } catch (error) {
        console.error('Bulk delete classes error:', error);
        res.status(500).json({ error: 'Gagal menghapus kelas' });
    }
});

// Get class by ID
router.get('/:id', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const classData = await prisma.class.findUnique({
            where: { id: parseInt(req.params.id) },
            include: {
                members: true,
                _count: { select: { members: true } },
            },
        });

        if (!classData) {
            return res.status(404).json({ error: 'Class not found' });
        }

        res.json(classData);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get class' });
    }
});

// Create class
router.post('/', authMiddleware, pustakawanOrAdmin, async (req: AuthRequest, res) => {
    try {
        const { name, waliKelas } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Class name is required' });
        }

        const classData = await prisma.class.create({
            data: { name, waliKelas },
        });

        res.status(201).json(classData);
    } catch (error: any) {
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Class name already exists' });
        }
        res.status(500).json({ error: 'Failed to create class' });
    }
});

// Update class
router.put('/:id', authMiddleware, pustakawanOrAdmin, async (req: AuthRequest, res) => {
    try {
        const { name, waliKelas } = req.body;

        const classData = await prisma.class.update({
            where: { id: parseInt(req.params.id) },
            data: { name, waliKelas },
        });

        res.json(classData);
    } catch (error: any) {
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Class name already exists' });
        }
        res.status(500).json({ error: 'Failed to update class' });
    }
});

// Delete class
router.delete('/:id', authMiddleware, pustakawanOrAdmin, async (req: AuthRequest, res) => {
    try {
        const classId = parseInt(req.params.id);

        // Get class info
        const classData = await prisma.class.findUnique({
            where: { id: classId },
            include: { _count: { select: { members: true } } },
        });

        if (!classData) {
            return res.status(404).json({ error: 'Kelas tidak ditemukan' });
        }

        // Delete class - members will have classId set to NULL automatically (onDelete: SetNull)
        await prisma.class.delete({
            where: { id: classId },
        });

        res.json({
            message: `Kelas berhasil dihapus.${classData._count.members > 0 ? ` ${classData._count.members} anggota dipindahkan ke tanpa kelas.` : ''}`
        });
    } catch (error) {
        console.error('Delete class error:', error);
        res.status(500).json({ error: 'Gagal menghapus kelas' });
    }
});

export default router;

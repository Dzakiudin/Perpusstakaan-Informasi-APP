import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, adminOnly, pustakawanOrAdmin, AuthRequest } from '../middleware/auth';

const router: Router = Router();
const prisma = new PrismaClient();

// Get all settings
router.get('/', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const settings = await prisma.settings.findMany();

        // Convert to key-value object
        const settingsObj: { [key: string]: { value: string; description: string | null } } = {};
        settings.forEach(s => {
            settingsObj[s.key] = { value: s.value, description: s.description };
        });

        res.json(settingsObj);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get settings' });
    }
});

// Update a setting (admin or pustakawan)
router.put('/:key', authMiddleware, pustakawanOrAdmin, async (req: AuthRequest, res) => {
    try {
        const { key } = req.params;
        const { value, description } = req.body;

        const setting = await prisma.settings.upsert({
            where: { key },
            update: { value, description },
            create: { key, value, description },
        });

        res.json(setting);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update setting' });
    }
});

// Initialize default settings
router.post('/init', authMiddleware, pustakawanOrAdmin, async (req: AuthRequest, res) => {
    try {
        const defaultSettings = [
            { key: 'fine_rate_per_day', value: '500', description: 'Denda per hari keterlambatan (Rp)' },
            { key: 'max_loan_days', value: '7', description: 'Maksimal hari peminjaman' },
            { key: 'max_books_per_loan', value: '3', description: 'Maksimal buku per peminjaman' },
            { key: 'library_name', value: 'Perpustakaan Sekolah', description: 'Nama perpustakaan' },
            { key: 'library_address', value: '', description: 'Alamat perpustakaan' },
            { key: 'notification_email', value: '', description: 'Email untuk notifikasi' },
        ];

        for (const setting of defaultSettings) {
            await prisma.settings.upsert({
                where: { key: setting.key },
                update: {},
                create: setting,
            });
        }

        const settings = await prisma.settings.findMany();
        res.json({ message: 'Settings initialized', settings });
    } catch (error) {
        res.status(500).json({ error: 'Failed to initialize settings' });
    }
});

export default router;

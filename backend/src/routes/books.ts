import { Router } from 'express';
import { authMiddleware, pustakawanOrAdmin } from '../middleware/auth';
import { bookController } from '../controllers/book.controller';
import multer from 'multer';
import ExcelJS from 'exceljs';
import { PrismaClient } from '@prisma/client';

const router: Router = Router();
const prisma = new PrismaClient();

// Configure multer for file upload
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter(req, file, cb) {
        if (!file.originalname.match(/\.(xlsx|xls)$/)) {
            return cb(new Error('Hanya file Excel (.xlsx, .xls) yang diperbolehkan'));
        }
        cb(null, true);
    },
});

// Basic CRUD leveraging controller
router.get('/', authMiddleware, pustakawanOrAdmin, bookController.getAll);
router.get('/meta/categories', authMiddleware, bookController.getCategories);
router.get('/:id', authMiddleware, bookController.getById);
router.get('/barcode/:barcode', authMiddleware, bookController.getByBarcode);
router.post('/', authMiddleware, pustakawanOrAdmin, bookController.create);
router.post('/bulk-delete', authMiddleware, pustakawanOrAdmin, bookController.bulkDelete);
router.put('/:id', authMiddleware, pustakawanOrAdmin, bookController.update);
router.delete('/:id', authMiddleware, pustakawanOrAdmin, bookController.delete);
router.get('/:id/barcode.png', authMiddleware, bookController.getBarcode);
router.get('/:id/qrcode.png', authMiddleware, bookController.getQrCode);

// Complex routes (to be refactored into service/controller later if needed)
// Placeholder for Export/Import logic which is currently still in routes for simplicity during refactor

// Download template
router.get('/import/template', authMiddleware, async (req: any, res) => {
    try {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Template Buku');
        sheet.columns = [
            { header: 'ISBN / Barcode *', key: 'isbn', width: 20 },
            { header: 'Judul Buku *', key: 'title', width: 35 },
            { header: 'Pengarang *', key: 'author', width: 25 },
            { header: 'Penerbit', key: 'publisher', width: 25 },
            { header: 'Kategori', key: 'category', width: 20 },
            { header: 'Lokasi Rak', key: 'rackLocation', width: 15 },
            { header: 'Jumlah Eksemplar', key: 'totalCopies', width: 18 },
        ];
        sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } };
        sheet.addRow({ isbn: '9786020331234', title: 'Laskar Pelangi', author: 'Andrea Hirata', publisher: 'Bentang Pustaka', category: 'Novel', rackLocation: 'A1', totalCopies: 2 });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="template-import-buku.xlsx"');
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        res.status(500).json({ error: 'Gagal membuat template' });
    }
});

// Import books from Excel
router.post('/import', authMiddleware, pustakawanOrAdmin, upload.single('file'), bookController.import);

export default router;

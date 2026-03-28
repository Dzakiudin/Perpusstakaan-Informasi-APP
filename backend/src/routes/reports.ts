import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import ExcelJS from 'exceljs';

const router: Router = Router();
const prisma = new PrismaClient();

// Export Books Report
router.get('/books', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const { category } = req.query;

        const where: any = {};
        if (category) {
            where.category = category;
        }

        const books = await prisma.book.findMany({
            where,
            orderBy: { title: 'asc' },
        });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Data Buku');

        worksheet.columns = [
            { header: 'No', key: 'no', width: 5 },
            { header: 'ISBN', key: 'isbn', width: 15 },
            { header: 'Barcode', key: 'barcode', width: 15 },
            { header: 'Judul', key: 'title', width: 40 },
            { header: 'Pengarang', key: 'author', width: 25 },
            { header: 'Penerbit', key: 'publisher', width: 20 },
            { header: 'Kategori', key: 'category', width: 15 },
            { header: 'Lokasi Rak', key: 'rackLocation', width: 12 },
            { header: 'Total', key: 'totalCopies', width: 8 },
            { header: 'Tersedia', key: 'availableCopies', width: 10 },
        ];

        // Style header
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF3B82F6' },
        };
        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

        books.forEach((book, index) => {
            worksheet.addRow({
                no: index + 1,
                isbn: book.isbn,
                barcode: book.barcode,
                title: book.title,
                author: book.author,
                publisher: book.publisher || '-',
                category: book.category || '-',
                rackLocation: book.rackLocation || '-',
                totalCopies: book.totalCopies,
                availableCopies: book.availableCopies,
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=laporan-buku.xlsx');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Export books error:', error);
        res.status(500).json({ error: 'Failed to export books report' });
    }
});

// Export Members Report
router.get('/members', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const { classId, status } = req.query;
        res.setHeader('X-Debug-Query', JSON.stringify(req.query));

        const where: any = {};
        if (classId) {
            where.classId = parseInt(classId as string);
        }
        if (status) {
            where.status = status;
        }

        const members = await prisma.member.findMany({
            where,
            include: { class: true },
            orderBy: { name: 'asc' },
        });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Data Anggota');

        worksheet.columns = [
            { header: 'No', key: 'no', width: 5 },
            { header: 'NIS', key: 'nis', width: 15 },
            { header: 'Nama', key: 'name', width: 30 },
            { header: 'Kelas', key: 'class', width: 15 },
            { header: 'Telepon', key: 'phone', width: 15 },
            { header: 'Alamat', key: 'address', width: 35 },
            { header: 'Status', key: 'status', width: 12 },
            { header: 'Tanggal Daftar', key: 'memberSince', width: 15 },
        ];

        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF10B981' },
        };
        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

        members.forEach((member, index) => {
            worksheet.addRow({
                no: index + 1,
                nis: member.nis,
                name: member.name,
                class: member.class?.name || '-',
                phone: member.phone || '-',
                address: member.address || '-',
                status: member.status === 'active' ? 'Aktif' : 'Nonaktif',
                memberSince: new Date(member.memberSince).toLocaleDateString('id-ID'),
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=laporan-anggota.xlsx');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Export members error:', error);
        res.status(500).json({ error: 'Failed to export members report' });
    }
});

// Export Loans Report (Active or All)
router.get('/loans', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const { status, classId, startDate, endDate } = req.query;

        const where: any = {};
        if (status) {
            where.status = status;
        }
        if (classId) {
            where.member = { classId: parseInt(classId as string) };
        }
        if (startDate || endDate) {
            where.loanDate = {};
            if (startDate) {
                where.loanDate.gte = new Date(startDate as string);
            }
            if (endDate) {
                where.loanDate.lte = new Date(endDate as string);
            }
        }

        const loans = await prisma.loan.findMany({
            where,
            include: {
                member: { include: { class: true } },
                items: { include: { book: true } },
                createdBy: true,
            },
            orderBy: { loanDate: 'desc' },
        });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Laporan Peminjaman');

        worksheet.columns = [
            { header: 'No', key: 'no', width: 5 },
            { header: 'Tanggal Pinjam', key: 'loanDate', width: 15 },
            { header: 'Tanggal Kembali', key: 'dueDate', width: 15 },
            { header: 'NIS', key: 'nis', width: 12 },
            { header: 'Nama Peminjam', key: 'memberName', width: 25 },
            { header: 'Kelas', key: 'class', width: 12 },
            { header: 'Buku', key: 'books', width: 40 },
            { header: 'Status', key: 'status', width: 12 },
            { header: 'Denda', key: 'fine', width: 12 },
            { header: 'Petugas', key: 'createdBy', width: 20 },
        ];

        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF59E0B' },
        };
        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

        loans.forEach((loan, index) => {
            const books = loan.items.map((item: any) => item.book?.title || item.bookTitle || 'Buku Dihapus').join(', ');
            let statusText = 'Aktif';
            if (loan.status === 'returned') statusText = 'Dikembalikan';
            else if (loan.status === 'overdue' || new Date() > loan.dueDate) statusText = 'Terlambat';

            worksheet.addRow({
                no: index + 1,
                loanDate: new Date(loan.loanDate).toLocaleDateString('id-ID'),
                dueDate: new Date(loan.dueDate).toLocaleDateString('id-ID'),
                nis: loan.member?.nis || '-',
                memberName: loan.member?.name || loan.memberName || 'Anggota Dihapus',
                class: loan.member?.class?.name || '-',
                books: books,
                status: statusText,
                fine: loan.finedAmount > 0 ? `Rp ${loan.finedAmount.toLocaleString('id-ID')}` : '-',
                createdBy: loan.createdBy.name,
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=laporan-peminjaman.xlsx');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Export loans error:', error);
        res.status(500).json({ error: 'Failed to export loans report' });
    }
});

// Export Overdue Loans Report
router.get('/overdue', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const now = new Date();

        const loans = await prisma.loan.findMany({
            where: {
                status: 'active',
                dueDate: { lt: now },
            },
            include: {
                member: { include: { class: true } },
                items: { include: { book: true } },
            },
            orderBy: { dueDate: 'asc' },
        });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Buku Terlambat');

        worksheet.columns = [
            { header: 'No', key: 'no', width: 5 },
            { header: 'NIS', key: 'nis', width: 12 },
            { header: 'Nama', key: 'name', width: 25 },
            { header: 'Kelas', key: 'class', width: 12 },
            { header: 'Telepon', key: 'phone', width: 15 },
            { header: 'Buku', key: 'books', width: 35 },
            { header: 'Jatuh Tempo', key: 'dueDate', width: 15 },
            { header: 'Terlambat', key: 'daysLate', width: 12 },
            { header: 'Estimasi Denda', key: 'fine', width: 15 },
        ];

        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFEF4444' },
        };
        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

        loans.forEach((loan, index) => {
            const books = loan.items.filter((i: any) => i.status === 'borrowed').map((item: any) => item.book?.title || item.bookTitle || 'Buku Dihapus').join(', ');
            const daysLate = Math.floor((now.getTime() - loan.dueDate.getTime()) / (1000 * 60 * 60 * 24));
            const booksCount = loan.items.filter(i => i.status === 'borrowed').length;
            const estimatedFine = daysLate * 1000 * booksCount;

            worksheet.addRow({
                no: index + 1,
                nis: loan.member?.nis || '-',
                name: loan.member?.name || 'Anggota Dihapus',
                class: loan.member?.class?.name || '-',
                phone: loan.member?.phone || '-',
                books: books,
                dueDate: new Date(loan.dueDate).toLocaleDateString('id-ID'),
                daysLate: `${daysLate} hari`,
                fine: `Rp ${estimatedFine.toLocaleString('id-ID')}`,
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=laporan-terlambat.xlsx');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Export overdue error:', error);
        res.status(500).json({ error: 'Failed to export overdue report' });
    }
});

export default router;

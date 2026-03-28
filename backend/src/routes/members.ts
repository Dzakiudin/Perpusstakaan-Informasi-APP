import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, pustakawanOrAdmin, AuthRequest } from '../middleware/auth';
import PDFDocument from 'pdfkit';
import bwipjs from 'bwip-js';
import ExcelJS from 'exceljs';
import multer from 'multer';
import fs from 'fs';
import path from 'path';

const router: Router = Router();
const prisma = new PrismaClient();

// Configure multer for file upload
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            file.mimetype === 'application/vnd.ms-excel') {
            cb(null, true);
        } else {
            cb(new Error('Only Excel files are allowed'));
        }
    },
});

// Get all members with search, filter, sort, and pagination
router.get('/', authMiddleware, pustakawanOrAdmin, async (req: AuthRequest, res) => {
    try {
        const {
            search, classId, status,
            memberSinceFrom, memberSinceTo,
            sortBy = 'name', sortOrder = 'asc',
            page = '1', limit = '10',
        } = req.query;
        const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

        const where: any = {};
        if (search) {
            where.OR = [
                { name: { contains: search as string } },
                { nis: { contains: search as string } },
            ];
        }
        if (classId) {
            where.classId = parseInt(classId as string);
        }
        if (status) {
            where.status = status;
        }
        // Date range filter for memberSince
        if (memberSinceFrom || memberSinceTo) {
            where.memberSince = {};
            if (memberSinceFrom) {
                where.memberSince.gte = new Date(memberSinceFrom as string);
            }
            if (memberSinceTo) {
                where.memberSince.lte = new Date(memberSinceTo as string);
            }
        }

        // Determine sort order
        let orderBy: any = { name: 'asc' };
        const order = sortOrder === 'desc' ? 'desc' : 'asc';
        switch (sortBy) {
            case 'nis': orderBy = { nis: order }; break;
            case 'createdAt': orderBy = { createdAt: order }; break;
            case 'name':
            default: orderBy = { name: order }; break;
        }

        const [members, total] = await Promise.all([
            prisma.member.findMany({
                where,
                skip,
                take: parseInt(limit as string),
                include: { class: true },
                orderBy,
            }),
            prisma.member.count({ where }),
        ]);

        res.json({
            data: members,
            pagination: {
                page: parseInt(page as string),
                limit: parseInt(limit as string),
                total,
                totalPages: Math.ceil(total / parseInt(limit as string)),
            },
        });
    } catch (error) {
        console.error('Get members error:', error);
        res.status(500).json({ error: 'Failed to get members' });
    }
});

// Get member by ID
router.get('/:id', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const member = await prisma.member.findUnique({
            where: { id: parseInt(req.params.id) },
            include: {
                class: true,
                loans: {
                    include: {
                        items: { include: { book: true } },
                    },
                    orderBy: { loanDate: 'desc' },
                    take: 10,
                },
            },
        });

        if (!member) {
            return res.status(404).json({ error: 'Member not found' });
        }

        res.json(member);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get member' });
    }
});

// Get member by NIS (for scanning)
router.get('/nis/:nis', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const member = await prisma.member.findUnique({
            where: { nis: req.params.nis },
            include: {
                class: true,
                loans: {
                    where: { status: 'active' },
                    include: {
                        items: { include: { book: true } },
                    },
                },
            },
        });

        if (!member) {
            return res.status(404).json({ error: 'Member not found' });
        }

        // Count active loans
        const activeLoansCount = member.loans.reduce((acc, loan) => acc + loan.items.length, 0);

        // Get max books per loan setting (default 3)
        const maxBooksSetting = await prisma.settings.findUnique({
            where: { key: 'max_books_per_loan' },
        });
        const maxBooks = parseInt(maxBooksSetting?.value || '3');

        res.json({
            ...member,
            activeLoansCount,
            maxBooks, // Return maxBooks so frontend can use it
            canBorrow: member.status === 'active' && activeLoansCount < maxBooks,
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get member' });
    }
});

// Generate member card PDF (front and back)
router.get('/:id/card.pdf', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const member = await prisma.member.findUnique({
            where: { id: parseInt(req.params.id) },
            include: { class: true },
        });

        if (!member) {
            return res.status(404).json({ error: 'Member not found' });
        }

        // Generate barcode
        const barcodeBuffer = await bwipjs.toBuffer({
            bcid: 'code128',
            text: member.nis,
            scale: 3,
            height: 15,
            includetext: false,
        });

        // Card dimensions (standard ID: 85.6mm x 54mm ≈ 243 x 153 points)
        const cardWidth = 340;
        const cardHeight = 215;

        const doc = new PDFDocument({
            size: [cardWidth, cardHeight],
            margin: 0,
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="kartu-${member.nis}.pdf"`);

        doc.pipe(res);

        // =================== FRONT SIDE ===================

        // Green header background
        const headerHeight = 70;
        doc.rect(0, 0, cardWidth, headerHeight).fill('#16a34a');

        // Lighter green accent at bottom of header
        doc.rect(0, headerHeight - 18, cardWidth, 18).fill('#15803d');

        // School Logo
        const logoPath = path.join(process.cwd(), 'assets', 'logo.png');
        if (fs.existsSync(logoPath)) {
            try {
                // Determine logo dimensions and position
                const logoSize = 50;
                const logoX = 15;
                const logoY = 10;

                doc.image(logoPath, logoX, logoY, {
                    width: logoSize,
                    height: logoSize,
                    fit: [logoSize, logoSize],
                    align: 'center',
                    valign: 'center'
                });
            } catch (err) {
                console.error('Error loading logo:', err);
            }
        }

        // Card title
        const textStartX = 70;
        const textWidth = cardWidth - 80;

        doc.fontSize(11).fillColor('#ffffff').font('Helvetica-Bold');
        doc.text('KARTU ANGGOTA PERPUSTAKAAN', textStartX, 12, { width: textWidth, align: 'center' });

        // School name (larger)
        doc.fontSize(16).font('Helvetica-Bold');
        doc.text('MA AL-KARIMIYYAH SUMENEP', textStartX, 28, { width: textWidth, align: 'center' });

        // School address in accent bar
        doc.fontSize(6).fillColor('#fde047').font('Helvetica');
        doc.text('Jl. Raya Gapura, Desa Beraji Kec. Gapura Kab. Sumenep Prov. Jawa Timur 69472', textStartX, headerHeight - 13, { width: textWidth, align: 'center' });

        // White content area
        doc.rect(0, headerHeight, cardWidth, cardHeight - headerHeight).fill('#ffffff');

        // Member info section
        const infoX = 20;
        const infoY = headerHeight + 15;
        const labelWidth = 70;
        const colonX = infoX + labelWidth;
        const valueX = colonX + 15;
        const lineHeight = 18;

        doc.fontSize(10).fillColor('#1f2937').font('Helvetica-Bold');

        // Row 1: Nama
        doc.font('Helvetica').text('Nama', infoX, infoY);
        doc.text(':', colonX, infoY);
        doc.font('Helvetica-Bold').text(member.name, valueX, infoY);

        // Row 2: No Anggota / NIS
        doc.font('Helvetica').text('No. Anggota', infoX, infoY + lineHeight);
        doc.text(':', colonX, infoY + lineHeight);
        doc.font('Helvetica-Bold').text(member.nis, valueX, infoY + lineHeight);

        // Row 3: Kelas
        doc.font('Helvetica').text('Kelas', infoX, infoY + lineHeight * 2);
        doc.text(':', colonX, infoY + lineHeight * 2);
        doc.font('Helvetica-Bold').text(member.class?.name || '-', valueX, infoY + lineHeight * 2);

        // Row 4: Status
        doc.font('Helvetica').text('Status', infoX, infoY + lineHeight * 3);
        doc.text(':', colonX, infoY + lineHeight * 3);
        doc.font('Helvetica-Bold').fillColor(member.status === 'active' ? '#16a34a' : '#dc2626');
        doc.text(member.status === 'active' ? 'Aktif' : 'Non-Aktif', valueX, infoY + lineHeight * 3);

        // Barcode section (bottom left)
        const barcodeY = cardHeight - 50;
        doc.image(barcodeBuffer, infoX, barcodeY, { width: 100, height: 35 });
        doc.fontSize(8).fillColor('#374151').font('Helvetica');
        doc.text(member.nis, infoX, barcodeY + 38, { width: 100, align: 'center' });

        // Signature section (bottom right)
        const signX = cardWidth - 130;
        const signY = infoY + lineHeight * 3 + 10;

        // Get current date formatted
        const now = new Date();
        const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        const dateStr = `Sumenep, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;

        doc.fontSize(7).fillColor('#374151').font('Helvetica');
        doc.text(dateStr, signX, signY, { width: 110, align: 'center' });
        doc.text('Kepala Perpustakaan', signX, signY + 10, { width: 110, align: 'center' });

        // Signature line
        doc.moveTo(signX + 10, signY + 45).lineTo(signX + 100, signY + 45).stroke('#9ca3af');

        doc.fontSize(7).font('Helvetica-Bold');
        doc.text('Aris Ariyanto, A.Ma', signX, signY + 50, { width: 110, align: 'center' });

        // =================== BACK SIDE ===================
        doc.addPage({ size: [cardWidth, cardHeight], margin: 0 });

        // Green header (smaller)
        doc.rect(0, 0, cardWidth, 45).fill('#16a34a');
        doc.rect(0, 35, cardWidth, 10).fill('#15803d');

        // Title
        doc.fontSize(12).fillColor('#ffffff').font('Helvetica-Bold');
        doc.text('KETENTUAN PERPUSTAKAAN', 0, 12, { width: cardWidth, align: 'center' });

        // White content area
        doc.rect(0, 45, cardWidth, cardHeight - 45).fill('#ffffff');

        // Rules
        const rules = [
            'Kartu ini berlaku selama menjadi siswa aktif di sekolah.',
            'Kartu wajib dibawa saat meminjam atau mengembalikan buku.',
            'Maksimal peminjaman 3 buku dalam waktu bersamaan.',
            'Lama peminjaman maksimal 7 hari kerja.',
            'Keterlambatan dikenakan denda Rp1.000/hari/buku.',
            'Kerusakan atau kehilangan buku menjadi tanggung jawab peminjam.',
            'Kartu tidak boleh dipinjamkan kepada orang lain.',
            'Kehilangan kartu harap segera melapor ke petugas.',
        ];

        doc.fontSize(7).font('Helvetica').fillColor('#374151');
        let ruleY = 55;
        rules.forEach((rule, i) => {
            doc.text(`${i + 1}. ${rule}`, 15, ruleY, { width: cardWidth - 30 });
            ruleY += 14;
        });

        // Footer
        doc.fontSize(6).fillColor('#6b7280');
        doc.text('Jagalah kartu ini dengan baik • Perpustakaan MA AL-KARIMIYYAH Sumenep ', 0, cardHeight - 15, { width: cardWidth, align: 'center' });

        doc.end();
    } catch (error) {
        console.error('Generate card error:', error);
        res.status(500).json({ error: 'Failed to generate card' });
    }
});

// Create member
router.post('/', authMiddleware, pustakawanOrAdmin, async (req: AuthRequest, res) => {
    try {
        const { nis, name, classId, phone, address } = req.body;

        if (!nis || !name || !classId) {
            return res.status(400).json({ error: 'NIS, name, and class are required' });
        }

        const member = await prisma.member.create({
            data: {
                nis,
                name,
                classId: parseInt(classId),
                phone: phone || null,
                address: address || null,
                status: 'active',
            },
            include: { class: true },
        });

        res.status(201).json(member);
    } catch (error: any) {
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'NIS already exists' });
        }
        console.error('Create member error:', error);
        res.status(500).json({ error: 'Failed to create member' });
    }
});

// Update member
router.put('/:id', authMiddleware, pustakawanOrAdmin, async (req: AuthRequest, res) => {
    try {
        const { nis, name, classId, phone, address, status } = req.body;

        const member = await prisma.member.update({
            where: { id: parseInt(req.params.id) },
            data: {
                nis,
                name,
                classId: classId ? parseInt(classId) : undefined,
                phone,
                address,
                status,
            },
            include: { class: true },
        });

        res.json(member);
    } catch (error: any) {
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'NIS already exists' });
        }
        res.status(500).json({ error: 'Failed to update member' });
    }
});

// Delete member
router.delete('/:id', authMiddleware, pustakawanOrAdmin, async (req: AuthRequest, res) => {
    try {
        const memberId = parseInt(req.params.id);

        // Check if member has active loans
        const activeLoans = await prisma.loan.findFirst({
            where: {
                memberId,
                status: 'active',
            },
        });

        if (activeLoans) {
            return res.status(400).json({ error: 'Tidak bisa hapus anggota dengan peminjaman aktif' });
        }

        // Get member name for preserving in history
        const member = await prisma.member.findUnique({
            where: { id: memberId },
        });

        if (!member) {
            return res.status(404).json({ error: 'Anggota tidak ditemukan' });
        }

        // Preserve member name in loan history before deletion
        await prisma.loan.updateMany({
            where: { memberId },
            data: { memberName: member.name },
        });

        // Delete member - loans will have memberId set to NULL automatically (onDelete: SetNull)
        await prisma.member.delete({
            where: { id: memberId },
        });

        res.json({ message: 'Anggota berhasil dihapus. Riwayat peminjaman tetap tersimpan.' });
    } catch (error) {
        console.error('Delete member error:', error);
        res.status(500).json({ error: 'Gagal menghapus anggota' });
    }
});

// Bulk print member cards (multi-page PDF)
router.post('/cards/bulk', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const { memberIds, selectAll, excludeIds, filters } = req.body;

        let where: any = {};

        if (selectAll && filters) {
            // Reconstruct where clause from filters
            if (filters.search) {
                where.OR = [
                    { name: { contains: filters.search } },
                    { nis: { contains: filters.search } },
                ];
            }
            if (filters.classId) {
                where.classId = parseInt(filters.classId);
            }
            if (filters.status) {
                where.status = filters.status;
            }

            if (excludeIds && Array.isArray(excludeIds) && excludeIds.length > 0) {
                where.id = { notIn: excludeIds };
            }
        } else if (memberIds && Array.isArray(memberIds) && memberIds.length > 0) {
            where.id = { in: memberIds };
        } else {
            return res.status(400).json({ error: 'Pilih minimal 1 anggota' });
        }

        const members = await prisma.member.findMany({
            where,
            include: { class: true },
            orderBy: { name: 'asc' },
        });

        if (members.length === 0) {
            return res.status(404).json({ error: 'Anggota tidak ditemukan' });
        }

        const cardWidth = 340;
        const cardHeight = 215;

        const doc = new PDFDocument({
            size: [cardWidth, cardHeight],
            margin: 0,
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="kartu-anggota-bulk-${members.length}.pdf"`);

        doc.pipe(res);

        for (let i = 0; i < members.length; i++) {
            const member = members[i];

            if (i > 0) {
                doc.addPage({ size: [cardWidth, cardHeight], margin: 0 });
            }

            // Generate barcode
            const barcodeBuffer = await bwipjs.toBuffer({
                bcid: 'code128',
                text: member.nis,
                scale: 3,
                height: 15,
                includetext: false,
            });

            // =================== FRONT SIDE ===================
            const headerHeight = 70;
            doc.rect(0, 0, cardWidth, headerHeight).fill('#16a34a');
            doc.rect(0, headerHeight - 18, cardWidth, 18).fill('#15803d');

            // School Logo
            const logoPath = path.join(process.cwd(), 'assets', 'logo.png');
            if (fs.existsSync(logoPath)) {
                try {
                    const logoSize = 50;
                    doc.image(logoPath, 15, 10, {
                        width: logoSize, height: logoSize,
                        fit: [logoSize, logoSize],
                        align: 'center', valign: 'center'
                    });
                } catch (err) {
                    console.error('Error loading logo:', err);
                }
            }

            const textStartX = 70;
            const textWidth = cardWidth - 80;

            doc.fontSize(11).fillColor('#ffffff').font('Helvetica-Bold');
            doc.text('KARTU ANGGOTA PERPUSTAKAAN', textStartX, 12, { width: textWidth, align: 'center' });
            doc.fontSize(16).font('Helvetica-Bold');
            doc.text('MA AL-KARIMIYYAH SUMENEP', textStartX, 28, { width: textWidth, align: 'center' });
            doc.fontSize(6).fillColor('#fde047').font('Helvetica');
            doc.text('Jl. Raya Gapura, Desa Beraji Kec. Gapura Kab. Sumenep Prov. Jawa Timur 69472', textStartX, headerHeight - 13, { width: textWidth, align: 'center' });

            doc.rect(0, headerHeight, cardWidth, cardHeight - headerHeight).fill('#ffffff');

            const infoX = 20;
            const infoY = headerHeight + 15;
            const labelWidth = 70;
            const colonX = infoX + labelWidth;
            const valueX = colonX + 15;
            const lineHeight = 18;

            doc.fontSize(10).fillColor('#1f2937').font('Helvetica-Bold');
            doc.font('Helvetica').text('Nama', infoX, infoY);
            doc.text(':', colonX, infoY);
            doc.font('Helvetica-Bold').text(member.name, valueX, infoY);

            doc.font('Helvetica').text('No. Anggota', infoX, infoY + lineHeight);
            doc.text(':', colonX, infoY + lineHeight);
            doc.font('Helvetica-Bold').text(member.nis, valueX, infoY + lineHeight);

            doc.font('Helvetica').text('Kelas', infoX, infoY + lineHeight * 2);
            doc.text(':', colonX, infoY + lineHeight * 2);
            doc.font('Helvetica-Bold').text(member.class?.name || '-', valueX, infoY + lineHeight * 2);

            doc.font('Helvetica').text('Status', infoX, infoY + lineHeight * 3);
            doc.text(':', colonX, infoY + lineHeight * 3);
            doc.font('Helvetica-Bold').fillColor(member.status === 'active' ? '#16a34a' : '#dc2626');
            doc.text(member.status === 'active' ? 'Aktif' : 'Non-Aktif', valueX, infoY + lineHeight * 3);

            const barcodeY = cardHeight - 50;
            doc.image(barcodeBuffer, infoX, barcodeY, { width: 100, height: 35 });
            doc.fontSize(8).fillColor('#374151').font('Helvetica');
            doc.text(member.nis, infoX, barcodeY + 38, { width: 100, align: 'center' });

            const signX = cardWidth - 130;
            const signY = infoY + lineHeight * 3 + 10;
            const now = new Date();
            const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
            const dateStr = `Sumenep, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;

            doc.fontSize(7).fillColor('#374151').font('Helvetica');
            doc.text(dateStr, signX, signY, { width: 110, align: 'center' });
            doc.text('Kepala Perpustakaan', signX, signY + 10, { width: 110, align: 'center' });
            doc.moveTo(signX + 10, signY + 45).lineTo(signX + 100, signY + 45).stroke('#9ca3af');
            doc.fontSize(7).font('Helvetica-Bold');
            doc.text('Aris Ariyanto, A.Ma', signX, signY + 50, { width: 110, align: 'center' });

            // =================== BACK SIDE ===================
            doc.addPage({ size: [cardWidth, cardHeight], margin: 0 });
            doc.rect(0, 0, cardWidth, 45).fill('#16a34a');
            doc.rect(0, 35, cardWidth, 10).fill('#15803d');
            doc.fontSize(12).fillColor('#ffffff').font('Helvetica-Bold');
            doc.text('KETENTUAN PERPUSTAKAAN', 0, 12, { width: cardWidth, align: 'center' });
            doc.rect(0, 45, cardWidth, cardHeight - 45).fill('#ffffff');

            const rules = [
                'Kartu ini berlaku selama menjadi siswa aktif di sekolah.',
                'Kartu wajib dibawa saat meminjam atau mengembalikan buku.',
                'Maksimal peminjaman 3 buku dalam waktu bersamaan.',
                'Lama peminjaman maksimal 7 hari kerja.',
                'Keterlambatan dikenakan denda Rp1.000/hari/buku.',
                'Kerusakan atau kehilangan buku menjadi tanggung jawab peminjam.',
                'Kartu tidak boleh dipinjamkan kepada orang lain.',
                'Kehilangan kartu harap segera melapor ke petugas.',
            ];

            doc.fontSize(7).font('Helvetica').fillColor('#374151');
            let ruleY = 55;
            rules.forEach((rule, idx) => {
                doc.text(`${idx + 1}. ${rule}`, 15, ruleY, { width: cardWidth - 30 });
                ruleY += 14;
            });

            doc.fontSize(6).fillColor('#6b7280');
            doc.text('Jagalah kartu ini dengan baik • Perpustakaan MA AL-KARIMIYYAH Sumenep ', 0, cardHeight - 15, { width: cardWidth, align: 'center' });
        }

        doc.end();
    } catch (error) {
        console.error('Bulk card generation error:', error);
        res.status(500).json({ error: 'Gagal membuat kartu anggota' });
    }
});

// Bulk delete members
router.post('/bulk-delete', authMiddleware, pustakawanOrAdmin, async (req: AuthRequest, res) => {
    try {
        const { ids, selectAll, excludeIds, filters } = req.body;

        let where: any = {};

        if (selectAll && filters) {
            // Reconstruct where clause from filters
            if (filters.search) {
                where.OR = [
                    { name: { contains: filters.search } },
                    { nis: { contains: filters.search } },
                ];
            }
            if (filters.classId) {
                where.classId = parseInt(filters.classId);
            }
            if (filters.status) {
                where.status = filters.status;
            }

            if (excludeIds && Array.isArray(excludeIds) && excludeIds.length > 0) {
                where.id = { notIn: excludeIds };
            }
        } else if (ids && Array.isArray(ids) && ids.length > 0) {
            where.id = { in: ids };
        } else {
            return res.status(400).json({ error: 'Pilih minimal 1 anggota untuk dihapus' });
        }

        // Find members to check for active loans
        // We first find the IDs that match the criteria
        const targetMembers = await prisma.member.findMany({
            where,
            select: { id: true }
        });

        if (targetMembers.length === 0) {
            return res.status(404).json({ error: 'Tidak ada anggota yang dipilih' });
        }

        const targetIds = targetMembers.map(m => m.id);

        // Check for members with active loans
        const membersWithActiveLoans = await prisma.loan.findMany({
            where: {
                memberId: { in: targetIds },
                status: 'active',
            },
            select: { memberId: true, member: { select: { name: true } } },
        });

        const activeMemberIds = new Set(membersWithActiveLoans.map(l => l.memberId));
        const deletableIds = targetIds.filter((id) => !activeMemberIds.has(id));
        const skippedMembers = membersWithActiveLoans.map(l => ({
            id: l.memberId,
            name: l.member?.name || 'Unknown',
            reason: 'Memiliki peminjaman aktif',
        }));

        if (deletableIds.length === 0) {
            return res.status(400).json({
                error: 'Semua anggota yang dipilih memiliki peminjaman aktif dan tidak bisa dihapus',
                skipped: skippedMembers,
            });
        }

        // Get member data for preserving in history
        const membersToDelete = await prisma.member.findMany({
            where: { id: { in: deletableIds } },
        });

        await prisma.$transaction(async (tx) => {
            // Preserve member names in loan history
            for (const member of membersToDelete) {
                await tx.loan.updateMany({
                    where: { memberId: member.id },
                    data: { memberName: member.name },
                });
            }

            // Delete members
            await tx.member.deleteMany({
                where: { id: { in: deletableIds } },
            });
        });

        res.json({
            message: `${deletableIds.length} anggota berhasil dihapus.${skippedMembers.length > 0 ? ` ${skippedMembers.length} dilewati karena memiliki peminjaman aktif.` : ''}`,
            deleted: deletableIds.length,
            skipped: skippedMembers,
        });
    } catch (error) {
        console.error('Bulk delete error:', error);
        res.status(500).json({ error: 'Gagal menghapus anggota' });
    }
});

// Download import template
router.get('/import/template', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Template Anggota');

        // Get all classes for reference
        const classes = await prisma.class.findMany({ orderBy: { name: 'asc' } });

        // Set columns
        sheet.columns = [
            { header: 'NIS *', key: 'nis', width: 15 },
            { header: 'Nama Lengkap *', key: 'name', width: 30 },
            { header: 'Nama Kelas *', key: 'className', width: 20 },
            { header: 'Nomor Telepon', key: 'phone', width: 18 },
            { header: 'Alamat', key: 'address', width: 40 },
        ];

        // Style header
        sheet.getRow(1).font = { bold: true };
        sheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF3B82F6' },
        };
        sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

        // Add sample data
        sheet.addRow({
            nis: '12345',
            name: 'Contoh Nama Siswa',
            className: classes[0]?.name || 'XII IPA 1',
            phone: '08123456789',
            address: 'Jl. Contoh No. 123',
        });

        // Add class reference sheet
        const classSheet = workbook.addWorksheet('Daftar Kelas');
        classSheet.columns = [
            { header: 'Nama Kelas', key: 'name', width: 25 },
        ];
        classSheet.getRow(1).font = { bold: true };
        classes.forEach(c => classSheet.addRow({ name: c.name }));

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="template-import-anggota.xlsx"');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Template download error:', error);
        res.status(500).json({ error: 'Failed to generate template' });
    }
});

// Bulk import members from Excel
router.post('/import', authMiddleware, pustakawanOrAdmin, upload.single('file'), async (req: AuthRequest, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer as any);

        const sheet = workbook.getWorksheet(1);
        if (!sheet) {
            return res.status(400).json({ error: 'Invalid Excel file' });
        }

        // Get all classes for mapping
        const classes = await prisma.class.findMany();
        const classMap = new Map(classes.map(c => [c.name.toLowerCase().trim(), c.id]));

        const results = {
            total: 0,
            success: 0,
            failed: 0,
            classesCreated: 0,
            errors: [] as { row: number; nis: string; error: string }[],
        };

        // Collect all unique class names from Excel that don't exist
        const classNamesToCreate = new Set<string>();
        sheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;
            const className = row.getCell(3).value?.toString().trim();
            if (className && !classMap.has(className.toLowerCase().trim())) {
                classNamesToCreate.add(className.trim());
            }
        });

        // Auto-create missing classes
        for (const className of classNamesToCreate) {
            const newClass = await prisma.class.create({
                data: {
                    name: className,
                    waliKelas: null, // Optional, left empty
                },
            });
            classMap.set(className.toLowerCase().trim(), newClass.id);
            results.classesCreated++;
        }

        const membersToCreate: { nis: string; name: string; classId: number; phone: string | null; address: string | null }[] = [];

        // Skip header row, process data rows
        sheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return; // Skip header

            results.total++;

            const nis = row.getCell(1).value?.toString().trim();
            const name = row.getCell(2).value?.toString().trim();
            const className = row.getCell(3).value?.toString().trim();
            const phone = row.getCell(4).value?.toString().trim() || null;
            const address = row.getCell(5).value?.toString().trim() || null;

            // Validate required fields
            if (!nis || !name || !className) {
                results.failed++;
                results.errors.push({
                    row: rowNumber,
                    nis: nis || '-',
                    error: 'NIS, Nama, dan Kelas wajib diisi',
                });
                return;
            }

            // Find class (should always exist now since we auto-created missing ones)
            const classId = classMap.get(className.toLowerCase().trim());
            if (!classId) {
                results.failed++;
                results.errors.push({
                    row: rowNumber,
                    nis,
                    error: `Kelas "${className}" tidak dapat dibuat`,
                });
                return;
            }

            membersToCreate.push({ nis, name, classId, phone, address });
        });

        // Check for duplicate NIS in file
        const nisSet = new Set<string>();
        const duplicatesInFile: string[] = [];
        membersToCreate.forEach(m => {
            if (nisSet.has(m.nis)) {
                duplicatesInFile.push(m.nis);
            }
            nisSet.add(m.nis);
        });

        if (duplicatesInFile.length > 0) {
            return res.status(400).json({
                error: `NIS duplikat ditemukan dalam file: ${duplicatesInFile.slice(0, 5).join(', ')}${duplicatesInFile.length > 5 ? '...' : ''}`,
            });
        }

        // Check for existing NIS in database
        const existingMembers = await prisma.member.findMany({
            where: { nis: { in: membersToCreate.map(m => m.nis) } },
            select: { nis: true },
        });
        const existingNis = new Set(existingMembers.map(m => m.nis));

        // Filter out existing and add to errors
        const newMembers = membersToCreate.filter(m => {
            if (existingNis.has(m.nis)) {
                results.failed++;
                results.errors.push({
                    row: 0,
                    nis: m.nis,
                    error: 'NIS sudah terdaftar di database',
                });
                return false;
            }
            return true;
        });

        // Bulk create
        if (newMembers.length > 0) {
            await prisma.member.createMany({
                data: newMembers.map(m => ({
                    ...m,
                    status: 'active',
                })),
            });
            results.success = newMembers.length;
        }

        res.json({
            message: `Import selesai. ${results.success} berhasil, ${results.failed} gagal.${results.classesCreated > 0 ? ` ${results.classesCreated} kelas baru dibuat otomatis.` : ''}`,
            results,
        });
    } catch (error: any) {
        console.error('Import error:', error);
        res.status(500).json({ error: 'Failed to import members: ' + (error.message || 'Unknown error') });
    }
});

export default router;


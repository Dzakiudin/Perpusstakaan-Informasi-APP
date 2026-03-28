import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, pustakawanOrAdmin, AuthRequest } from '../middleware/auth';

const router: Router = Router();
const prisma = new PrismaClient();

// Get all reservations with filters
router.get('/', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const { status, memberId, bookId, page = '1', limit = '20' } = req.query;
        const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

        const where: any = {};
        if (status) where.status = status;
        if (memberId) where.memberId = parseInt(memberId as string);
        if (bookId) where.bookId = parseInt(bookId as string);

        const [reservations, total] = await Promise.all([
            prisma.reservation.findMany({
                where,
                skip,
                take: parseInt(limit as string),
                include: {
                    member: { include: { class: true } },
                    book: true,
                },
                orderBy: [{ status: 'asc' }, { queuePosition: 'asc' }],
            }),
            prisma.reservation.count({ where }),
        ]);

        res.json({
            data: reservations,
            pagination: {
                page: parseInt(page as string),
                limit: parseInt(limit as string),
                total,
                totalPages: Math.ceil(total / parseInt(limit as string)),
            },
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get reservations' });
    }
});

// Create a reservation
router.post('/', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const { memberId, bookId } = req.body;

        // Check if book is currently available
        const book = await prisma.book.findUnique({ where: { id: bookId } });
        if (!book) {
            return res.status(404).json({ error: 'Book not found' });
        }

        if (book.availableCopies > 0) {
            return res.status(400).json({ error: 'Buku masih tersedia, tidak perlu reservasi' });
        }

        // Check if member already has active reservation for this book
        const existingReservation = await prisma.reservation.findFirst({
            where: {
                memberId,
                bookId,
                status: { in: ['waiting', 'ready'] },
            },
        });

        if (existingReservation) {
            return res.status(400).json({ error: 'Sudah ada reservasi aktif untuk buku ini' });
        }

        // Get current queue position
        const lastInQueue = await prisma.reservation.findFirst({
            where: { bookId, status: 'waiting' },
            orderBy: { queuePosition: 'desc' },
        });

        const queuePosition = (lastInQueue?.queuePosition || 0) + 1;

        const reservation = await prisma.reservation.create({
            data: {
                memberId,
                bookId,
                queuePosition,
                status: 'waiting',
            },
            include: {
                member: { include: { class: true } },
                book: true,
            },
        });

        res.status(201).json(reservation);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create reservation' });
    }
});

// Cancel reservation
router.delete('/:id', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;

        const reservation = await prisma.reservation.findUnique({
            where: { id: parseInt(id) },
        });

        if (!reservation) {
            return res.status(404).json({ error: 'Reservation not found' });
        }

        if (reservation.status === 'fulfilled') {
            return res.status(400).json({ error: 'Cannot cancel fulfilled reservation' });
        }

        await prisma.reservation.update({
            where: { id: parseInt(id) },
            data: { status: 'cancelled' },
        });

        // Update queue positions for remaining reservations
        await prisma.reservation.updateMany({
            where: {
                bookId: reservation.bookId,
                status: 'waiting',
                queuePosition: { gt: reservation.queuePosition },
            },
            data: { queuePosition: { decrement: 1 } },
        });

        res.json({ message: 'Reservation cancelled' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to cancel reservation' });
    }
});

// Mark reservation as ready (when book is returned)
router.post('/:id/ready', authMiddleware, pustakawanOrAdmin, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;

        const reservation = await prisma.reservation.update({
            where: { id: parseInt(id) },
            data: {
                status: 'ready',
                notifiedAt: new Date(),
            },
            include: {
                member: { include: { class: true } },
                book: true,
            },
        });

        res.json(reservation);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update reservation' });
    }
});

// Fulfill reservation (when member picks up the book)
router.post('/:id/fulfill', authMiddleware, pustakawanOrAdmin, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;

        const reservation = await prisma.reservation.update({
            where: { id: parseInt(id) },
            data: {
                status: 'fulfilled',
                fulfilledAt: new Date(),
            },
            include: {
                member: true,
                book: true,
            },
        });

        res.json(reservation);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fulfill reservation' });
    }
});

// Get reservations for a specific member
router.get('/member/:memberId', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const { memberId } = req.params;

        const reservations = await prisma.reservation.findMany({
            where: {
                memberId: parseInt(memberId),
                status: { in: ['waiting', 'ready'] },
            },
            include: { book: true },
            orderBy: { reservedAt: 'desc' },
        });

        res.json(reservations);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get member reservations' });
    }
});

// Get waiting list for a book
router.get('/book/:bookId', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const { bookId } = req.params;

        const reservations = await prisma.reservation.findMany({
            where: {
                bookId: parseInt(bookId),
                status: 'waiting',
            },
            include: {
                member: { include: { class: true } },
            },
            orderBy: { queuePosition: 'asc' },
        });

        res.json(reservations);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get book reservations' });
    }
});

export default router;

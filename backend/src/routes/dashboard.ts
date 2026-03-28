import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router: Router = Router();
const prisma = new PrismaClient();

// Get dashboard stats
router.get('/', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const [
            totalBooks,
            totalMembers,
            totalClasses,
            activeLoans,
            overdueLoans,
            loansThisMonth,
            recentLoans,
            popularBooks,
        ] = await Promise.all([
            // Total books (sum of all copies)
            prisma.book.aggregate({ _sum: { totalCopies: true } }),

            // Total active members
            prisma.member.count({ where: { status: 'active' } }),

            // Total classes
            prisma.class.count(),

            // Active loans count
            prisma.loan.count({ where: { status: 'active' } }),

            // Overdue loans
            prisma.loan.count({
                where: {
                    status: 'active',
                    dueDate: { lt: now },
                },
            }),

            // Loans this month
            prisma.loan.count({
                where: {
                    loanDate: { gte: startOfMonth },
                },
            }),

            // Recent loans
            prisma.loan.findMany({
                take: 5,
                include: {
                    member: true,
                    items: { include: { book: true } },
                },
                orderBy: { loanDate: 'desc' },
            }),

            // Most borrowed books (filter out null bookIds)
            prisma.loanItem.groupBy({
                by: ['bookId'],
                where: { bookId: { not: undefined } },
                _count: { bookId: true },
                orderBy: { _count: { bookId: 'desc' } },
                take: 5,
            }) as any,
        ]);

        // Get book details for popular books
        const popularBookIds = popularBooks.map((pb: any) => pb.bookId).filter((id: any): id is number => id !== null);
        const popularBooksDetails = await prisma.book.findMany({
            where: { id: { in: popularBookIds } },
        });

        const popularBooksWithCount = popularBooks.map((pb: any) => {
            const book = popularBooksDetails.find(b => b.id === pb.bookId);
            return {
                ...book,
                borrowCount: pb._count?.bookId || 0,
            };
        });

        res.json({
            stats: {
                totalBooks: totalBooks._sum.totalCopies || 0,
                totalMembers,
                totalClasses,
                activeLoans,
                overdueLoans,
                loansThisMonth,
            },
            recentLoans: recentLoans.map(loan => ({
                id: loan.id,
                memberName: loan.member?.name || loan.memberName || 'Anggota Dihapus',
                books: loan.items.map((item: any) => item.book?.title || item.bookTitle || 'Buku Dihapus'),
                loanDate: loan.loanDate,
                dueDate: loan.dueDate,
                status: loan.status,
            })),
            popularBooks: popularBooksWithCount,
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({ error: 'Failed to get dashboard data' });
    }
});

// Get loan statistics for charts
router.get('/charts', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const now = new Date();
        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

        // Get loans per month for the last 6 months
        const loans = await prisma.loan.findMany({
            where: {
                loanDate: { gte: sixMonthsAgo },
            },
            select: {
                loanDate: true,
            },
        });

        // Group by month
        const monthlyLoans: { [key: string]: number } = {};
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

        for (let i = 5; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${months[date.getMonth()]} ${date.getFullYear()}`;
            monthlyLoans[key] = 0;
        }

        loans.forEach(loan => {
            const date = new Date(loan.loanDate);
            const key = `${months[date.getMonth()]} ${date.getFullYear()}`;
            if (monthlyLoans[key] !== undefined) {
                monthlyLoans[key]++;
            }
        });

        // Category distribution
        const categoryStats = await prisma.book.groupBy({
            by: ['category'],
            _sum: { totalCopies: true },
        });

        res.json({
            monthlyLoans: Object.entries(monthlyLoans).map(([month, count]) => ({
                month,
                count,
            })),
            categoryDistribution: categoryStats.map(cs => ({
                category: cs.category || 'Tidak Berkategori',
                count: cs._sum.totalCopies || 0,
            })),
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get chart data' });
    }
});

// Top readers leaderboard
router.get('/top-readers', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const { period = 'all' } = req.query;
        let dateFilter = {};

        if (period === 'month') {
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);
            dateFilter = { loanDate: { gte: startOfMonth } };
        } else if (period === 'year') {
            const startOfYear = new Date();
            startOfYear.setMonth(0, 1);
            startOfYear.setHours(0, 0, 0, 0);
            dateFilter = { loanDate: { gte: startOfYear } };
        }

        const topReaders = await prisma.loan.groupBy({
            by: ['memberId'],
            where: dateFilter,
            _count: { id: true },
            orderBy: { _count: { id: 'desc' } },
            take: 10,
        });

        const memberIds = topReaders.map(r => r.memberId).filter((id): id is number => id !== null);
        const members = await prisma.member.findMany({
            where: { id: { in: memberIds } },
            include: { class: true },
        });

        const result = topReaders.map(r => {
            const member = members.find(m => m.id === r.memberId);
            return {
                memberId: r.memberId,
                name: member?.name || 'Unknown',
                className: member?.class?.name || '-',
                loanCount: r._count.id,
            };
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get top readers' });
    }
});

// Late statistics by class
router.get('/late-stats', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const now = new Date();

        // Get all overdue loans with member and class info
        const overdueLoans = await prisma.loan.findMany({
            where: {
                status: 'active',
                dueDate: { lt: now },
            },
            include: {
                member: {
                    include: { class: true },
                },
            },
        });

        // Group by class
        const classStats: { [key: string]: { className: string; overdueCount: number; totalDaysLate: number } } = {};

        overdueLoans.forEach(loan => {
            const className = loan.member?.class?.name || 'Tidak Ada Kelas';
            const daysLate = Math.floor((now.getTime() - new Date(loan.dueDate).getTime()) / (1000 * 60 * 60 * 24));

            if (!classStats[className]) {
                classStats[className] = { className, overdueCount: 0, totalDaysLate: 0 };
            }
            classStats[className].overdueCount++;
            classStats[className].totalDaysLate += daysLate;
        });

        const result = Object.values(classStats)
            .map(cs => ({
                ...cs,
                avgDaysLate: Math.round(cs.totalDaysLate / cs.overdueCount),
            }))
            .sort((a, b) => b.overdueCount - a.overdueCount);

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get late stats' });
    }
});

// Fine summary
router.get('/fine-summary', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const now = new Date();
        const finePerDay = 500; // Default Rp 500 per day

        // Get fine rate from settings
        const fineRateSetting = await prisma.settings.findUnique({
            where: { key: 'fine_rate_per_day' },
        });
        const fineRate = fineRateSetting ? parseInt(fineRateSetting.value) : finePerDay;

        // Calculate fines for all overdue loans
        const overdueLoans = await prisma.loan.findMany({
            where: {
                OR: [
                    { status: 'active', dueDate: { lt: now } },
                    { finedAmount: { gt: 0 } },
                ],
            },
            include: {
                member: { include: { class: true } },
            },
        });

        let totalUnpaidFines = 0;
        let totalPaidFines = 0;

        const finesByClass: { [key: string]: { className: string; unpaid: number; paid: number } } = {};

        overdueLoans.forEach(loan => {
            const className = loan.member?.class?.name || 'Tidak Ada Kelas';
            if (!finesByClass[className]) {
                finesByClass[className] = { className, unpaid: 0, paid: 0 };
            }

            if (loan.status === 'active' && new Date(loan.dueDate) < now) {
                const daysLate = Math.floor((now.getTime() - new Date(loan.dueDate).getTime()) / (1000 * 60 * 60 * 24));
                const fine = daysLate * fineRate;
                totalUnpaidFines += fine;
                finesByClass[className].unpaid += fine;
            }

            if (loan.finedAmount > 0) {
                totalPaidFines += loan.finedAmount;
                finesByClass[className].paid += loan.finedAmount;
            }
        });

        res.json({
            fineRate,
            totalUnpaidFines,
            totalPaidFines,
            finesByClass: Object.values(finesByClass).sort((a, b) => b.unpaid - a.unpaid),
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get fine summary' });
    }
});

export default router;


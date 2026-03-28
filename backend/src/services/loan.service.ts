import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class LoanService {
    async getAllLoans(params: {
        status?: string;
        memberId?: string;
        search?: string;
        page?: number;
        limit?: number;
    }) {
        const { status, memberId, search, page = 1, limit = 10 } = params;
        const skip = (page - 1) * limit;

        const where: any = {};
        if (status) where.status = status;
        if (memberId) where.memberId = parseInt(memberId);

        if (search) {
            where.OR = [
                { member: { name: { contains: search } } },
                { member: { nis: { contains: search } } },
                { items: { some: { book: { title: { contains: search } } } } },
            ];
        }

        const [loans, total] = await Promise.all([
            prisma.loan.findMany({
                where,
                skip,
                take: limit,
                include: {
                    member: { include: { class: true } },
                    items: { include: { book: true } },
                    createdBy: { select: { name: true } },
                },
                orderBy: { loanDate: 'desc' },
            }),
            prisma.loan.count({ where }),
        ]);

        return { loans, total, page, limit };
    }

    async getLoanHistory(params: any) {
        const page = params.page ? parseInt(params.page as string) : 1;
        const limit = params.limit ? parseInt(params.limit as string) : 20;
        const { memberId, classId, bookId, startDate, endDate, status } = params;
        const skip = (page - 1) * limit;

        const where: any = {};
        if (memberId) where.memberId = parseInt(memberId);
        if (classId) where.member = { classId: parseInt(classId) };
        if (status) where.status = status;
        if (startDate || endDate) {
            where.loanDate = {};
            if (startDate) where.loanDate.gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                where.loanDate.lte = end;
            }
        }

        if (bookId) {
            const itemsWithBook = await prisma.loanItem.findMany({
                where: { bookId: parseInt(bookId) },
                select: { loanId: true },
            });
            where.id = { in: itemsWithBook.map(i => i.loanId) };
        }

        const [loans, total] = await Promise.all([
            prisma.loan.findMany({
                where,
                skip,
                take: limit,
                include: {
                    member: { include: { class: true } },
                    items: { include: { book: true } },
                    createdBy: { select: { name: true } },
                },
                orderBy: { loanDate: 'desc' },
            }),
            prisma.loan.count({ where }),
        ]);

        const now = new Date();
        const enrichedLoans = loans.map(loan => {
            let computedStatus = loan.status;
            if (loan.status === 'active' && new Date(loan.dueDate) < now) {
                computedStatus = 'overdue';
            }
            const daysOverdue = loan.status === 'active' && new Date(loan.dueDate) < now
                ? Math.ceil((now.getTime() - new Date(loan.dueDate).getTime()) / (1000 * 60 * 60 * 24))
                : 0;

            return { ...loan, computedStatus, daysOverdue };
        });

        return { loans: enrichedLoans, total, page, limit };
    }

    async getOverdueLoans() {
        const now = new Date();
        const overdueLoans = await prisma.loan.findMany({
            where: { status: 'active', dueDate: { lt: now } },
            include: {
                member: { include: { class: true } },
                items: { include: { book: true } },
            },
            orderBy: { dueDate: 'asc' },
        });

        return overdueLoans.map(loan => ({
            ...loan,
            daysOverdue: Math.ceil((now.getTime() - new Date(loan.dueDate).getTime()) / (1000 * 60 * 60 * 24)),
            estimatedFine: Math.ceil((now.getTime() - new Date(loan.dueDate).getTime()) / (1000 * 60 * 60 * 24)) * 1000 * loan.items.length,
        }));
    }

    async getLoanById(id: number) {
        const loan = await prisma.loan.findUnique({
            where: { id },
            include: {
                member: { include: { class: true } },
                items: { include: { book: true } },
                createdBy: { select: { name: true } },
            },
        });
        if (!loan) throw { status: 404, message: 'Loan not found' };
        return loan;
    }

    async createLoan(data: { memberId: number; bookBarcodes: string[]; durationDays: number; userId: number }) {
        const { memberId, bookBarcodes, durationDays, userId } = data;

        const member = await prisma.member.findUnique({
            where: { id: memberId },
            include: { loans: { where: { status: 'active' }, include: { items: true } } },
        });

        if (!member) throw { status: 404, message: 'Member not found' };
        if (member.status !== 'active') throw { status: 400, message: 'Member is not active' };

        const maxBooksSetting = await prisma.settings.findUnique({ where: { key: 'max_books_per_loan' } });
        const maxBooks = parseInt(maxBooksSetting?.value || '3');

        const activeLoansCount = member.loans.reduce((acc, loan) => acc + loan.items.length, 0);
        if (activeLoansCount + bookBarcodes.length > maxBooks) {
            throw { status: 400, message: `Member can only borrow ${maxBooks - activeLoansCount} more books` };
        }

        const books = await prisma.book.findMany({ where: { barcode: { in: bookBarcodes } } });
        if (books.length !== bookBarcodes.length) throw { status: 400, message: 'Some books not found' };

        const unavailableBooks = books.filter(book => book.availableCopies < 1);
        if (unavailableBooks.length > 0) {
            throw { status: 400, message: 'Some books are not available', unavailable: unavailableBooks.map(b => b.title) };
        }

        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + durationDays);

        return await prisma.$transaction(async (tx) => {
            const newLoan = await tx.loan.create({
                data: {
                    memberId,
                    dueDate,
                    status: 'active',
                    createdById: userId,
                    items: { create: books.map(book => ({ bookId: book.id, status: 'borrowed' })) },
                },
                include: { member: { include: { class: true } }, items: { include: { book: true } } },
            });

            for (const book of books) {
                await tx.book.update({ where: { id: book.id }, data: { availableCopies: { decrement: 1 } } });
            }

            return { loan: newLoan, member, books };
        });
    }

    async returnBooks(bookBarcodes: string[]) {
        const books = await prisma.book.findMany({ where: { barcode: { in: bookBarcodes } } });
        if (books.length !== bookBarcodes.length) throw { status: 400, message: 'Some books not found' };

        const loanItems = await prisma.loanItem.findMany({
            where: { bookId: { in: books.map(b => b.id) }, status: 'borrowed' },
            include: { loan: { include: { member: true } }, book: true },
        });

        if (loanItems.length === 0) throw { status: 400, message: 'No active loans found for these books' };

        const now = new Date();
        const FINE_PER_DAY = 1000;
        let totalFine = 0;
        const returnedItems: any[] = [];

        await prisma.$transaction(async (tx) => {
            for (const item of loanItems) {
                let fine = 0;
                const dueDate = new Date(item.loan.dueDate);

                if (now > dueDate) {
                    const daysLate = Math.ceil((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
                    fine = daysLate * FINE_PER_DAY;
                }

                totalFine += fine;

                await tx.loanItem.update({ where: { id: item.id }, data: { status: 'returned', returnedAt: now } });

                if (item.bookId) {
                    await tx.book.update({ where: { id: item.bookId }, data: { availableCopies: { increment: 1 } } });
                }

                const remainingItems = await tx.loanItem.count({ where: { loanId: item.loanId, status: 'borrowed' } });

                if (remainingItems === 0) {
                    await tx.loan.update({ where: { id: item.loanId }, data: { status: 'returned', returnDate: now, finedAmount: { increment: fine } } });
                } else {
                    await tx.loan.update({ where: { id: item.loanId }, data: { finedAmount: { increment: fine } } });
                }

                returnedItems.push({
                    book: item.book?.title || 'Buku Dihapus',
                    member: item.loan.member?.name || 'Anggota Dihapus',
                    fine,
                    daysLate: fine > 0 ? fine / FINE_PER_DAY : 0,
                });
            }
        });

        return { returnedItems, totalFine };
    }
}

export const loanService = new LoanService();

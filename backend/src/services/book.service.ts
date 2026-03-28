import { PrismaClient } from '@prisma/client';
import ExcelJS from 'exceljs';

const prisma = new PrismaClient();

export class BookService {
    async getAllBooks(params: {
        search?: string;
        category?: string;
        availability?: string;
        rackLocation?: string;
        sortBy?: string;
        sortOrder?: string;
        page?: number;
        limit?: number;
    }) {
        const {
            search, category, availability, rackLocation,
            sortBy = 'title', sortOrder = 'asc',
            page = 1, limit = 10,
        } = params;
        const skip = (page - 1) * limit;

        const where: any = {};
        if (search) {
            where.OR = [
                { title: { contains: search } },
                { author: { contains: search } },
                { isbn: { contains: search } },
                { barcode: { contains: search } },
            ];
        }
        if (category) {
            where.category = category;
        }
        if (rackLocation) {
            where.rackLocation = rackLocation;
        }
        if (availability === 'available') {
            where.availableCopies = { gt: 0 };
        } else if (availability === 'borrowed') {
            where.loanItems = { some: { status: 'borrowed' } };
        } else if (availability === 'empty') {
            where.availableCopies = 0;
        }

        let orderBy: any = { title: 'asc' };
        const order = sortOrder === 'desc' ? 'desc' : 'asc';
        switch (sortBy) {
            case 'availableCopies': orderBy = { availableCopies: order }; break;
            case 'createdAt': orderBy = { createdAt: order }; break;
            default: orderBy = { title: order }; break;
        }

        const [books, total] = await Promise.all([
            prisma.book.findMany({
                where,
                skip,
                take: limit,
                orderBy,
            }),
            prisma.book.count({ where }),
        ]);

        return {
            books,
            total,
            totalPages: Math.ceil(total / limit),
            page,
            limit,
        };
    }

    async getBookById(id: number) {
        const book = await prisma.book.findUnique({
            where: { id },
            include: {
                loanItems: {
                    where: { status: 'borrowed' },
                    include: {
                        loan: {
                            include: { member: true },
                        },
                    },
                },
            },
        });
        if (!book) throw { status: 404, message: 'Book not found' };
        return book;
    }

    async getBookByBarcode(barcode: string) {
        const book = await prisma.book.findUnique({
            where: { barcode },
        });
        if (!book) throw { status: 404, message: 'Book not found' };
        return book;
    }

    async createBook(data: any) {
        try {
            return await prisma.book.create({
                data: {
                    ...data,
                    availableCopies: data.totalCopies || 1,
                },
            });
        } catch (error: any) {
            if (error.code === 'P2002') {
                throw { status: 400, message: 'ISBN or barcode already exists' };
            }
            throw error;
        }
    }

    async updateBook(id: number, data: any) {
        try {
            const existingBook = await prisma.book.findUnique({ where: { id } });
            if (!existingBook) throw { status: 404, message: 'Book not found' };

            const copyDifference = (data.totalCopies || existingBook.totalCopies) - existingBook.totalCopies;
            const newAvailable = existingBook.availableCopies + copyDifference;

            return await prisma.book.update({
                where: { id },
                data: {
                    ...data,
                    availableCopies: Math.max(0, newAvailable),
                },
            });
        } catch (error: any) {
            if (error.code === 'P2002') {
                throw { status: 400, message: 'ISBN or barcode already exists' };
            }
            throw error;
        }
    }

    async deleteBook(id: number) {
        const book = await prisma.book.findUnique({ where: { id } });
        if (!book) throw { status: 404, message: 'Book not found' };

        const activeLoanItems = await prisma.loanItem.findFirst({
            where: { bookId: id, status: 'borrowed' },
        });

        if (activeLoanItems) {
            throw { status: 400, message: 'Buku sedang dipinjam dan tidak bisa dihapus.' };
        }

        return await prisma.$transaction(async (tx: any) => {
            await tx.loanItem.updateMany({
                where: { bookId: id },
                data: { bookTitle: book.title, bookBarcode: book.barcode },
            });
            return await tx.book.delete({ where: { id } });
        });
    }

    async getCategories() {
        const categories = await prisma.book.findMany({
            select: { category: true },
            distinct: ['category'],
            where: { category: { not: null } },
        });
        return categories.map((c: any) => c.category).filter(Boolean);
    }

    async bulkDeleteBooks(params: {
        ids?: number[];
        selectAll?: boolean;
        excludeIds?: number[];
        filters?: any;
    }) {
        const { ids, selectAll, excludeIds, filters } = params;
        const where: any = {};

        if (selectAll) {
            if (filters?.search) {
                where.OR = [
                    { title: { contains: filters.search } },
                    { author: { contains: filters.search } },
                    { barcode: { contains: filters.search } },
                    { isbn: { contains: filters.search } },
                ];
            }
            if (excludeIds && excludeIds.length > 0) {
                where.id = { notIn: excludeIds };
            }
        } else if (ids && ids.length > 0) {
            where.id = { in: ids };
        } else {
            throw { status: 400, message: 'Pilih minimal 1 buku untuk dihapus' };
        }

        const books = await prisma.book.findMany({
            where,
            include: {
                loanItems: {
                    where: { status: 'borrowed' },
                },
            },
        });

        const toDelete = books.filter(b => b.loanItems.length === 0);
        const skipped = books.filter(b => b.loanItems.length > 0).map(b => b.title);

        if (toDelete.length === 0) {
            return { deleted: 0, skipped };
        }

        await prisma.$transaction(async (tx: any) => {
            for (const book of toDelete) {
                await tx.loanItem.updateMany({
                    where: { bookId: book.id },
                    data: { bookTitle: book.title, bookBarcode: book.barcode },
                });
            }
            return await tx.book.deleteMany({
                where: { id: { in: toDelete.map(b => b.id) } },
            });
        });

        return { deleted: toDelete.length, skipped };
    }

    async importBooks(buffer: Buffer) {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer as any);
        const worksheet = workbook.getWorksheet(1);

        if (!worksheet) {
            throw { status: 400, message: 'Format file tidak valid (Worksheet tidak ditemukan)' };
        }

        const stats = { success: 0, failed: 0, errors: [] as any[] };
        const rows: any[] = [];

        // Skip header row
        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;

            const isbn = row.getCell(1).text?.toString().trim();
            const title = row.getCell(2).text?.toString().trim();
            const author = row.getCell(3).text?.toString().trim();
            const publisher = row.getCell(4).text?.toString().trim();
            const category = row.getCell(5).text?.toString().trim();
            const rackLocation = row.getCell(6).text?.toString().trim();
            const totalCopies = parseInt(row.getCell(7).text?.toString()) || 1;

            if (!isbn || !title || !author) {
                stats.failed++;
                stats.errors.push({
                    row: rowNumber,
                    isbn: isbn || 'N/A',
                    error: 'ISBN, Judul, dan Pengarang wajib diisi',
                });
                return;
            }

            rows.push({
                isbn,
                barcode: isbn,
                title,
                author,
                publisher,
                category,
                rackLocation,
                totalCopies,
            });
        });

        for (const data of rows) {
            try {
                await prisma.book.upsert({
                    where: { isbn: data.isbn },
                    update: {
                        ...data,
                        availableCopies: { increment: data.totalCopies },
                    },
                    create: {
                        ...data,
                        availableCopies: data.totalCopies,
                    },
                });
                stats.success++;
            } catch (err: any) {
                stats.failed++;
                stats.errors.push({
                    row: rows.indexOf(data) + 2,
                    isbn: data.isbn,
                    error: err.message,
                });
            }
        }

        return { results: stats };
    }
}

export const bookService = new BookService();

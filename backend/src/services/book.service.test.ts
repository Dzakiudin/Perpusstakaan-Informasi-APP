import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BookService } from './book.service';

const mockPrisma = vi.hoisted(() => ({
    book: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        count: vi.fn(),
    },
}));

vi.mock('@prisma/client', () => {
    return {
        PrismaClient: class {
            constructor() {
                return mockPrisma;
            }
        },
    };
});

describe('BookService', () => {
    let bookService: BookService;

    beforeEach(() => {
        bookService = new BookService();
        vi.clearAllMocks();
    });

    it('should get all books with default pagination', async () => {
        const mockBooks = [{ id: 1, title: 'Book 1' }];
        mockPrisma.book.findMany.mockResolvedValue(mockBooks);
        mockPrisma.book.count.mockResolvedValue(1);

        const result = await bookService.getAllBooks({});

        expect(result.books).toEqual(mockBooks);
        expect(result.total).toBe(1);
    });

    it('should throw 404 if book not found by ID', async () => {
        mockPrisma.book.findUnique.mockResolvedValue(null);

        await expect(bookService.getBookById(999)).rejects.toMatchObject({
            status: 404,
            message: 'Book not found',
        });
    });
});

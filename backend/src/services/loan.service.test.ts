import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoanService } from './loan.service';

const mockPrisma = vi.hoisted(() => ({
    loan: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        count: vi.fn(),
    },
    member: {
        findUnique: vi.fn(),
    },
    book: {
        findUnique: vi.fn(),
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

describe('LoanService', () => {
    let loanService: LoanService;

    beforeEach(() => {
        loanService = new LoanService();
        vi.clearAllMocks();
    });

    it('should get all loans', async () => {
        const mockLoans = [{ id: 1, status: 'borrowed' }];
        mockPrisma.loan.findMany.mockResolvedValue(mockLoans);
        mockPrisma.loan.count.mockResolvedValue(1);

        const result = await loanService.getAllLoans({});

        expect(result.loans).toEqual(mockLoans);
        expect(result.total).toBe(1);
    });

    it('should throw 404 if loan not found', async () => {
        mockPrisma.loan.findUnique.mockResolvedValue(null);

        await expect(loanService.getLoanById(999)).rejects.toMatchObject({
            status: 404,
            message: 'Loan not found',
        });
    });

    it('should get loan history with filters', async () => {
        const mockLoans = [{ id: 1, status: 'returned' }];
        mockPrisma.loan.findMany.mockResolvedValue(mockLoans);
        mockPrisma.loan.count.mockResolvedValue(1);

        const result = await loanService.getLoanHistory({ page: '1', limit: '10' });

        expect(result.loans).toHaveLength(1);
        expect(mockPrisma.loan.findMany).toHaveBeenCalledWith(expect.objectContaining({
            skip: 0,
            take: 10
        }));
    });
});

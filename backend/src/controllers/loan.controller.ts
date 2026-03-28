import { Request, Response } from 'express';
import { loanService } from '../services/loan.service';
import { AuthRequest } from '../middleware/auth';
import { logAudit, getClientInfo } from '../utils/auditLog';
import { sendEmailNotification, emailTemplates } from '../utils/email';

export class LoanController {
    /**
     * @openapi
     * /api/loans:
     *   get:
     *     summary: Get all active loans
     *     tags: [Loans]
     *     parameters:
     *       - in: query
     *         name: status
     *         schema: { type: string }
     *       - in: query
     *         name: memberId
     *         schema: { type: integer }
     *     responses:
     *       200:
     *         description: List of loans
     */
    async getAll(req: AuthRequest, res: Response) {
        try {
            const { page, limit, ...filters } = req.query;
            const result = await loanService.getAllLoans({
                ...filters,
                page: page ? parseInt(page as string) : 1,
                limit: limit ? parseInt(limit as string) : 10,
            });
            return res.json({
                data: result.loans,
                pagination: {
                    page: result.page,
                    limit: result.limit,
                    total: result.total,
                    totalPages: Math.ceil(result.total / result.limit),
                },
            });
        } catch (error: any) {
            return res.status(error.status || 500).json({ error: error.message || 'Failed to get loans' });
        }
    }

    /**
     * @openapi
     * /api/loans/history:
     *   get:
     *     summary: Get loan history with advanced filters
     *     tags: [Loans]
     *     parameters:
     *       - in: query
     *         name: startDate
     *         schema: { type: string, format: date }
     *       - in: query
     *         name: endDate
     *         schema: { type: string, format: date }
     *     responses:
     *       200:
     *         description: Loan history data
     */
    async getHistory(req: AuthRequest, res: Response) {
        try {
            const result = await loanService.getLoanHistory(req.query);
            return res.json({
                data: result.loans,
                pagination: {
                    page: result.page,
                    limit: result.limit,
                    total: result.total,
                    totalPages: Math.ceil(result.total / result.limit),
                },
            });
        } catch (error: any) {
            return res.status(error.status || 500).json({ error: error.message || 'Failed to get history' });
        }
    }

    /**
     * @openapi
     * /api/loans/status/overdue:
     *   get:
     *     summary: Get list of overdue loans
     *     tags: [Loans]
     *     responses:
     *       200:
     *         description: Overdue loans with fine estimate
     */
    async getOverdue(req: AuthRequest, res: Response) {
        try {
            const overdue = await loanService.getOverdueLoans();
            return res.json(overdue);
        } catch (error: any) {
            return res.status(error.status || 500).json({ error: error.message || 'Failed to get overdue loans' });
        }
    }

    /**
     * @openapi
     * /api/loans:
     *   post:
     *     summary: Create a new loan (peminjaman)
     *     tags: [Loans]
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               memberId: { type: integer }
     *               bookBarcodes: { type: array, items: { type: string } }
     *               durationDays: { type: integer, default: 7 }
     *     responses:
     *       201:
     *         description: Loan created successfully
     */
    async getById(req: AuthRequest, res: Response) {
        try {
            const loan = await loanService.getLoanById(parseInt(req.params.id));
            return res.json(loan);
        } catch (error: any) {
            return res.status(error.status || 500).json({ error: error.message || 'Failed to get loan' });
        }
    }

    async create(req: AuthRequest, res: Response) {
        try {
            const { memberId, bookBarcodes, durationDays = 7 } = req.body;
            const result = await loanService.createLoan({
                memberId: parseInt(memberId),
                bookBarcodes,
                durationDays,
                userId: req.user!.id,
            });

            // Log & Email
            const clientInfo = getClientInfo(req);
            await logAudit({
                userId: req.user?.id,
                action: 'LOAN',
                entity: 'Loan',
                entityId: result.loan.id,
                details: {
                    memberId,
                    memberName: result.member.name,
                    books: result.books.map((b: any) => ({ id: b.id, title: b.title })),
                    dueDate: result.loan.dueDate,
                },
                ...clientInfo,
            });

            const emailHtml = emailTemplates.loanNotification(
                result.member.name,
                result.books.map((b: any) => ({ title: b.title })),
                result.loan.dueDate
            );
            sendEmailNotification(`[Peminjaman] ${result.member.name}`, emailHtml);

            return res.status(201).json(result.loan);
        } catch (error: any) {
            return res.status(error.status || 500).json({ error: error.message || 'Failed to create loan' });
        }
    }

    /**
     * @openapi
     * /api/loans/return:
     *   post:
     *     summary: Return borrowed books (pengembalian)
     *     tags: [Loans]
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               bookBarcodes: { type: array, items: { type: string } }
     *     responses:
     *       200:
     *         description: Books returned with fine details
     */
    async returnItems(req: AuthRequest, res: Response) {
        try {
            const { bookBarcodes } = req.body;
            const result = await loanService.returnBooks(bookBarcodes);

            // Log & Email
            const clientInfo = getClientInfo(req);
            await logAudit({
                userId: req.user?.id,
                action: 'RETURN',
                entity: 'Loan',
                details: { returnedBooks: result.returnedItems, totalFine: result.totalFine },
                ...clientInfo,
            });

            if (result.returnedItems.length > 0) {
                const memberName = result.returnedItems[0].member;
                const emailHtml = emailTemplates.returnNotification(memberName, result.returnedItems, result.totalFine);
                sendEmailNotification(`[Pengembalian] ${memberName}`, emailHtml);
            }

            return res.json(result);
        } catch (error: any) {
            return res.status(error.status || 500).json({ error: error.message || 'Failed to process return' });
        }
    }
}

export const loanController = new LoanController();

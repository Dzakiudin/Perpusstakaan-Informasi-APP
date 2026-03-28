import { Request, Response } from 'express';
import { bookService } from '../services/book.service';
import bwipjs from 'bwip-js';
import QRCode from 'qrcode';

export class BookController {
    /**
     * @openapi
     * /api/books:
     *   get:
     *     summary: Get all books with filters and pagination
     *     tags: [Books]
     *     parameters:
     *       - in: query
     *         name: search
     *         schema: { type: string }
     *       - in: query
     *         name: page
     *         schema: { type: integer, default: 1 }
     *       - in: query
     *         name: limit
     *         schema: { type: integer, default: 10 }
     *     responses:
     *       200:
     *         description: List of books
     */
    async getAll(req: Request, res: Response) {
        try {
            const { page, limit, ...filters } = req.query;
            const result = await bookService.getAllBooks({
                ...filters,
                page: page ? parseInt(page as string) : 1,
                limit: limit ? parseInt(limit as string) : 10,
            });
            return res.json({
                data: result.books,
                pagination: {
                    page: result.page,
                    limit: result.limit,
                    total: result.total,
                    totalPages: result.totalPages,
                },
            });
        } catch (error: any) {
            return res.status(error.status || 500).json({ error: error.message || 'Failed to get books' });
        }
    }

    /**
     * @openapi
     * /api/books/{id}:
     *   get:
     *     summary: Get book by ID
     *     tags: [Books]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema: { type: integer }
     *     responses:
     *       200:
     *         description: Book data
     *       404:
     *         description: Book not found
     */
    async getById(req: Request, res: Response) {
        try {
            const book = await bookService.getBookById(parseInt(req.params.id));
            return res.json(book);
        } catch (error: any) {
            return res.status(error.status || 500).json({ error: error.message || 'Failed to get book' });
        }
    }

    /**
     * @openapi
     * /api/books/barcode/{barcode}:
     *   get:
     *     summary: Get book by Barcode
     *     tags: [Books]
     *     parameters:
     *       - in: path
     *         name: barcode
     *         required: true
     *         schema: { type: string }
     *     responses:
     *       200:
     *         description: Book data
     *       404:
     *         description: Book not found
     */
    async getByBarcode(req: Request, res: Response) {
        try {
            const book = await bookService.getBookByBarcode(req.params.barcode);
            return res.json(book);
        } catch (error: any) {
            return res.status(error.status || 500).json({ error: error.message || 'Failed to get book' });
        }
    }

    /**
     * @openapi
     * /api/books:
     *   post:
     *     summary: Create a new book
     *     tags: [Books]
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/BookInput'
     *     responses:
     *       201:
     *         description: Book created
     */
    async create(req: Request, res: Response) {
        try {
            const book = await bookService.createBook(req.body);
            return res.status(201).json(book);
        } catch (error: any) {
            return res.status(error.status || 500).json({ error: error.message || 'Failed to create book' });
        }
    }

    /**
     * @openapi
     * /api/books/{id}:
     *   put:
     *     summary: Update an existing book
     *     tags: [Books]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema: { type: integer }
     *     requestBody:
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/BookInput'
     *     responses:
     *       200:
     *         description: Book updated
     */
    async update(req: Request, res: Response) {
        try {
            const book = await bookService.updateBook(parseInt(req.params.id), req.body);
            return res.json(book);
        } catch (error: any) {
            return res.status(error.status || 500).json({ error: error.message || 'Failed to update book' });
        }
    }

    /**
     * @openapi
     * /api/books/{id}:
     *   delete:
     *     summary: Delete a book
     *     tags: [Books]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema: { type: integer }
     *     responses:
     *       200:
     *         description: Book deleted
     */
    async delete(req: Request, res: Response) {
        try {
            await bookService.deleteBook(parseInt(req.params.id));
            return res.json({ message: 'Buku berhasil dihapus' });
        } catch (error: any) {
            return res.status(error.status || 500).json({ error: error.message || 'Failed to delete book' });
        }
    }

    /**
     * @openapi
     * /api/books/{id}/barcode.png:
     *   get:
     *     summary: Generate barcode image for a book
     *     tags: [Books]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema: { type: integer }
     *     responses:
     *       200:
     *         content:
     *           image/png:
     *             schema: { type: string, format: binary }
     */
    async getBarcode(req: Request, res: Response) {
        try {
            const book = await bookService.getBookById(parseInt(req.params.id));
            const png = await bwipjs.toBuffer({
                bcid: 'code128',
                text: book.barcode,
                scale: 3,
                height: 10,
                includetext: true,
                textxalign: 'center',
            });
            res.setHeader('Content-Type', 'image/png');
            res.send(png);
        } catch (error: any) {
            res.status(500).json({ error: 'Failed to generate barcode' });
        }
    }

    async getQrCode(req: Request, res: Response) {
        try {
            const book = await bookService.getBookById(parseInt(req.params.id));
            const qrData = JSON.stringify({
                type: 'book',
                id: book.id,
                barcode: book.barcode,
                title: book.title,
            });
            const png = await QRCode.toBuffer(qrData, {
                errorCorrectionLevel: 'M',
                type: 'png',
                margin: 1,
                width: 200,
            });
            res.setHeader('Content-Type', 'image/png');
            res.send(png);
        } catch (error: any) {
            res.status(500).json({ error: 'Failed to generate QR code' });
        }
    }

    async getCategories(req: Request, res: Response) {
        try {
            const categories = await bookService.getCategories();
            return res.json(categories);
        } catch (error: any) {
            res.status(500).json({ error: 'Failed to get categories' });
        }
    }

    async bulkDelete(req: Request, res: Response) {
        try {
            const result = await bookService.bulkDeleteBooks(req.body);
            return res.json(result);
        } catch (error: any) {
            return res.status(error.status || 500).json({ error: error.message || 'Failed to bulk delete books' });
        }
    }

    async import(req: Request, res: Response) {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'Tidak ada file yang diupload' });
            }
            const result = await bookService.importBooks(req.file.buffer);
            return res.json(result);
        } catch (error: any) {
            return res.status(error.status || 500).json({ error: error.message || 'Failed to import books' });
        }
    }
}

export const bookController = new BookController();

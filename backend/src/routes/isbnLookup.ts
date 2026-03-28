import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router: Router = Router();
const prisma = new PrismaClient();

// Cache for book lookups (simple in-memory cache)
const bookCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Lookup book by ISBN
router.get('/lookup/:isbn', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const isbn = req.params.isbn.replace(/[-\s]/g, '');
        console.log('Backend ISBN lookup:', isbn);

        // Check cache first
        const cached = bookCache.get(isbn);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            console.log('Returning cached result for:', isbn);
            return res.json(cached.data);
        }

        // Try Google Books API
        try {
            const googleRes = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
            const googleData: any = await googleRes.json();
            console.log('Google Books API response for', isbn, ':', JSON.stringify(googleData).substring(0, 200));

            if (googleData.items && googleData.items.length > 0) {
                const volumeInfo = googleData.items[0].volumeInfo;
                const result = {
                    found: true,
                    source: 'google',
                    isbn,
                    title: volumeInfo.title || '',
                    author: volumeInfo.authors?.join(', ') || '',
                    publisher: volumeInfo.publisher || '',
                    category: volumeInfo.categories?.[0] || '',
                    description: volumeInfo.description || '',
                    thumbnail: volumeInfo.imageLinks?.thumbnail || '',
                };

                // Cache the result
                bookCache.set(isbn, { data: result, timestamp: Date.now() });
                return res.json(result);
            }
        } catch (googleErr) {
            console.error('Google Books API error:', googleErr);
        }

        // Try Open Library API
        try {
            const openLibRes = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&jscmd=data&format=json`);
            const openLibData: any = await openLibRes.json();
            console.log('Open Library API response for', isbn);

            const bookData = openLibData[`ISBN:${isbn}`];
            if (bookData) {
                const result = {
                    found: true,
                    source: 'openlibrary',
                    isbn,
                    title: bookData.title || '',
                    author: bookData.authors?.map((a: any) => a.name).join(', ') || '',
                    publisher: bookData.publishers?.map((p: any) => p.name).join(', ') || '',
                    category: bookData.subjects?.[0]?.name || '',
                    description: '',
                    thumbnail: bookData.cover?.medium || '',
                };

                bookCache.set(isbn, { data: result, timestamp: Date.now() });
                return res.json(result);
            }
        } catch (openLibErr) {
            console.error('Open Library API error:', openLibErr);
        }

        // Not found in any database
        const notFoundResult = {
            found: false,
            source: null,
            isbn,
            message: 'Buku tidak ditemukan di database Google Books atau Open Library. Buku terbitan Indonesia mungkin tidak terdaftar di database internasional.',
        };

        // Cache "not found" for shorter time (1 hour)
        bookCache.set(isbn, { data: notFoundResult, timestamp: Date.now() - CACHE_TTL + 3600000 });
        return res.json(notFoundResult);

    } catch (error) {
        console.error('ISBN lookup error:', error);
        res.status(500).json({ error: 'Failed to lookup ISBN' });
    }
});

// Manual add book info to cache (for future use)
router.post('/cache', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const { isbn, title, author, publisher, category } = req.body;

        if (!isbn || !title) {
            return res.status(400).json({ error: 'ISBN and title are required' });
        }

        const result = {
            found: true,
            source: 'manual',
            isbn: isbn.replace(/[-\s]/g, ''),
            title,
            author: author || '',
            publisher: publisher || '',
            category: category || '',
        };

        bookCache.set(result.isbn, { data: result, timestamp: Date.now() });
        res.json({ message: 'Book info cached successfully', data: result });
    } catch (error) {
        res.status(500).json({ error: 'Failed to cache book info' });
    }
});

// Search books by title (alternative when ISBN not found)
router.get('/search', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const query = req.query.q as string;
        if (!query || query.length < 2) {
            return res.status(400).json({ error: 'Search query too short' });
        }

        console.log('--- START OPTIMIZED BOOK SEARCH ---');
        console.log('Query:', query);

        // 1. Search local database first
        const localBooks = await prisma.book.findMany({
            where: {
                OR: [
                    { title: { contains: query } },
                    { author: { contains: query } },
                    { isbn: { contains: query } },
                ]
            },
            take: 10
        });

        console.log(`Local DB: found ${localBooks.length} items`);

        const localResults = localBooks.map(b => ({
            title: b.title,
            author: b.author,
            publisher: b.publisher || '',
            isbn: b.isbn,
            category: b.category || '',
            thumbnail: '', // Local doesn't store thumbnails yet
            source: 'local'
        }));

        // Use a Map to combine results, keyed by cleaned ISBN
        const resultsMap = new Map();
        localResults.forEach(r => {
            const cleanIsbn = r.isbn.replace(/\D/g, '');
            if (cleanIsbn) resultsMap.set(cleanIsbn, r);
        });

        // 2 & 3. Parallel fetching from Google and Open Library
        // For Open Library, we must specify ?fields to get ISBN in search results
        const googleUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=10`;
        const olUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&fields=title,author_name,isbn,publisher,cover_i,subject&limit=20`;

        const [googleRes, olRes] = await Promise.allSettled([
            fetch(googleUrl).then(r => r.status === 429 ? Promise.reject('429') : r.json()),
            fetch(olUrl).then(r => r.json())
        ]);

        // Process Google Books
        if (googleRes.status === 'fulfilled' && (googleRes.value as any).items) {
            console.log(`Google Books: processing ${(googleRes.value as any).items.length} items`);
            (googleRes.value as any).items.forEach((item: any) => {
                const v = item.volumeInfo;
                const idents = v.industryIdentifiers || [];
                const isbnObj = idents.find((id: any) => id.type === 'ISBN_13') || idents.find((id: any) => id.type === 'ISBN_10');
                const isbn = isbnObj ? isbnObj.identifier.replace(/\D/g, '') : '';

                if (isbn && !resultsMap.has(isbn)) {
                    resultsMap.set(isbn, {
                        title: v.title || '',
                        author: v.authors?.join(', ') || '',
                        publisher: v.publisher || '',
                        isbn: isbn,
                        category: v.categories?.[0] || '',
                        thumbnail: v.imageLinks?.thumbnail || '',
                        source: 'google'
                    });
                }
            });
        }

        // Process Open Library
        if (olRes.status === 'fulfilled' && (olRes.value as any).docs) {
            console.log(`Open Library: processing ${(olRes.value as any).docs.length} items`);
            (olRes.value as any).docs.forEach((doc: any) => {
                const isbnList = doc.isbn || [];
                if (isbnList.length === 0) return;

                // Priority: ISBN-13 beginning with 978/979
                const bestRawIsbn = isbnList.find((id: string) => id.length === 13 && (id.startsWith('978') || id.startsWith('979'))) || isbnList[0];
                const cleanIsbn = bestRawIsbn.replace(/\D/g, '');

                if (cleanIsbn && !resultsMap.has(cleanIsbn)) {
                    resultsMap.set(cleanIsbn, {
                        title: doc.title || '',
                        author: doc.author_name?.join(', ') || '',
                        publisher: doc.publisher?.[0] || '',
                        isbn: cleanIsbn,
                        category: doc.subject?.[0] || '',
                        thumbnail: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : '',
                        source: 'openlibrary'
                    });
                }
            });
        }

        const combinedResults = Array.from(resultsMap.values());
        console.log(`Final unique results with ISBN: ${combinedResults.length}`);
        console.log('--- END BOOK SEARCH ---');

        if (combinedResults.length > 0) {
            return res.json({ found: true, results: combinedResults });
        }

        return res.json({
            found: false,
            results: [],
            message: 'Tidak ada buku dengan data ISBN yang ditemukan. Mohon coba kata kunci lain atau input manual.'
        });

    } catch (error) {
        console.error('SEARCH ENDPOINT ERROR:', error);
        res.status(500).json({ error: 'Gagal melakukan pencarian buku.' });
    }
});

export default router;

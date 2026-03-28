import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import BarcodeScanner from '../components/BarcodeScanner';

interface Book {
    id: number;
    isbn: string;
    barcode: string;
    title: string;
    author: string;
    publisher: string | null;
    category: string | null;
    rackLocation: string | null;
    totalCopies: number;
    availableCopies: number;
}

interface Stats {
    totalBooks: number;
    activeLoans: number;
    availableBooks: number;
}

export default function Books() {
    const [books, setBooks] = useState<Book[]>([]);
    const [stats, setStats] = useState<Stats>({ totalBooks: 0, activeLoans: 0, availableBooks: 0 });
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingBook, setEditingBook] = useState<Book | null>(null);
    const [formData, setFormData] = useState({
        isbn: '',
        barcode: '',
        title: '',
        author: '',
        publisher: '',
        category: '',
        rackLocation: '',
        totalCopies: 1,
    });
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
    const [showScanner, setShowScanner] = useState(false);
    const [lookingUp, setLookingUp] = useState(false);
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [showSearchResults, setShowSearchResults] = useState(false);
    const [titleSearch, setTitleSearch] = useState('');

    // Bulk Selection State
    // Bulk Selection State
    const [selectedBooks, setSelectedBooks] = useState<number[]>([]);
    const [selectAllGlobal, setSelectAllGlobal] = useState(false);
    const [excludedIds, setExcludedIds] = useState<number[]>([]);
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);

    // Filter State
    const [showFilterPopover, setShowFilterPopover] = useState(false);
    const [filterCategory, setFilterCategory] = useState('');
    const [filterAvailability, setFilterAvailability] = useState('');
    const [filterRackLocation, setFilterRackLocation] = useState('');
    const [sortBy, setSortBy] = useState('title');
    const [sortOrder, setSortOrder] = useState('asc');
    const filterBtnRef = useRef<HTMLDivElement>(null);

    const activeFilterCount = [filterCategory, filterAvailability, filterRackLocation].filter(Boolean).length +
        (sortBy !== 'title' || sortOrder !== 'asc' ? 1 : 0);

    // Import State
    const [showImportModal, setShowImportModal] = useState(false);
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState<{
        success: number;
        failed: number;
        errors: { row: number; isbn: string; error: string }[];
    } | null>(null);
    const fileInputRef = useState<{ current: HTMLInputElement | null }>({ current: null })[0];

    const fetchData = async (page = 1) => {
        try {
            setLoading(true);
            const [booksRes, statsRes] = await Promise.all([
                api.get('/books', {
                    params: {
                        search, page, limit: 5,
                        category: filterCategory || undefined,
                        availability: filterAvailability || undefined,
                        rackLocation: filterRackLocation || undefined,
                        sortBy, sortOrder,
                    },
                }),
                api.get('/dashboard') // Reusing dashboard endpoint for stats
            ]);

            setBooks(booksRes.data.data);
            setPagination(booksRes.data.pagination);

            // Calculate stats from dashboard data
            const dashboardStats = statsRes.data.stats;
            setStats({
                totalBooks: dashboardStats.totalBooks,
                activeLoans: dashboardStats.activeLoans,
                availableBooks: dashboardStats.totalBooks - dashboardStats.activeLoans // Approximation
            });

        } catch (error) {
            console.error('Failed to fetch data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchData(1);
            // Reset selection on search change
            setSelectAllGlobal(false);
            setExcludedIds([]);
            setSelectedBooks([]);
        }, 500);
        return () => clearTimeout(timer);
    }, [search]);

    // Re-fetch when filters change
    useEffect(() => {
        fetchData(1);
        setSelectAllGlobal(false);
        setExcludedIds([]);
        setSelectedBooks([]);
    }, [filterCategory, filterAvailability, filterRackLocation, sortBy, sortOrder]);

    // Close filter popover on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (filterBtnRef.current && !filterBtnRef.current.contains(e.target as Node)) {
                setShowFilterPopover(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const clearFilters = () => {
        setFilterCategory('');
        setFilterAvailability('');
        setFilterRackLocation('');
        setSortBy('title');
        setSortOrder('asc');
    };

    const openModal = (book?: Book) => {
        setError('');
        if (book) {
            setEditingBook(book);
            setFormData({
                isbn: book.isbn,
                barcode: book.barcode,
                title: book.title,
                author: book.author,
                publisher: book.publisher || '',
                category: book.category || '',
                rackLocation: book.rackLocation || '',
                totalCopies: book.totalCopies,
            });
        } else {
            setEditingBook(null);
            setFormData({
                isbn: '',
                barcode: '',
                title: '',
                author: '',
                publisher: '',
                category: '',
                rackLocation: '',
                totalCopies: 1,
            });
        }
        setShowModal(true);
    };

    // Lookup book data via backend proxy (avoids rate limiting)
    const lookupISBN = async (isbn: string) => {
        setLookingUp(true);
        setError('');
        try {
            // Clean ISBN (remove dashes and spaces)
            const cleanISBN = isbn.replace(/[-\s]/g, '');
            console.log('Looking up ISBN via backend:', cleanISBN);

            // Use backend proxy to avoid rate limiting
            const response = await api.get(`/isbn/lookup/${cleanISBN}`);
            const data = response.data;
            console.log('Backend lookup response:', data);

            if (data.found) {
                console.log('Found book:', data.title, 'by', data.author);
                setFormData(prev => ({
                    ...prev,
                    isbn: cleanISBN,
                    barcode: cleanISBN,
                    title: data.title || prev.title,
                    author: data.author || prev.author,
                    publisher: data.publisher || prev.publisher,
                    category: data.category || prev.category,
                }));
                setError('');
            } else {
                // Book not found
                console.log('Book not found for ISBN:', cleanISBN);
                setError(data.message || `ISBN ${cleanISBN} tidak ditemukan. Silakan input manual.`);
                setFormData(prev => ({ ...prev, isbn: cleanISBN, barcode: cleanISBN }));
            }
        } catch (err: any) {
            console.error('ISBN lookup error:', err);
            setError('Gagal mencari data buku. Silakan input manual.');
            setFormData(prev => ({ ...prev, isbn: isbn.replace(/[-\s]/g, ''), barcode: isbn.replace(/[-\s]/g, '') }));
        } finally {
            setLookingUp(false);
            setShowScanner(false);
        }
    };

    // Search books by title (alternative to ISBN lookup)
    const searchByTitle = async () => {
        if (!titleSearch || titleSearch.length < 2) {
            setError('Masukkan minimal 2 karakter untuk pencarian.');
            return;
        }
        setLookingUp(true);
        setError('');
        try {
            const response = await api.get(`/isbn/search?q=${encodeURIComponent(titleSearch)}`);
            const data = response.data;
            console.log('Title search response:', data);

            if (data.found && data.results.length > 0) {
                setSearchResults(data.results);
                setShowSearchResults(true);
            } else {
                setError('Tidak ada buku ditemukan dengan kata kunci tersebut.');
                setSearchResults([]);
            }
        } catch (err) {
            console.error('Title search error:', err);
            setError('Gagal mencari buku. Coba lagi.');
        } finally {
            setLookingUp(false);
        }
    };

    // Select a book from search results
    const selectSearchResult = (result: any) => {
        setFormData(prev => ({
            ...prev,
            isbn: result.isbn || prev.isbn,
            barcode: result.isbn || prev.barcode,
            title: result.title || prev.title,
            author: result.author || prev.author,
            publisher: result.publisher || prev.publisher,
            category: result.category || prev.category,
        }));
        setShowSearchResults(false);
        setTitleSearch('');
        setSearchResults([]);
        setTitleSearch('');
        setSearchResults([]);
    };

    // Bulk Actions
    const toggleSelectAll = () => {
        if (selectAllGlobal) {
            setSelectAllGlobal(false);
            setExcludedIds([]);
            setSelectedBooks([]);
        } else if (selectedBooks.length === books.length && books.length > 0) {
            setSelectedBooks([]);
        } else {
            setSelectedBooks(books.map(b => b.id));
        }
    };

    const handleSelectAllGlobal = () => {
        setSelectAllGlobal(true);
        setExcludedIds([]);
        setSelectedBooks(books.map(b => b.id)); // Visual consistency
    };

    const toggleSelectBook = (id: number) => {
        if (selectAllGlobal) {
            if (excludedIds.includes(id)) {
                setExcludedIds(excludedIds.filter(eId => eId !== id));
            } else {
                setExcludedIds([...excludedIds, id]);
            }
        } else {
            if (selectedBooks.includes(id)) {
                setSelectedBooks(selectedBooks.filter(bookId => bookId !== id));
            } else {
                setSelectedBooks([...selectedBooks, id]);
            }
        }
    };

    const isBookSelected = (id: number) => {
        if (selectAllGlobal) {
            return !excludedIds.includes(id);
        }
        return selectedBooks.includes(id);
    };

    const totalSelected = selectAllGlobal
        ? pagination.total - excludedIds.length
        : selectedBooks.length;

    const handleBulkDelete = async () => {
        if (totalSelected === 0) return;

        if (!confirm(`Yakin ingin menghapus ${totalSelected} buku terpilih?`)) return;

        setIsBulkDeleting(true);
        try {
            const response = await api.post('/books/bulk-delete', {
                ids: selectAllGlobal ? [] : selectedBooks,
                selectAll: selectAllGlobal,
                excludeIds: excludedIds,
                filters: { search }
            });
            const { deleted, skipped } = response.data;

            let message = `${deleted} buku berhasil dihapus.`;
            if (skipped && skipped.length > 0) {
                message += `\n${skipped.length} buku dilewati karena sedang dipinjam.`;
            }

            alert(message);
            setSelectedBooks([]);
            setSelectAllGlobal(false);
            setExcludedIds([]);
            fetchData(pagination.page);
        } catch (err: any) {
            alert(err.response?.data?.error || 'Gagal menghapus buku');
        } finally {
            setIsBulkDeleting(false);
        }
    };

    // Import Actions
    const handleDownloadTemplate = async () => {
        try {
            const response = await api.get('/books/import/template', {
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'template-import-buku.xlsx');
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            console.error('Failed to download template:', err);
        }
    };

    const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImporting(true);
        setImportResult(null);
        setError('');

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await api.post('/books/import', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setImportResult(response.data.results);
            fetchData(1);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Gagal import data');
        } finally {
            setImporting(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSaving(true);

        try {
            if (editingBook) {
                await api.put(`/books/${editingBook.id}`, formData);
            } else {
                await api.post('/books', formData);
            }
            setShowModal(false);
            fetchData(pagination.page);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Gagal menyimpan buku');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Yakin ingin menghapus buku ini?')) return;

        try {
            await api.delete(`/books/${id}`);
            fetchData(pagination.page);
        } catch (err: any) {
            alert(err.response?.data?.error || 'Gagal menghapus buku');
        }
    };

    // Helper for category badge color
    const getCategoryColor = (category: string | null) => {
        const cat = category?.toLowerCase() || '';
        if (cat.includes('novel')) return 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-500/20';
        if (cat.includes('pelajaran')) return 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-500/20';
        return 'bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700';
    };

    return (
        <div className="space-y-6">
            {/* Header Actions */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-96">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                            <span className="material-icons-round text-lg">search</span>
                        </span>
                        <input
                            className="block w-full pl-10 pr-3 py-2.5 bg-surface-light dark:bg-surface-dark border border-slate-200 dark:border-slate-700 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm text-slate-800 dark:text-slate-200"
                            placeholder="Cari judul, pengarang, atau ISBN..."
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    {/* Filter Button */}
                    <div className="relative" ref={filterBtnRef}>
                        <button
                            onClick={() => setShowFilterPopover(!showFilterPopover)}
                            className={`flex items-center space-x-1.5 px-3 py-2.5 border rounded-xl text-sm font-medium transition-all shadow-sm ${activeFilterCount > 0
                                ? 'bg-primary/10 border-primary/30 text-primary dark:bg-primary/20 dark:border-primary/40 dark:text-primary'
                                : 'bg-surface-light dark:bg-surface-dark border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                                }`}
                        >
                            <span className="material-icons-round text-lg">tune</span>
                            <span className="hidden sm:inline">Filter</span>
                            {activeFilterCount > 0 && (
                                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-white text-xs font-bold">
                                    {activeFilterCount}
                                </span>
                            )}
                        </button>

                        {/* Filter Popover */}
                        {showFilterPopover && (
                            <div className="absolute right-0 top-full mt-2 w-80 bg-surface-light dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl z-50 p-4 space-y-4 animate-fade-in">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-semibold text-slate-800 dark:text-white text-sm">Filter & Urutan</h4>
                                    {activeFilterCount > 0 && (
                                        <button onClick={clearFilters} className="text-xs text-primary hover:underline">Reset</button>
                                    )}
                                </div>

                                {/* Category Filter */}
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Kategori</label>
                                    <select
                                        value={filterCategory}
                                        onChange={(e) => setFilterCategory(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                    >
                                        <option value="">Semua Kategori</option>
                                        <option value="Novel">Novel</option>
                                        <option value="Pelajaran">Pelajaran</option>
                                        <option value="Referensi">Referensi</option>
                                        <option value="Majalah">Majalah</option>
                                        <option value="Ensiklopedia">Ensiklopedia</option>
                                        <option value="Komik">Komik</option>
                                    </select>
                                </div>

                                {/* Availability Filter */}
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Status Ketersediaan</label>
                                    <select
                                        value={filterAvailability}
                                        onChange={(e) => setFilterAvailability(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                    >
                                        <option value="">Semua</option>
                                        <option value="available">Tersedia</option>
                                        <option value="borrowed">Sedang Dipinjam</option>
                                        <option value="empty">Habis</option>
                                    </select>
                                </div>

                                {/* Sort */}
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Urutan</label>
                                    <div className="flex gap-2">
                                        <select
                                            value={sortBy}
                                            onChange={(e) => setSortBy(e.target.value)}
                                            className="flex-1 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                        >
                                            <option value="title">Judul</option>
                                            <option value="availableCopies">Stok</option>
                                            <option value="createdAt">Terbaru</option>
                                        </select>
                                        <button
                                            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                                            className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                                            title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                                        >
                                            <span className="material-icons-round text-sm">
                                                {sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                                            </span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex items-center space-x-3">
                    <button
                        onClick={() => setShowImportModal(true)}
                        className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition-all shadow-lg shadow-emerald-500/25"
                    >
                        <span className="material-icons-round text-lg">upload_file</span>
                        <span>Import Excel</span>
                    </button>
                    <button
                        onClick={() => openModal()}
                        className="flex items-center justify-center space-x-2 px-6 py-2.5 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl transition-all shadow-lg shadow-primary/25 active:scale-95"
                    >
                        <span className="material-icons-round text-lg">add</span>
                        <span>Tambah Buku</span>
                    </button>
                </div>
            </div>

            {/* Data Indicator */}
            {!loading && (
                <div className="text-sm text-slate-500 dark:text-slate-400">
                    Menampilkan {books.length} dari {pagination.total} data
                </div>
            )}

            {/* Bulk Action Bar & Selection Banner */}
            {(selectedBooks.length > 0 || selectAllGlobal) && (
                <div className="space-y-2">
                    {/* Global Selection Banner */}
                    {!selectAllGlobal && selectedBooks.length === books.length && pagination.total > books.length && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-lg text-sm text-center text-slate-600 dark:text-slate-300 border border-blue-100 dark:border-blue-800 animate-fade-in">
                            Semua <strong>{books.length}</strong> buku di halaman ini dipilih.
                            <button
                                onClick={handleSelectAllGlobal}
                                className="ml-2 font-bold text-blue-600 dark:text-blue-400 hover:underline focus:outline-none"
                            >
                                Pilih semua {pagination.total} buku di database
                            </button>
                        </div>
                    )}

                    {selectAllGlobal && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-lg text-sm text-center text-slate-600 dark:text-slate-300 border border-blue-100 dark:border-blue-800 animate-fade-in">
                            Semua <strong>{pagination.total}</strong> buku dipilih.
                            {excludedIds.length > 0 && <span> (kecuali {excludedIds.length} item)</span>}
                            <button
                                onClick={toggleSelectAll}
                                className="ml-2 font-bold text-blue-600 dark:text-blue-400 hover:underline focus:outline-none"
                            >
                                Batalkan pilihan
                            </button>
                        </div>
                    )}

                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-between animate-fade-in-up">
                        <div className="flex items-center space-x-3">
                            <span className="flex items-center justify-center min-w-[2rem] px-2 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                                {totalSelected}
                            </span>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                buku terpilih
                            </span>
                        </div>
                        <button
                            onClick={handleBulkDelete}
                            disabled={isBulkDeleting}
                            className="flex items-center space-x-2 px-4 py-2 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 font-semibold rounded-lg hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors disabled:opacity-50"
                        >
                            {isBulkDeleting ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-red-600/30 border-t-red-600"></div>
                            ) : (
                                <span className="material-icons-round text-lg">delete</span>
                            )}
                            <span>Hapus Terpilih</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="bg-surface-light dark:bg-surface-dark rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                                <th className="px-6 py-4 w-4">
                                    <div className="flex items-center justify-center">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                                            checked={books.length > 0 && (selectAllGlobal || selectedBooks.length === books.length)}
                                            onChange={toggleSelectAll}
                                        />
                                    </div>
                                </th>
                                <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Barcode</th>
                                <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Informasi Buku</th>
                                <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Kategori</th>
                                <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Lokasi</th>
                                <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-32">Stok</th>
                                <th className="px-6 py-4 text-center text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                                        <div className="flex justify-center items-center">
                                            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary mr-2"></div>
                                            Memuat data...
                                        </div>
                                    </td>
                                </tr>
                            ) : books.length > 0 ? (
                                books.map((book) => (
                                    <tr key={book.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group ${isBookSelected(book.id) ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                                        <td className="px-6 py-5 whitespace-nowrap">
                                            <div className="flex items-center justify-center">
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                                                    checked={isBookSelected(book.id)}
                                                    onChange={() => toggleSelectBook(book.id)}
                                                />
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 whitespace-nowrap">
                                            <span className="inline-flex px-2.5 py-1 text-xs font-mono font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-md">
                                                {book.barcode}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-semibold text-slate-900 dark:text-white">{book.title}</span>
                                                <span className="text-xs text-slate-500 dark:text-slate-400">{book.author}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 whitespace-nowrap">
                                            <span className={`inline-flex items-center px-3 py-1 text-[11px] font-bold rounded-full border uppercase tracking-tight ${getCategoryColor(book.category)}`}>
                                                {book.category || 'Umum'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 whitespace-nowrap">
                                            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{book.rackLocation || '-'}</span>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex flex-col space-y-1.5">
                                                <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 dark:text-slate-400">
                                                    <span>{book.availableCopies} / {book.totalCopies}</span>
                                                    <span className={book.availableCopies > 0 ? 'text-emerald-500' : 'text-red-500'}>
                                                        {book.availableCopies > 0 ? 'Tersedia' : 'Habis'}
                                                    </span>
                                                </div>
                                                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full ${book.availableCopies > 0 ? 'bg-emerald-500' : 'bg-red-500'}`}
                                                        style={{ width: `${(book.availableCopies / book.totalCopies) * 100}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 whitespace-nowrap text-center">
                                            <div className="flex justify-center space-x-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => openModal(book)}
                                                    className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                                                    title="Edit"
                                                >
                                                    <span className="material-icons-round text-lg">edit</span>
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(book.id)}
                                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all"
                                                    title="Hapus"
                                                >
                                                    <span className="material-icons-round text-lg">delete_outline</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center">
                                        <div className="flex flex-col items-center justify-center text-slate-400">
                                            <span className="material-icons-round text-4xl mb-2">menu_book</span>
                                            <p className="text-sm">Tidak ada data buku ditemukan</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between border-t border-slate-200 dark:border-slate-800 transition-colors">
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                        Menampilkan {books.length > 0 ? ((pagination.page - 1) * 5) + 1 : 0}-
                        {Math.min(pagination.page * 5, pagination.total)} dari {pagination.total} buku
                    </span>
                    <div className="flex space-x-2">
                        <button
                            className="p-2 text-slate-400 hover:text-primary disabled:opacity-30 transition-colors disabled:cursor-not-allowed"
                            disabled={pagination.page === 1}
                            onClick={() => fetchData(pagination.page - 1)}
                        >
                            <span className="material-icons-round text-sm">chevron_left</span>
                        </button>
                        <div className="flex items-center space-x-1">
                            {Array.from({ length: Math.min(3, pagination.totalPages) }, (_, i) => {
                                // Simplified pagination logic for display
                                let pageNum = pagination.page;
                                if (pagination.page === 1) pageNum = i + 1;
                                else if (pagination.page === pagination.totalPages) pageNum = pagination.totalPages - 2 + i;
                                else pageNum = pagination.page - 1 + i;

                                if (pageNum > 0 && pageNum <= pagination.totalPages) {
                                    return (
                                        <button
                                            key={pageNum}
                                            onClick={() => fetchData(pageNum)}
                                            className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${pagination.page === pageNum
                                                ? 'bg-primary text-white shadow-sm'
                                                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                                }`}
                                        >
                                            {pageNum}
                                        </button>
                                    );
                                }
                                return null;
                            })}
                        </div>
                        <button
                            className="p-2 text-slate-400 hover:text-primary disabled:opacity-30 transition-colors disabled:cursor-not-allowed"
                            disabled={pagination.page >= pagination.totalPages}
                            onClick={() => fetchData(pagination.page + 1)}
                        >
                            <span className="material-icons-round text-sm">chevron_right</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Bottom Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 md:gap-6 pt-4">
                <div className="p-4 bg-blue-50 dark:bg-blue-500/5 border border-blue-100 dark:border-blue-500/10 rounded-2xl flex items-center space-x-4">
                    <div className="w-12 h-12 bg-blue-500/10 text-blue-600 rounded-xl flex items-center justify-center">
                        <span className="material-icons-round">library_books</span>
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Total Koleksi</p>
                        <p className="text-xl font-bold text-slate-900 dark:text-white leading-none mt-1">{stats.totalBooks.toLocaleString()}</p>
                    </div>
                </div>
                <div className="p-4 bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/10 rounded-2xl flex items-center space-x-4">
                    <div className="w-12 h-12 bg-emerald-500/10 text-emerald-600 rounded-xl flex items-center justify-center">
                        <span className="material-icons-round">check_circle</span>
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Tersedia</p>
                        <p className="text-xl font-bold text-slate-900 dark:text-white leading-none mt-1">{stats.availableBooks.toLocaleString()}</p>
                    </div>
                </div>
                <div className="p-4 bg-amber-50 dark:bg-amber-500/5 border border-amber-100 dark:border-amber-500/10 rounded-2xl flex items-center space-x-4">
                    <div className="w-12 h-12 bg-amber-500/10 text-amber-600 rounded-xl flex items-center justify-center">
                        <span className="material-icons-round">pending</span>
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Sedang Dipinjam</p>
                        <p className="text-xl font-bold text-slate-900 dark:text-white leading-none mt-1">{stats.activeLoans.toLocaleString()}</p>
                    </div>
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowModal(false)}>
                    <div className="bg-surface-light dark:bg-surface-dark w-full max-w-2xl rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{editingBook ? 'Edit Buku' : 'Tambah Buku Baru'}</h3>
                            <div className="flex items-center space-x-2">
                                {!editingBook && (
                                    <button
                                        type="button"
                                        onClick={() => setShowScanner(true)}
                                        className="flex items-center space-x-1 px-3 py-1.5 text-sm font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors"
                                    >
                                        <span className="material-icons-round text-sm">qr_code_scanner</span>
                                        <span>Scan ISBN</span>
                                    </button>
                                )}
                                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-500 dark:hover:text-slate-300 transition-colors">
                                    <span className="material-icons-round">close</span>
                                </button>
                            </div>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="p-6 space-y-4">
                                {error && (
                                    <div className="p-3 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-sm rounded-lg">
                                        {error}
                                    </div>
                                )}

                                {lookingUp && (
                                    <div className="p-3 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-sm rounded-lg flex items-center">
                                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600/30 border-t-blue-600 mr-2"></div>
                                        Mencari data buku...
                                    </div>
                                )}

                                {/* Search by Title Section */}
                                {!editingBook && (
                                    <div className="p-3 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-500/10 dark:to-yellow-500/10 rounded-lg border border-amber-200 dark:border-amber-500/20">
                                        <p className="text-xs text-amber-700 dark:text-amber-400 mb-2 font-medium">
                                            📚 ISBN tidak ditemukan? Cari berdasarkan judul buku:
                                        </p>
                                        <div className="flex space-x-2">
                                            <input
                                                type="text"
                                                placeholder="Ketik judul buku..."
                                                value={titleSearch}
                                                onChange={(e) => setTitleSearch(e.target.value)}
                                                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), searchByTitle())}
                                                className="flex-1 px-3 py-2 bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-500/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-slate-900 dark:text-white"
                                            />
                                            <button
                                                type="button"
                                                onClick={searchByTitle}
                                                disabled={lookingUp || !titleSearch}
                                                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white rounded-lg transition-all flex items-center space-x-1 text-sm font-medium"
                                            >
                                                <span className="material-icons-round text-sm">search</span>
                                                <span>Cari</span>
                                            </button>
                                        </div>

                                        {/* Search Results Dropdown */}
                                        {showSearchResults && searchResults.length > 0 && (
                                            <div className="mt-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 max-h-48 overflow-y-auto">
                                                {searchResults.map((result, idx) => (
                                                    <button
                                                        key={idx}
                                                        type="button"
                                                        onClick={() => selectSearchResult(result)}
                                                        className="w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-slate-700 border-b border-slate-100 dark:border-slate-700 last:border-b-0 transition-colors"
                                                    >
                                                        <p className="font-medium text-slate-800 dark:text-white text-sm truncate">{result.title}</p>
                                                        <p className="text-xs text-slate-500 truncate">{result.author} • {result.publisher}</p>
                                                        {result.isbn && <p className="text-xs text-slate-400 mt-0.5">ISBN: {result.isbn}</p>}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">ISBN <span className="text-red-500">*</span></label>
                                        <input
                                            type="text"
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-slate-900 dark:text-white"
                                            value={formData.isbn}
                                            onChange={(e) => setFormData({ ...formData, isbn: e.target.value })}
                                            required
                                            placeholder="Ketik ISBN lalu klik Cari"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => formData.isbn && lookupISBN(formData.isbn)}
                                            disabled={!formData.isbn || lookingUp}
                                            className="mt-1 px-3 py-1.5 text-xs bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 text-white rounded-lg transition-all flex items-center space-x-1"
                                        >
                                            <span className="material-icons-round text-sm">{lookingUp ? 'hourglass_empty' : 'search'}</span>
                                            <span>{lookingUp ? 'Mencari...' : 'Cari Info Buku'}</span>
                                        </button>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Barcode <span className="text-red-500">*</span></label>
                                        <input
                                            type="text"
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-slate-900 dark:text-white"
                                            value={formData.barcode}
                                            onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Judul Buku <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-slate-900 dark:text-white"
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Pengarang <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-slate-900 dark:text-white"
                                        value={formData.author}
                                        onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Penerbit</label>
                                        <input
                                            type="text"
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-slate-900 dark:text-white"
                                            value={formData.publisher}
                                            onChange={(e) => setFormData({ ...formData, publisher: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Kategori</label>
                                        <input
                                            type="text"
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-slate-900 dark:text-white"
                                            value={formData.category}
                                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                            placeholder="Novel, Pelajaran, dll"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Lokasi Rak</label>
                                        <input
                                            type="text"
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-slate-900 dark:text-white"
                                            value={formData.rackLocation}
                                            onChange={(e) => setFormData({ ...formData, rackLocation: e.target.value })}
                                            placeholder="A1, B2, dll"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Jumlah Eksemplar</label>
                                        <input
                                            type="number"
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-slate-900 dark:text-white"
                                            min="1"
                                            value={formData.totalCopies}
                                            onChange={(e) => setFormData({ ...formData, totalCopies: parseInt(e.target.value) || 1 })}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end space-x-3 bg-slate-50 dark:bg-slate-800/50">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-4 py-2 text-sm font-semibold text-white bg-primary hover:bg-primary/90 rounded-lg shadow-lg shadow-primary/20 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center"
                                >
                                    {saving ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white mr-2"></div>
                                            Menyimpan...
                                        </>
                                    ) : (editingBook ? 'Simpan Perubahan' : 'Tambah Buku')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ISBN Scanner Modal */}
            {showScanner && (
                <BarcodeScanner
                    onScan={lookupISBN}
                    onClose={() => setShowScanner(false)}
                />
            )}
            {/* Import Modal */}
            {showImportModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowImportModal(false)}>
                    <div className="bg-surface-light dark:bg-surface-dark w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Import Data Buku</h3>
                            <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-slate-500 dark:hover:text-slate-300 transition-colors">
                                <span className="material-icons-round">close</span>
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            {error && (
                                <div className="p-3 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-sm rounded-lg">
                                    {error}
                                </div>
                            )}

                            {importResult && (
                                <div className={`p-4 rounded-lg ${importResult.failed > 0 ? 'bg-amber-50 dark:bg-amber-500/10' : 'bg-green-50 dark:bg-green-500/10'}`}>
                                    <div className="flex items-center space-x-2 mb-2">
                                        <span className={`material-icons-round ${importResult.failed > 0 ? 'text-amber-500' : 'text-green-500'}`}>
                                            {importResult.failed > 0 ? 'warning' : 'check_circle'}
                                        </span>
                                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                                            {importResult.success} berhasil, {importResult.failed} gagal
                                        </span>
                                    </div>
                                    {importResult.errors.length > 0 && (
                                        <div className="mt-2 max-h-32 overflow-y-auto">
                                            {importResult.errors.slice(0, 10).map((err, idx) => (
                                                <div key={idx} className="text-sm text-red-600 dark:text-red-400">
                                                    {err.row > 0 && `Baris ${err.row}: `}ISBN {err.isbn} - {err.error}
                                                </div>
                                            ))}
                                            {importResult.errors.length > 10 && (
                                                <div className="text-sm text-slate-500 mt-1">...dan {importResult.errors.length - 10} error lainnya</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                                <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-3">Langkah-langkah:</h4>
                                <ol className="text-sm text-slate-600 dark:text-slate-400 space-y-2 list-decimal list-inside">
                                    <li>Download template Excel yang sudah disiapkan</li>
                                    <li>Isi data buku sesuai kolom (ISBN, Judul, Pengarang wajib)</li>
                                    <li>Pastikan ISBN/Barcode unik dan belum terdaftar</li>
                                    <li>Upload file Excel yang sudah diisi</li>
                                </ol>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3">
                                <button
                                    onClick={handleDownloadTemplate}
                                    className="flex-1 flex items-center justify-center space-x-2 px-4 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl transition-all"
                                >
                                    <span className="material-icons-round">download</span>
                                    <span>Download Template</span>
                                </button>
                                <label className="flex-1 flex items-center justify-center space-x-2 px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition-all cursor-pointer">
                                    {importing ? (
                                        <>
                                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white"></div>
                                            <span>Mengimport...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="material-icons-round">upload</span>
                                            <span>Upload Excel</span>
                                        </>
                                    )}
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".xlsx,.xls"
                                        onChange={handleImportFile}
                                        className="hidden"
                                        disabled={importing}
                                    />
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

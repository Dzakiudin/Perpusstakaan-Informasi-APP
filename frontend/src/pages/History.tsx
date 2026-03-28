import { useState, useEffect } from 'react';
import api from '../services/api';

interface Loan {
    id: number;
    loanDate: string;
    dueDate: string;
    returnDate: string | null;
    status: string;
    computedStatus: string;
    daysOverdue: number;
    finedAmount: number;
    memberName?: string; // Fallback when member is deleted
    member: {
        id: number;
        nis: string;
        name: string;
        class: { id: number; name: string } | null;
    } | null;
    items: Array<{
        id: number;
        status: string;
        book: { id: number; title: string; barcode: string } | null;
        bookTitle?: string;  // Fallback when book is deleted
        bookBarcode?: string;
    }>;
    createdBy: { name: string };
}

interface Class {
    id: number;
    name: string;
}

interface Book {
    id: number;
    title: string;
}

export default function History() {
    const [loans, setLoans] = useState<Loan[]>([]);
    const [loading, setLoading] = useState(true);
    const [classes, setClasses] = useState<Class[]>([]);
    const [books, setBooks] = useState<Book[]>([]);
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });

    // Filters
    const [filters, setFilters] = useState({
        classId: '',
        bookId: '',
        status: '',
        startDate: '',
        endDate: '',
    });

    useEffect(() => {
        fetchClasses();
        fetchBooks();
    }, []);

    useEffect(() => {
        fetchHistory();
    }, [filters, pagination.page]);

    const fetchClasses = async () => {
        try {
            const res = await api.get('/classes');
            setClasses(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchBooks = async () => {
        try {
            const res = await api.get('/books?limit=100');
            setBooks(res.data.data || []);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchHistory = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            params.set('page', pagination.page.toString());
            params.set('limit', '15');

            if (filters.classId) params.set('classId', filters.classId);
            if (filters.bookId) params.set('bookId', filters.bookId);
            if (filters.status) params.set('status', filters.status);
            if (filters.startDate) params.set('startDate', filters.startDate);
            if (filters.endDate) params.set('endDate', filters.endDate);

            const res = await api.get(`/loans/history?${params.toString()}`);
            setLoans(res.data.data);
            setPagination(prev => ({
                ...prev,
                totalPages: res.data.pagination.totalPages,
                total: res.data.pagination.total,
            }));
        } catch (err) {
            console.error('Failed to fetch history:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleFilterChange = (key: string, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    const clearFilters = () => {
        setFilters({ classId: '', bookId: '', status: '', startDate: '', endDate: '' });
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'returned':
                return 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
            case 'overdue':
                return 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400';
            default:
                return 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'returned': return 'Dikembalikan';
            case 'overdue': return 'Terlambat';
            default: return 'Aktif';
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Riwayat Peminjaman</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">Histori seluruh transaksi peminjaman buku</p>
            </div>

            {/* Filters */}
            <div className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-slate-900 dark:text-white flex items-center">
                        <span className="material-icons-round text-lg mr-2 text-primary">filter_list</span>
                        Filter
                    </h3>
                    <button
                        onClick={clearFilters}
                        className="text-sm text-slate-500 hover:text-primary transition-colors"
                    >
                        Reset Filter
                    </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1.5">Kelas</label>
                        <select
                            value={filters.classId}
                            onChange={(e) => handleFilterChange('classId', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                        >
                            <option value="">Semua Kelas</option>
                            {classes.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1.5">Buku</label>
                        <select
                            value={filters.bookId}
                            onChange={(e) => handleFilterChange('bookId', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                        >
                            <option value="">Semua Buku</option>
                            {books.map(b => (
                                <option key={b.id} value={b.id}>{b.title}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1.5">Status</label>
                        <select
                            value={filters.status}
                            onChange={(e) => handleFilterChange('status', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                        >
                            <option value="">Semua Status</option>
                            <option value="active">Aktif</option>
                            <option value="returned">Dikembalikan</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1.5">Dari Tanggal</label>
                        <input
                            type="date"
                            value={filters.startDate}
                            onChange={(e) => handleFilterChange('startDate', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1.5">Sampai Tanggal</label>
                        <input
                            type="date"
                            value={filters.endDate}
                            onChange={(e) => handleFilterChange('endDate', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                        />
                    </div>
                </div>
            </div>

            {/* Results Count */}
            <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">
                    Menampilkan <span className="font-semibold text-slate-900 dark:text-white">{loans.length}</span> dari{' '}
                    <span className="font-semibold text-slate-900 dark:text-white">{pagination.total}</span> data
                </p>
            </div>

            {/* Table */}
            <div className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                {loading ? (
                    <div className="flex justify-center items-center h-48">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                    </div>
                ) : loans.length === 0 ? (
                    <div className="text-center py-16 text-slate-500">
                        <span className="material-icons-round text-5xl mb-3 opacity-30">history</span>
                        <p>Tidak ada data riwayat</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                                    <th className="text-left px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Tanggal</th>
                                    <th className="text-left px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Peminjam</th>
                                    <th className="text-left px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Kelas</th>
                                    <th className="text-left px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Buku</th>
                                    <th className="text-left px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Jatuh Tempo</th>
                                    <th className="text-left px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Status</th>
                                    <th className="text-left px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Denda</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {loans.map((loan) => (
                                    <tr key={loan.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                        <td className="px-6 py-4 text-sm">
                                            {new Date(loan.loanDate).toLocaleDateString('id-ID')}
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="font-semibold text-slate-900 dark:text-white">{loan.member?.name || loan.memberName || 'Anggota Dihapus'}</p>
                                            <p className="text-xs text-slate-500">{loan.member?.nis || '-'}</p>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                                            {loan.member?.class?.name || '-'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="max-w-xs">
                                                {loan.items.slice(0, 2).map((item, i) => (
                                                    <p key={i} className="text-sm truncate">{item.book?.title || item.bookTitle || 'Buku Dihapus'}</p>
                                                ))}
                                                {loan.items.length > 2 && (
                                                    <p className="text-xs text-slate-400">+{loan.items.length - 2} lainnya</p>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            {new Date(loan.dueDate).toLocaleDateString('id-ID')}
                                            {loan.daysOverdue > 0 && (
                                                <p className="text-xs text-red-500">+{loan.daysOverdue} hari</p>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusBadge(loan.computedStatus)}`}>
                                                {getStatusText(loan.computedStatus)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            {loan.finedAmount > 0 ? (
                                                <span className="text-red-600 font-medium">
                                                    Rp {loan.finedAmount.toLocaleString('id-ID')}
                                                </span>
                                            ) : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
                <div className="flex items-center justify-center space-x-2">
                    <button
                        onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                        disabled={pagination.page === 1}
                        className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                        <span className="material-icons-round text-sm">chevron_left</span>
                    </button>
                    <span className="px-4 py-2 text-sm">
                        Halaman {pagination.page} dari {pagination.totalPages}
                    </span>
                    <button
                        onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                        disabled={pagination.page === pagination.totalPages}
                        className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                        <span className="material-icons-round text-sm">chevron_right</span>
                    </button>
                </div>
            )}
        </div>
    );
}

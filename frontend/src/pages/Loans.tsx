import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import api from '../services/api';

interface Member {
    id: number;
    nis: string;
    name: string;
    class: { name: string };
    activeLoansCount: number;
    maxBooks?: number;
    canBorrow: boolean;
    classId: number;
    phone: string | null;
}

interface Book {
    id: number;
    barcode: string;
    title: string;
    author: string;
    availableCopies: number;
}

interface Loan {
    id: number;
    member: Member | null;
    memberName?: string;
    items: {
        book: Book | null;
        bookTitle?: string;
        bookBarcode?: string;
    }[];
    loanDate: string;
    dueDate: string;
    status: 'active' | 'returned';
}



export default function Loans() {
    // Main View State: 'pos' (Transaction) or 'history' (List)
    const [view, setView] = useState<'pos' | 'history'>('pos');

    // --- POS State ---
    const [memberInput, setMemberInput] = useState('');
    const [bookInput, setBookInput] = useState('');
    const [selectedMember, setSelectedMember] = useState<Member | null>(null);
    const [selectedBooks, setSelectedBooks] = useState<Book[]>([]);
    const [duration, setDuration] = useState(7);
    const [createLoading, setCreateLoading] = useState(false);
    const [createError, setCreateError] = useState('');
    const [createSuccess, setCreateSuccess] = useState('');

    // Scanner State
    const [showScanner, setShowScanner] = useState(false);
    const scannerRef = useRef<Html5Qrcode | null>(null);

    // --- History State ---
    const [loans, setLoans] = useState<Loan[]>([]);
    const [settings, setSettings] = useState<{ max_loan_days?: string; max_books_per_loan?: string }>({});
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
    const [returning, setReturning] = useState(false);

    // --- History Logic ---
    const fetchLoans = async (page = 1, searchQuery = search) => {
        try {
            setLoading(true);
            const params: any = { page, limit: 10 };
            if (searchQuery.trim()) params.search = searchQuery.trim();

            const loansRes = await api.get('/loans', { params });
            setLoans(loansRes.data.data);
            setPagination(loansRes.data.pagination);

        } catch (error) {
            console.error('Failed to fetch loans:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (view === 'history') {
            fetchLoans();
        }
    }, [view]);

    // Fetch settings on mount
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await api.get('/settings');
                const settingsData: any = {};
                // Flatten settings object { key: { value: '...' } } to { key: '...' }
                Object.keys(res.data).forEach(key => {
                    settingsData[key] = res.data[key].value;
                });
                setSettings(settingsData);
                if (settingsData.max_loan_days) {
                    setDuration(parseInt(settingsData.max_loan_days));
                }
            } catch (error) {
                console.error('Failed to fetch settings:', error);
            }
        };
        fetchSettings();
    }, []);

    // specific effect for search debounce 
    useEffect(() => {
        const timer = setTimeout(() => {
            if (view === 'history') {
                fetchLoans(1, search);
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [search]);

    // --- POS Logic ---
    const searchMember = async () => {
        if (!memberInput.trim()) return;
        setCreateLoading(true);
        setCreateError('');
        setCreateSuccess('');

        try {
            const res = await api.get(`/members/nis/${memberInput.trim()}`);
            if (!res.data.canBorrow) {
                setCreateError(`Anggota tidak dapat meminjam. Status: ${res.data.status}, Pinjaman aktif: ${res.data.activeLoansCount}/${res.data.maxBooks || 3}`);
                // Still show member but maybe block adding books?
                // For now, allow selection but show error
            }
            setSelectedMember(res.data);
            setMemberInput(''); // Clear input for next scan if needed, or keep? Better clear to avoid confusion
        } catch (err: any) {
            setCreateError(err.response?.data?.error || 'Anggota tidak ditemukan');
            setSelectedMember(null);
        } finally {
            setCreateLoading(false);
        }
    };

    const addBook = async () => {
        if (!bookInput.trim()) return;
        const maxBooks = parseInt(settings.max_books_per_loan || '3');
        if (selectedBooks.length >= maxBooks) {
            setCreateError(`Maksimal ${maxBooks} buku per peminjaman`);
            return;
        }
        if (selectedBooks.find(b => b.barcode === bookInput.trim())) {
            setCreateError('Buku sudah ditambahkan ke cart');
            setBookInput('');
            return;
        }

        setCreateLoading(true);
        setCreateError('');
        setCreateSuccess('');

        try {
            const res = await api.get(`/books/barcode/${bookInput.trim()}`);
            if (res.data.availableCopies < 1) {
                setCreateError('Buku tidak tersedia (stok habis)');
            } else {
                setSelectedBooks([...selectedBooks, res.data]);
                setBookInput('');
            }
        } catch (err: any) {
            setCreateError(err.response?.data?.error || 'Buku tidak ditemukan');
        } finally {
            setCreateLoading(false);
        }
    };

    const removeBook = (barcode: string) => {
        setSelectedBooks(selectedBooks.filter(b => b.barcode !== barcode));
    };

    const handleCreateSubmit = async () => {
        if (!selectedMember || selectedBooks.length === 0) return;

        setCreateLoading(true);
        setCreateError('');
        setCreateSuccess('');

        try {
            await api.post('/loans', {
                memberId: selectedMember.id,
                bookBarcodes: selectedBooks.map(b => b.barcode),
                durationDays: duration,
            });

            setCreateSuccess(`Peminjaman berhasil! ${selectedBooks.length} buku dipinjamkan kepada ${selectedMember.name}`);

            // Output success sound or visual check

            // Reset for next transaction
            setSelectedMember(null);
            setSelectedBooks([]);
            setMemberInput('');

        } catch (err: any) {
            setCreateError(err.response?.data?.error || 'Gagal membuat peminjaman');
        } finally {
            setCreateLoading(false);
        }
    };

    // --- Scanner Logic ---
    const startScanner = async (type: 'member' | 'book') => {
        setShowScanner(true);
        setTimeout(async () => {
            try {
                scannerRef.current = new Html5Qrcode('scanner-container');
                await scannerRef.current.start(
                    { facingMode: 'environment' },
                    { fps: 10, qrbox: { width: 250, height: 150 } },
                    (decodedText) => {
                        if (type === 'member') {
                            setMemberInput(decodedText);
                            // Auto trigger search would act weird if inside state update directly
                            // Better let user click or useEffect? 
                            // simpler: just set input and close. User hits enter or button.
                        } else {
                            setBookInput(decodedText);
                        }
                        stopScanner();
                    },
                    (_errorMessage) => { }
                );
            } catch (err) {
                console.error(err);
                setShowScanner(false);
            }
        }, 100);
    };

    const stopScanner = async () => {
        if (scannerRef.current) {
            try { await scannerRef.current.stop(); } catch (e) { }
            scannerRef.current = null;
        }
        setShowScanner(false);
    };

    // --- Helpers ---
    const getStatus = (loan: Loan) => {
        if (loan.status === 'returned') return 'returned';
        const today = new Date();
        const due = new Date(loan.dueDate);
        if (today > due) return 'overdue';
        return 'active';
    };

    // History Actions
    const handleQuickReturn = async (loan: Loan) => {
        if (!confirm(`Kembalikan semua buku dari peminjaman ${loan.member?.name || loan.memberName || 'Anggota'}?`)) return;
        setReturning(true);
        try {
            const barcodes = loan.items.filter(item => item.book?.barcode).map(item => item.book!.barcode);
            await api.post('/loans/return', { bookBarcodes: barcodes });
            alert('Pengembalian berhasil!');
            fetchLoans(pagination.page);
        } catch (err: any) {
            alert(err.response?.data?.error || 'Gagal memproses pengembalian');
        } finally {
            setReturning(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* View Toggle Tabs */}
            <div className="flex space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
                <button
                    onClick={() => setView('pos')}
                    className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${view === 'pos'
                        ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                        }`}
                >
                    <span className="flex items-center space-x-2">
                        <span className="material-icons-round text-lg">point_of_sale</span>
                        <span>Transaksi Baru</span>
                    </span>
                </button>
                <button
                    onClick={() => setView('history')}
                    className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${view === 'history'
                        ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                        }`}
                >
                    <span className="flex items-center space-x-2">
                        <span className="material-icons-round text-lg">history</span>
                        <span>Riwayat</span>
                    </span>
                </button>
            </div>

            {/* ERROR / SUCCESS FEEDBACK (Global for POS) */}
            {view === 'pos' && (
                <>
                    {createSuccess && (
                        <div className="p-4 bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 rounded-xl flex items-center animate-fade-in-up">
                            <span className="material-icons-round mr-2">check_circle</span>
                            {createSuccess}
                        </div>
                    )}
                    {createError && (
                        <div className="p-4 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-xl flex items-center animate-shake">
                            <span className="material-icons-round mr-2">error</span>
                            {createError}
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* LEFT COLUMN: INPUTS */}
                        <div className="lg:col-span-7 space-y-6">

                            {/* 1. MEMBER SECTION */}
                            <div className={`bg-surface-light dark:bg-surface-dark rounded-2xl border ${selectedMember ? 'border-primary/50 ring-1 ring-primary/20' : 'border-slate-200 dark:border-slate-800'} shadow-sm p-6 transition-all`}>
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center">
                                        <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mr-2 text-sm">1</span>
                                        Pilih Anggota
                                    </h3>
                                    {selectedMember && (
                                        <button
                                            onClick={() => { setSelectedMember(null); setMemberInput(''); }}
                                            className="text-xs text-red-500 hover:text-red-700 font-bold uppercase"
                                        >
                                            Ganti
                                        </button>
                                    )}
                                </div>

                                {!selectedMember ? (
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <input
                                                type="text"
                                                className="w-full pl-10 pr-3 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/20 focus:outline-none dark:text-white placeholder:text-slate-400"
                                                placeholder="Scan / Ketik NIS Anggota..."
                                                value={memberInput}
                                                onChange={(e) => setMemberInput(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && searchMember()}
                                                autoFocus
                                            />
                                            <span className="absolute left-3 top-3.5 text-slate-400 material-icons-round text-lg">person_search</span>
                                        </div>
                                        <button
                                            onClick={() => startScanner('member')}
                                            className="px-4 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                                        >
                                            <span className="material-icons-round text-xl">qr_code_scanner</span>
                                        </button>
                                        <button
                                            onClick={searchMember}
                                            disabled={createLoading}
                                            className="px-6 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors font-bold"
                                        >
                                            Cari
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-start space-x-4 animate-fade-in">
                                        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-blue-500/30">
                                            {selectedMember.name.charAt(0)}
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="text-xl font-bold text-slate-900 dark:text-white">{selectedMember.name}</h4>
                                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-slate-500 dark:text-slate-400">
                                                <span className="flex items-center"><span className="material-icons-round text-xs mr-1">badge</span> {selectedMember.nis}</span>
                                                <span className="flex items-center"><span className="material-icons-round text-xs mr-1">school</span> {selectedMember.class?.name || 'No Class'}</span>
                                            </div>
                                            <div className="mt-3 flex items-center gap-2">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${selectedMember.canBorrow ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                    {selectedMember.canBorrow ? 'Bisa Meminjam' : 'Tidak Bisa Meminjam'}
                                                </span>
                                                <span className="text-xs text-slate-400">
                                                    Pinjaman Aktif: {selectedMember.activeLoansCount}/{selectedMember.maxBooks || settings.max_books_per_loan || 3}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* 2. BOOK SECTION */}
                            <div className={`bg-surface-light dark:bg-surface-dark rounded-2xl border ${selectedBooks.length > 0 ? 'border-primary/50 ring-1 ring-primary/20' : 'border-slate-200 dark:border-slate-800'} shadow-sm p-6 transition-all ${!selectedMember ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                                <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center mb-4">
                                    <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mr-2 text-sm">2</span>
                                    Scan Buku
                                </h3>

                                <div className="flex gap-2 mb-4">
                                    <div className="relative flex-1">
                                        <input
                                            type="text"
                                            className="w-full pl-10 pr-3 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/20 focus:outline-none dark:text-white placeholder:text-slate-400"
                                            placeholder="Scan / Ketik Barcode Buku..."
                                            value={bookInput}
                                            onChange={(e) => setBookInput(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && addBook()}
                                            disabled={!selectedMember}
                                        // autoFocus when member selected? Need logic for that but keeps simple for now
                                        />
                                        <span className="absolute left-3 top-3.5 text-slate-400 material-icons-round text-lg">menu_book</span>
                                    </div>
                                    <button
                                        onClick={() => startScanner('book')}
                                        className="px-4 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                                        disabled={!selectedMember}
                                    >
                                        <span className="material-icons-round text-xl">qr_code_scanner</span>
                                    </button>
                                    <button
                                        onClick={addBook}
                                        disabled={createLoading || !selectedMember}
                                        className="px-6 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors font-bold"
                                    >
                                        Tambah
                                    </button>
                                </div>

                                {/* Scanned Books List (Small) */}
                                {selectedBooks.length === 0 && (
                                    <div className="text-center p-8 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-slate-400">
                                        <span className="material-icons-round text-4xl mb-2">library_books</span>
                                        <p className="text-sm">Belum ada buku discan</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* RIGHT COLUMN: CART / SUMMARY */}
                        <div className="lg:col-span-5 space-y-6">
                            <div className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg p-6 sticky top-6">
                                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex justify-between items-center">
                                    <span>Ringkasan Peminjaman</span>
                                    <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full">{selectedBooks.length} Item</span>
                                </h3>

                                {/* Cart Items */}
                                <div className="space-y-3 mb-6 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                    {selectedBooks.map((book, idx) => (
                                        <div key={idx} className="flex justify-between items-start bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg group animate-fade-in-right">
                                            <div>
                                                <p className="font-bold text-sm text-slate-800 dark:text-white line-clamp-2">{book.title}</p>
                                                <p className="text-xs text-slate-500 font-mono mt-1">{book.barcode}</p>
                                            </div>
                                            <button
                                                onClick={() => removeBook(book.barcode)}
                                                className="text-red-400 hover:text-red-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <span className="material-icons-round text-sm">close</span>
                                            </button>
                                        </div>
                                    ))}
                                    {selectedBooks.length === 0 && (
                                        <p className="text-sm text-slate-400 italic text-center py-4">Keranjang kosong</p>
                                    )}
                                </div>

                                <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-slate-500">Durasi Pinjam</span>
                                        <select
                                            value={duration}
                                            onChange={(e) => setDuration(parseInt(e.target.value))}
                                            className="bg-slate-100 dark:bg-slate-800 border-none rounded px-2 py-1 text-sm font-bold text-slate-700 dark:text-slate-300 focus:ring-0 cursor-pointer"
                                        >
                                            <option value={parseInt(settings.max_loan_days || '7')}>{settings.max_loan_days || 7} Hari (Default)</option>
                                            <option value={7}>7 Hari</option>
                                            <option value={14}>14 Hari</option>
                                        </select>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-slate-500">Tenggat Kembali</span>
                                        <span className="font-bold text-primary">
                                            {new Date(Date.now() + duration * 24 * 60 * 60 * 1000).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                        </span>
                                    </div>

                                    <button
                                        onClick={handleCreateSubmit}
                                        disabled={!selectedMember || selectedBooks.length === 0 || createLoading}
                                        className="w-full py-4 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl shadow-lg shadow-primary/25 font-bold text-lg transition-all active:scale-95 flex justify-center items-center"
                                    >
                                        {createLoading ? (
                                            <span className="material-icons-round animate-spin">refresh</span>
                                        ) : (
                                            <>
                                                <span className="material-icons-round mr-2">check</span>
                                                Selesaikan Transaksi
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* LIST VIEW (Previous Tables) */}
            {view === 'history' && (
                <div className="space-y-4 animate-fade-in">
                    {/* Search Bar for History */}
                    <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                            <span className="material-icons-round text-lg">search</span>
                        </span>
                        <input
                            type="text"
                            className="block w-full pl-10 pr-3 py-2.5 bg-surface-light dark:bg-surface-dark border border-slate-200 dark:border-slate-700 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm text-slate-800 dark:text-slate-200"
                            placeholder="Cari Riwayat Pinjam..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <div className="bg-surface-light dark:bg-surface-dark rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                                        <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 uppercase">ID</th>
                                        <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 uppercase">Peminjam</th>
                                        <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 uppercase">Buku</th>
                                        <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 uppercase">Status</th>
                                        <th className="px-6 py-4 text-center text-[11px] font-bold text-slate-500 uppercase">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {loading ? (
                                        <tr><td colSpan={5} className="p-8 text-center text-slate-500">Loading...</td></tr>
                                    ) : loans.length === 0 ? (
                                        <tr><td colSpan={5} className="p-8 text-center text-slate-500">Tidak ada data</td></tr>
                                    ) : (
                                        loans.map((loan) => (
                                            <tr key={loan.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                                <td className="px-6 py-4 text-xs font-mono text-slate-500">
                                                    #{loan.id}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="font-bold text-sm text-slate-900 dark:text-white">
                                                        {loan.member?.name || loan.memberName || 'Deleted'}
                                                    </div>
                                                    <div className="text-xs text-slate-500">{loan.member?.class?.name || '-'}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-sm text-slate-700 dark:text-slate-300">
                                                        {loan.items[0]?.book?.title || loan.items[0]?.bookTitle || 'Unknown'}
                                                    </div>
                                                    {loan.items.length > 1 && (
                                                        <div className="text-xs text-slate-400">+{loan.items.length - 1} lainnya</div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex px-2 py-1 text-xs font-bold rounded-full ${getStatus(loan) === 'returned'
                                                        ? 'bg-emerald-100 text-emerald-700'
                                                        : getStatus(loan) === 'overdue'
                                                            ? 'bg-red-100 text-red-700'
                                                            : 'bg-blue-100 text-blue-700'
                                                        }`}>
                                                        {getStatus(loan) === 'returned' ? 'Selesai' : getStatus(loan) === 'overdue' ? 'Terlambat' : 'Aktif'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    {getStatus(loan) !== 'returned' && (
                                                        <button
                                                            onClick={() => handleQuickReturn(loan)}
                                                            className="text-primary hover:text-primary/80 font-bold text-xs"
                                                            disabled={returning}
                                                        >
                                                            KEMBALIKAN
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {/* Simple Pagination */}
                        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-between">
                            <button
                                disabled={pagination.page === 1}
                                onClick={() => fetchLoans(pagination.page - 1)}
                                className="px-3 py-1 text-sm bg-slate-100 rounded disabled:opacity-50"
                            >
                                Previous
                            </button>
                            <span className="text-sm text-slate-500">Page {pagination.page} of {pagination.totalPages}</span>
                            <button
                                disabled={pagination.page >= pagination.totalPages}
                                onClick={() => fetchLoans(pagination.page + 1)}
                                className="px-3 py-1 text-sm bg-slate-100 rounded disabled:opacity-50"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Scanner Modal */}
            {showScanner && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm" onClick={stopScanner}>
                    <div className="bg-surface-light dark:bg-surface-dark w-full max-w-md rounded-2xl p-4" onClick={e => e.stopPropagation()}>
                        <div id="scanner-container" className="rounded-lg overflow-hidden bg-black h-64"></div>
                        <button onClick={stopScanner} className="w-full mt-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-bold">
                            Tutup
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

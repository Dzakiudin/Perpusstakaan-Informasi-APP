import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import api from '../services/api';

interface ReturnHistoryItem {
    id: number;
    loanId: number;
    book: { title: string; barcode: string };
    member: { name: string; nis: string; class: { name: string }; phone: string };
    returnDate: string;
    fine: number;
    officer: string;
}

interface ReturnResult {
    book: string;
    member: string;
    fine: number;
    daysLate: number;
}



export default function Returns() {
    // View State: 'process' (Scan) or 'history' (List)
    const [view, setView] = useState<'process' | 'history'>('process');

    // --- History State ---
    const [history, setHistory] = useState<ReturnHistoryItem[]>([]);
    const [loading, setLoading] = useState(false);

    // --- Process State ---
    const [bookInput, setBookInput] = useState('');
    const [processLoading, setProcessLoading] = useState(false);
    const [processError, setProcessError] = useState('');
    const [returnResults, setReturnResults] = useState<ReturnResult[]>([]);
    const [processSuccess, setProcessSuccess] = useState('');

    // Scanner State
    const [showScanner, setShowScanner] = useState(false);
    const scannerRef = useRef<Html5Qrcode | null>(null);

    // --- History Logic ---
    const fetchHistory = async (page = 1) => {
        try {
            setLoading(true);
            const res = await api.get('/loans', { params: { status: 'returned', page, limit: 10 } });

            const mappedHistory = res.data.data.map((loan: any) => ({
                id: loan.id,
                loanId: loan.id,
                book: loan.items[0]?.book || { title: 'Unknown', barcode: '?' },
                member: {
                    name: loan.member?.name || loan.memberName || 'Anggota Dihapus',
                    nis: loan.member?.nis || '-',
                    class: loan.member?.class || { name: '-' },
                    phone: loan.member?.phone || '-'
                },
                returnDate: loan.returnDate || new Date().toISOString(),
                fine: loan.finedAmount || 0,
                officer: 'Admin'
            }));

            setHistory(mappedHistory);
            setHistory(mappedHistory);

        } catch (error) {
            console.error('Failed to fetch history:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (view === 'history') {
            fetchHistory();
        }
    }, [view]);

    // --- Process Logic ---
    const processReturn = async () => {
        if (!bookInput.trim()) return;

        setProcessLoading(true);
        setProcessError('');
        setProcessSuccess('');

        try {
            const res = await api.post('/loans/return', {
                bookBarcodes: [bookInput.trim()],
            });

            const newReturns = res.data.returnedItems;
            setReturnResults(prev => [...newReturns, ...prev]); // Add to top
            setBookInput('');

            // Show success feedback
            const totalFine = newReturns.reduce((sum: number, r: any) => sum + r.fine, 0);
            if (totalFine > 0) {
                setProcessSuccess(`Berhasil dikembalikan! Denda: ${formatCurrency(totalFine)}`);
            } else {
                setProcessSuccess('Buku berhasil dikembalikan tepat waktu.');
            }

            // Auto close scanner if open? usually strictly POS uses handheld scanner so no modal needed
            if (showScanner) stopScanner();

        } catch (err: any) {
            setProcessError(err.response?.data?.error || 'Gagal memproses pengembalian');
        } finally {
            setProcessLoading(false);
        }
    };

    const startScanner = async () => {
        setShowScanner(true);
        setTimeout(async () => {
            try {
                scannerRef.current = new Html5Qrcode('scanner-container');
                await scannerRef.current.start(
                    { facingMode: 'environment' },
                    { fps: 10, qrbox: { width: 250, height: 150 } },
                    (decodedText) => {
                        setBookInput(decodedText);
                        stopScanner();
                        // Optional: auto-submit? let's require verify for safety or enter key
                    },
                    (_err) => { }
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

    const clearResults = () => {
        setReturnResults([]);
        setProcessSuccess('');
        setProcessError('');
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
        }).format(amount);
    };



    return (
        <div className="space-y-6">
            {/* View Toggle Tabs */}
            <div className="flex space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
                <button
                    onClick={() => setView('process')}
                    className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${view === 'process'
                        ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                        }`}
                >
                    <span className="flex items-center space-x-2">
                        <span className="material-icons-round text-lg">qr_code_scanner</span>
                        <span>Scan Pengembalian</span>
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

            {/* ERROR / SUCCESS FEEDBACK (Global for Process) */}
            {view === 'process' && (
                <div className="space-y-6 animate-fade-in">
                    {processSuccess && (
                        <div className={`p-4 rounded-xl flex items-center animate-fade-in-up ${processSuccess.includes('Denda') ? 'bg-orange-50 text-orange-700' : 'bg-green-50 text-green-700'}`}>
                            <span className="material-icons-round mr-2">{processSuccess.includes('Denda') ? 'warning' : 'check_circle'}</span>
                            <span className="font-bold">{processSuccess}</span>
                        </div>
                    )}
                    {processError && (
                        <div className="p-4 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-xl flex items-center animate-shake">
                            <span className="material-icons-round mr-2">error</span>
                            {processError}
                        </div>
                    )}

                    {/* BIG SCANNER INPUT */}
                    <div className="bg-surface-light dark:bg-surface-dark p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-center">
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">Scan Barcode Buku</h2>
                        <div className="max-w-2xl mx-auto flex gap-4">
                            <div className="relative flex-1">
                                <input
                                    type="text"
                                    className="w-full pl-12 pr-4 py-4 text-lg bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-primary/20 focus:border-primary focus:outline-none dark:text-white placeholder:text-slate-400 transition-all"
                                    placeholder="Tempel kursor di sini & scan..."
                                    value={bookInput}
                                    onChange={(e) => setBookInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && processReturn()}
                                    autoFocus
                                />
                                <span className="absolute left-4 top-5 text-slate-400 material-icons-round text-2xl">qr_code_2</span>
                            </div>
                            <button
                                onClick={startScanner}
                                className="px-6 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                                title="Scan Lewat Kamera HP"
                            >
                                <span className="material-icons-round text-3xl">qr_code_scanner</span>
                            </button>
                            <button
                                onClick={processReturn}
                                disabled={processLoading}
                                className="px-8 py-4 bg-primary text-white rounded-2xl hover:bg-primary/90 transition-all font-bold text-lg shadow-lg shadow-primary/25 active:scale-95"
                            >
                                Proses
                            </button>
                        </div>
                        <p className="mt-4 text-slate-500 dark:text-slate-400 text-sm">
                            Pastikan kursor aktif di kolom input sebelum menggunakan scanner barcode.
                        </p>
                    </div>

                    {/* SESSION HISTORY */}
                    {returnResults.length > 0 && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2">
                                <div className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                                    <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                                        <h3 className="font-bold text-slate-800 dark:text-white flex items-center">
                                            <span className="material-icons-round mr-2 text-primary">history_edu</span>
                                            Sesi Pengembalian Ini
                                        </h3>
                                        <button onClick={clearResults} className="text-xs text-slate-500 hover:text-red-500 font-bold uppercase tracking-wider">
                                            Reset Sesi
                                        </button>
                                    </div>
                                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {returnResults.map((result, idx) => (
                                            <div key={idx} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors animate-fade-in">
                                                <div className="flex items-center space-x-4">
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${result.fine > 0 ? 'bg-red-500' : 'bg-green-500'}`}>
                                                        <span className="material-icons-round">{result.fine > 0 ? 'priority_high' : 'check'}</span>
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-900 dark:text-white">{result.book}</p>
                                                        <p className="text-sm text-slate-500">{result.member}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    {result.fine > 0 ? (
                                                        <>
                                                            <p className="font-bold text-red-600">{formatCurrency(result.fine)}</p>
                                                            <p className="text-xs text-red-500">Terlambat {result.daysLate} hari</p>
                                                        </>
                                                    ) : (
                                                        <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">Tepat Waktu</span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* SESSION SUMMARY */}
                            <div>
                                <div className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 sticky top-6">
                                    <h4 className="font-bold text-slate-800 dark:text-white mb-6">Ringkasan Sesi</h4>

                                    <div className="grid grid-cols-2 gap-4 mb-6">
                                        <div className="p-4 bg-blue-50 dark:bg-blue-500/10 rounded-xl text-center">
                                            <p className="text-3xl font-bold text-blue-600">{returnResults.length}</p>
                                            <p className="text-xs font-bold text-blue-500 uppercase mt-1">Buku</p>
                                        </div>
                                        <div className="p-4 bg-orange-50 dark:bg-orange-500/10 rounded-xl text-center">
                                            <p className="text-3xl font-bold text-orange-600">{formatCurrency(returnResults.reduce((sum, r) => sum + r.fine, 0))}</p>
                                            <p className="text-xs font-bold text-orange-500 uppercase mt-1">Total Denda</p>
                                        </div>
                                    </div>

                                    <div className="text-xs text-slate-400 space-y-2 border-t border-slate-100 dark:border-slate-700 pt-4">
                                        <p>💡 Pastikan denda dibayarkan jika ada.</p>
                                        <p>📅 Data otomatis tersimpan ke server.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}


            {/* HISTORY VIEW (Table) */}
            {view === 'history' && (
                <div className="bg-surface-light dark:bg-surface-dark rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden animate-fade-in">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                                    <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 uppercase">ID</th>
                                    <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 uppercase">Peminjam</th>
                                    <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 uppercase">Buku</th>
                                    <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 uppercase">Tgl Kembali</th>
                                    <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 uppercase">Denda</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {loading ? (
                                    <tr><td colSpan={5} className="p-8 text-center text-slate-500">Loading...</td></tr>
                                ) : history.length === 0 ? (
                                    <tr><td colSpan={5} className="p-8 text-center text-slate-500">Belum ada data</td></tr>
                                ) : (
                                    history.map((item) => (
                                        <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                            <td className="px-6 py-4 text-xs font-mono text-slate-500">
                                                #{item.id}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-sm text-slate-900 dark:text-white">{item.member.name}</div>
                                                <div className="text-xs text-slate-500">{item.member.class.name}</div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                                                {item.book.title}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                                                {new Date(item.returnDate).toLocaleDateString('id-ID')}
                                            </td>
                                            <td className="px-6 py-4">
                                                {item.fine > 0 ? (
                                                    <span className="font-bold text-red-600 text-sm">{formatCurrency(item.fine)}</span>
                                                ) : (
                                                    <span className="text-xs text-slate-400">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
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

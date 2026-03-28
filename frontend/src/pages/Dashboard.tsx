import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../services/api';

interface DashboardData {
    stats: {
        totalBooks: number;
        totalMembers: number;
        totalClasses: number;
        activeLoans: number;
        overdueLoans: number;
        loansThisMonth: number;
    };
    recentLoans: Array<{
        id: number;
        memberName: string;
        books: string[];
        loanDate: string;
        dueDate: string;
        status: string;
    }>;
    popularBooks: Array<{
        title: string;
        author: string;
        borrowCount: number;
    }>;
}

interface ChartData {
    monthlyLoans: Array<{ month: string; count: number }>;
}

interface TopReader {
    memberId: number;
    name: string;
    className: string;
    loanCount: number;
}

interface FineSummary {
    fineRate: number;
    totalUnpaidFines: number;
    totalPaidFines: number;
}

export default function Dashboard() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [chartData, setChartData] = useState<ChartData | null>(null);
    const [topReaders, setTopReaders] = useState<TopReader[]>([]);
    const [fineSummary, setFineSummary] = useState<FineSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [dashRes, chartRes, readersRes, finesRes] = await Promise.all([
                    api.get('/dashboard'),
                    api.get('/dashboard/charts'),
                    api.get('/dashboard/top-readers?period=month'),
                    api.get('/dashboard/fine-summary'),
                ]);
                setData(dashRes.data);
                setChartData(chartRes.data);
                setTopReaders(readersRes.data || []);
                setFineSummary(finesRes.data || null);
            } catch (error) {
                console.error('Failed to fetch dashboard:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        const timer = setTimeout(() => setIsLoaded(true), 100);
        return () => clearTimeout(timer);
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="p-4 bg-red-50 text-red-600 rounded-lg">
                Gagal memuat data dashboard
            </div>
        );
    }

    return (
        <div className={`space-y-6 transition-all duration-700 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            {/* Top Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {/* Total Buku */}
                <div className="group p-6 bg-surface-light dark:bg-surface-dark border border-slate-200 dark:border-white/5 rounded-2xl flex items-center justify-between shadow-sm hover:border-primary/30 transition-all duration-500">
                    <div className="flex flex-col">
                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mb-1">Total Buku</p>
                        <p className="text-3xl font-serif font-bold text-slate-900 dark:text-cream leading-none">{data.stats.totalBooks}</p>
                        <p className="text-[11px] text-slate-500 mt-3 flex items-center font-medium">
                            <span className="material-icons-round text-sm mr-1.5 text-primary">auto_stories</span>
                            Koleksi Perpustakaan
                        </p>
                    </div>
                    <div className="w-14 h-14 bg-primary/5 dark:bg-primary/10 text-primary rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                        <span className="material-symbols-outlined text-3xl font-light">menu_book</span>
                    </div>
                </div>

                {/* Total Anggota */}
                <div className="group p-6 bg-surface-light dark:bg-surface-dark border border-slate-200 dark:border-white/5 rounded-2xl flex items-center justify-between shadow-sm hover:border-accent-gold/30 transition-all duration-500">
                    <div className="flex flex-col">
                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mb-1">Total Anggota</p>
                        <p className="text-3xl font-serif font-bold text-slate-900 dark:text-cream leading-none">{data.stats.totalMembers}</p>
                        <p className="text-[11px] text-slate-500 mt-3 flex items-center font-medium">
                            <span className="material-icons-round text-sm mr-1.5 text-accent-gold">group</span>
                            {data.stats.totalClasses} Kelas Terdaftar
                        </p>
                    </div>
                    <div className="w-14 h-14 bg-accent-gold/5 dark:bg-accent-gold/10 text-accent-gold rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                        <span className="material-symbols-outlined text-3xl font-light">group</span>
                    </div>
                </div>

                {/* Peminjaman Aktif */}
                <div className="group p-6 bg-surface-light dark:bg-surface-dark border border-slate-200 dark:border-white/5 rounded-2xl flex items-center justify-between shadow-sm hover:border-red-500/30 transition-all duration-500">
                    <div className="flex flex-col">
                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mb-1">Peminjaman Aktif</p>
                        <p className="text-3xl font-serif font-bold text-slate-900 dark:text-cream leading-none">{data.stats.activeLoans}</p>
                        <p className="text-[11px] text-slate-500 mt-3 flex items-center font-medium">
                            <span className="material-icons-round text-sm mr-1.5 text-red-500">history_toggle_off</span>
                            {data.stats.overdueLoans} Terlambat
                        </p>
                    </div>
                    <div className="w-14 h-14 bg-red-500/5 dark:bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                        <span className="material-symbols-outlined text-3xl font-light">book_2</span>
                    </div>
                </div>
            </div>

            {/* Middle Section: Chart & Recent Activity */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Chart */}
                <div className="xl:col-span-2 bg-surface-light dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm p-6 flex flex-col">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-lg font-serif font-bold text-slate-900 dark:text-cream">Tren Peminjaman</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-widest font-semibold mt-1">Siklus Lektur Bulanan</p>
                        </div>
                    </div>
                    <div className="w-full min-h-[300px] h-[300px]">
                        {chartData && chartData.monthlyLoans.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData.monthlyLoans} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.15} />
                                            <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(203, 213, 225, 0.2)" />
                                    <XAxis
                                        dataKey="month"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 10, fill: '#94A3B8', fontWeight: 600 }}
                                        dy={15}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 10, fill: '#94A3B8', fontWeight: 600 }}
                                    />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'rgba(18, 26, 33, 0.95)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.5)', color: '#FDFBF7' }}
                                        itemStyle={{ color: '#C5A028' }}
                                        cursor={{ stroke: '#C5A028', strokeWidth: 1, strokeDasharray: '4 4' }}
                                    />
                                    <Area type="monotone" dataKey="count" stroke="var(--color-primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full text-slate-400">
                                Belum ada data statistik
                            </div>
                        )}
                    </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm flex flex-col max-h-[500px]">
                    <div className="p-6 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                        <h3 className="text-lg font-serif font-bold text-slate-900 dark:text-cream">Aktivitas Terbaru</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 no-scrollbar">
                        <div className="space-y-1">
                            {data.recentLoans.length > 0 ? data.recentLoans.map((loan) => (
                                <div key={loan.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl transition-all flex items-start space-x-4">
                                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 text-slate-500 font-bold">
                                        {loan.memberName.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{loan.memberName}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                            {loan.status === 'active' ? 'Meminjam' : 'Mengembalikan'} <span className="font-medium text-slate-700 dark:text-slate-200">
                                                {loan.books.length > 0 ? loan.books[0] : 'Buku'}
                                            </span>
                                            {loan.books.length > 1 && ` +${loan.books.length - 1} lainnya`}
                                        </p>
                                        <span className="text-[10px] text-slate-400 font-medium mt-1 block">{new Date(loan.loanDate).toLocaleDateString('id-ID')}</span>
                                    </div>
                                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase ${loan.status === 'active'
                                        ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                        : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                        }`}>
                                        {loan.status === 'active' ? 'Pinjam' : 'Kembali'}
                                    </span>
                                </div>
                            )) : (
                                <div className="p-4 text-center text-slate-500 text-sm">Belum ada aktivitas</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Top Readers & Finance Section */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Top Readers Leaderboard */}
                <div className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm">
                    <div className="p-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            <span className="material-icons-round text-accent-gold">emoji_events</span>
                            <h3 className="text-lg font-serif font-bold text-slate-900 dark:text-cream">Top Readers Bulan Ini</h3>
                        </div>
                    </div>
                    <div className="p-4">
                        {topReaders.length > 0 ? (
                            <div className="space-y-3">
                                {topReaders.slice(0, 5).map((reader, idx) => (
                                    <div key={reader.memberId} className="flex items-center space-x-3 p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-transparent hover:border-accent-gold/20 transition-all">
                                        <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${idx === 0 ? 'bg-accent-gold text-white' :
                                            idx === 1 ? 'bg-slate-400 text-white' :
                                                idx === 2 ? 'bg-amber-800 text-white' :
                                                    'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                            }`}>
                                            {idx + 1}
                                        </span>
                                        <div className="flex-1">
                                            <p className="font-semibold text-slate-800 dark:text-white">{reader.name}</p>
                                            <p className="text-xs text-slate-500">{reader.className}</p>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-lg font-bold text-primary">{reader.loanCount}</span>
                                            <span className="text-xs text-slate-500 ml-1">pinjam</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-slate-500">Belum ada data pembaca</div>
                        )}
                    </div>
                </div>

                {/* Fine Summary */}
                <div className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm">
                    <div className="p-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            <span className="material-icons-round text-primary">payments</span>
                            <h3 className="text-lg font-serif font-bold text-slate-900 dark:text-cream">Ringkasan Denda</h3>
                        </div>
                    </div>
                    <div className="p-6">
                        {fineSummary ? (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 bg-red-50 dark:bg-red-500/10 rounded-xl">
                                        <p className="text-xs text-red-600 dark:text-red-400 font-semibold mb-1">Belum Dibayar</p>
                                        <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                                            Rp {fineSummary.totalUnpaidFines.toLocaleString('id-ID')}
                                        </p>
                                    </div>
                                    <div className="p-4 bg-green-50 dark:bg-green-500/10 rounded-xl">
                                        <p className="text-xs text-green-600 dark:text-green-400 font-semibold mb-1">Sudah Dibayar</p>
                                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                                            Rp {fineSummary.totalPaidFines.toLocaleString('id-ID')}
                                        </p>
                                    </div>
                                </div>
                                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg flex items-center justify-between">
                                    <span className="text-sm text-slate-600 dark:text-slate-400">Tarif denda per hari</span>
                                    <span className="font-bold text-slate-900 dark:text-white">Rp {fineSummary.fineRate.toLocaleString('id-ID')}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-8 text-slate-500">Belum ada data denda</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom Widgets */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                {/* Buku Populer #1 */}
                <div className="bg-surface-light dark:bg-surface-dark p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Buku Populer</span>
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-14 bg-slate-100 dark:bg-slate-800 rounded flex items-center justify-center text-slate-400">
                            <span className="material-icons-round text-lg">book</span>
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-sm font-bold truncate">
                                {data.popularBooks.length > 0 ? data.popularBooks[0].title : '-'}
                            </p>
                            <p className="text-[10px] text-slate-500">
                                {data.popularBooks.length > 0 ? `${data.popularBooks[0].borrowCount}x dipinjam` : 'Belum ada data'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Overdue Loans Widget (Replaces Anggota Teraktif) */}
                <div className="bg-surface-light dark:bg-surface-dark p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Terlambat Kembali</span>
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center">
                            <span className="material-icons-round">warning</span>
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-sm font-bold truncate">{data.stats.overdueLoans} Anggota</p>
                            <p className="text-[10px] text-slate-500">Melewati batas waktu</p>
                        </div>
                    </div>
                </div>

                {/* Loans This Month (Replaces Kategori Utama) */}
                <div className="bg-surface-light dark:bg-surface-dark p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Bulan Ini</span>
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                            <span className="material-icons-round">calendar_today</span>
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-sm font-bold truncate">{data.stats.loansThisMonth} Transaksi</p>
                            <p className="text-[10px] text-slate-500">Peminjaman baru</p>
                        </div>
                    </div>
                </div>

                {/* Return this month? Or just keep simple (Replaces Stock Kritis) */}
                <div className="bg-surface-light dark:bg-surface-dark p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Total Kelas</span>
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
                            <span className="material-icons-round">school</span>
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-sm font-bold truncate">{data.stats.totalClasses} Kelas</p>
                            <p className="text-[10px] text-slate-500">Terdaftar sistem</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

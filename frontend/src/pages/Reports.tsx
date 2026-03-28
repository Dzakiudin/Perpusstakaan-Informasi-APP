import { useState, useEffect } from 'react';
import api from '../services/api';

interface Class {
    id: number;
    name: string;
}

type ReportType = 'books' | 'members' | 'loans' | 'overdue';

export default function Reports() {
    const [classes, setClasses] = useState<Class[]>([]);
    const [loading, setLoading] = useState<ReportType | null>(null);
    const [selectedReport, setSelectedReport] = useState<ReportType>('books');

    // Filters
    const [filters, setFilters] = useState({
        classId: '',
        status: '',
        startDate: '',
        endDate: '',
    });

    useEffect(() => {
        fetchClasses();
    }, []);

    const fetchClasses = async () => {
        try {
            const res = await api.get('/classes');
            setClasses(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const downloadReport = async (type: ReportType) => {
        setLoading(type);
        try {
            const params = new URLSearchParams();

            if (type === 'members' && filters.classId) {
                params.set('classId', filters.classId);
            }
            if (type === 'loans') {
                if (filters.classId) params.set('classId', filters.classId);
                if (filters.status) params.set('status', filters.status);
                if (filters.startDate) params.set('startDate', filters.startDate);
                if (filters.endDate) params.set('endDate', filters.endDate);
            }

            const res = await api.get(`/reports/${type}?${params.toString()}`, {
                responseType: 'blob',
            });

            // Create download link
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;

            const filenames: Record<ReportType, string> = {
                books: 'laporan-buku.xlsx',
                members: 'laporan-anggota.xlsx',
                loans: 'laporan-peminjaman.xlsx',
                overdue: 'laporan-terlambat.xlsx',
            };
            link.setAttribute('download', filenames[type]);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Failed to download report:', err);
            alert('Gagal mengunduh laporan');
        } finally {
            setLoading(null);
        }
    };

    const reports = [
        {
            type: 'books' as ReportType,
            title: 'Laporan Data Buku',
            description: 'Daftar seluruh koleksi buku perpustakaan',
            icon: 'menu_book',
            color: 'blue',
        },
        {
            type: 'members' as ReportType,
            title: 'Laporan Data Anggota',
            description: 'Daftar seluruh anggota perpustakaan',
            icon: 'group',
            color: 'emerald',
        },
        {
            type: 'loans' as ReportType,
            title: 'Laporan Peminjaman',
            description: 'Riwayat transaksi peminjaman buku',
            icon: 'assignment',
            color: 'orange',
        },
        {
            type: 'overdue' as ReportType,
            title: 'Laporan Buku Terlambat',
            description: 'Daftar peminjaman yang melewati batas waktu',
            icon: 'warning',
            color: 'red',
        },
    ];

    const getColorClass = (color: string, variant: 'bg' | 'text' | 'border') => {
        const colors: Record<string, Record<string, string>> = {
            blue: { bg: 'bg-blue-50 dark:bg-blue-500/10', text: 'text-blue-600', border: 'border-blue-200 dark:border-blue-500/20' },
            emerald: { bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-600', border: 'border-emerald-200 dark:border-emerald-500/20' },
            orange: { bg: 'bg-orange-50 dark:bg-orange-500/10', text: 'text-orange-600', border: 'border-orange-200 dark:border-orange-500/20' },
            red: { bg: 'bg-red-50 dark:bg-red-500/10', text: 'text-red-600', border: 'border-red-200 dark:border-red-500/20' },
        };
        return colors[color]?.[variant] || '';
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Laporan Perpustakaan</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">Unduh laporan dalam format Excel (.xlsx)</p>
            </div>

            {/* Report Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {reports.map((report) => (
                    <div
                        key={report.type}
                        className={`relative bg-surface-light dark:bg-surface-dark rounded-2xl border ${selectedReport === report.type ? getColorClass(report.color, 'border') : 'border-slate-200 dark:border-slate-800'
                            } p-6 cursor-pointer transition-all hover:shadow-lg`}
                        onClick={() => setSelectedReport(report.type)}
                    >
                        <div className="flex items-start justify-between">
                            <div className="flex items-center space-x-4">
                                <div className={`w-12 h-12 rounded-xl ${getColorClass(report.color, 'bg')} ${getColorClass(report.color, 'text')} flex items-center justify-center`}>
                                    <span className="material-icons-round">{report.icon}</span>
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-900 dark:text-white">{report.title}</h3>
                                    <p className="text-sm text-slate-500">{report.description}</p>
                                </div>
                            </div>
                            {selectedReport === report.type && (
                                <span className={`material-icons-round ${getColorClass(report.color, 'text')}`}>check_circle</span>
                            )}
                        </div>

                        {/* Filters for selected report */}
                        {selectedReport === report.type && (
                            <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
                                {(report.type === 'members' || report.type === 'loans') && (
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1.5">Kelas</label>
                                            <select
                                                value={filters.classId}
                                                onChange={(e) => setFilters(f => ({ ...f, classId: e.target.value }))}
                                                onClick={(e) => e.stopPropagation()}
                                                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                            >
                                                <option value="">Semua Kelas</option>
                                                {classes.map(c => (
                                                    <option key={c.id} value={c.id}>{c.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        {report.type === 'loans' && (
                                            <div>
                                                <label className="block text-xs font-medium text-slate-500 mb-1.5">Status</label>
                                                <select
                                                    value={filters.status}
                                                    onChange={(e) => setFilters(f => ({ ...f, status: e.target.value }))}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                                >
                                                    <option value="">Semua Status</option>
                                                    <option value="active">Aktif</option>
                                                    <option value="returned">Dikembalikan</option>
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {report.type === 'loans' && (
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1.5">Dari Tanggal</label>
                                            <input
                                                type="date"
                                                value={filters.startDate}
                                                onChange={(e) => setFilters(f => ({ ...f, startDate: e.target.value }))}
                                                onClick={(e) => e.stopPropagation()}
                                                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1.5">Sampai Tanggal</label>
                                            <input
                                                type="date"
                                                value={filters.endDate}
                                                onChange={(e) => setFilters(f => ({ ...f, endDate: e.target.value }))}
                                                onClick={(e) => e.stopPropagation()}
                                                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                            />
                                        </div>
                                    </div>
                                )}

                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        downloadReport(report.type);
                                    }}
                                    disabled={loading === report.type}
                                    className={`w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-lg font-medium transition-all ${getColorClass(report.color, 'bg')} ${getColorClass(report.color, 'text')} hover:opacity-80 disabled:opacity-50`}
                                >
                                    {loading === report.type ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-current"></div>
                                            <span>Mengunduh...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="material-icons-round text-lg">download</span>
                                            <span>Unduh Laporan Excel</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Info */}
            <div className="bg-blue-50 dark:bg-blue-500/10 rounded-xl p-4 flex items-start space-x-3">
                <span className="material-icons-round text-blue-600">info</span>
                <div className="text-sm text-blue-800 dark:text-blue-300">
                    <p className="font-medium">Informasi</p>
                    <p className="text-blue-600 dark:text-blue-400 mt-1">
                        Laporan akan diunduh dalam format Excel (.xlsx) dan dapat dibuka menggunakan Microsoft Excel, Google Sheets, atau aplikasi spreadsheet lainnya.
                    </p>
                </div>
            </div>
        </div>
    );
}

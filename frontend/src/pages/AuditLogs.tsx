import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../App';

interface AuditLog {
    id: number;
    userId: number | null;
    user: { id: number; name: string; email: string } | null;
    action: string;
    entity: string;
    entityId: number | null;
    details: any;
    ipAddress: string | null;
    createdAt: string;
}

export default function AuditLogs() {
    const { user } = useAuth();
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
    const [filters, setFilters] = useState({
        action: '',
        entity: '',
        startDate: '',
        endDate: '',
    });

    const fetchLogs = async (page = 1) => {
        try {
            setLoading(true);
            const params = new URLSearchParams({ page: page.toString(), limit: '50' });
            if (filters.action) params.append('action', filters.action);
            if (filters.entity) params.append('entity', filters.entity);
            if (filters.startDate) params.append('startDate', filters.startDate);
            if (filters.endDate) params.append('endDate', filters.endDate);

            const response = await api.get(`/audit-logs?${params}`);
            setLogs(response.data.data);
            setPagination(response.data.pagination);
        } catch (err) {
            console.error('Failed to fetch logs:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user?.role === 'admin') {
            fetchLogs();
        }
    }, [user]);

    const handleFilter = () => {
        fetchLogs(1);
    };

    const getActionBadge = (action: string) => {
        const styles: { [key: string]: string } = {
            CREATE: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
            UPDATE: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
            DELETE: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
            LOGIN: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400',
            LOGOUT: 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-400',
            LOAN: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
            RETURN: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
        };
        return styles[action] || 'bg-slate-100 text-slate-700';
    };

    if (user?.role !== 'admin') {
        return (
            <div className="flex flex-col items-center justify-center h-64">
                <span className="material-icons-round text-6xl text-slate-300 dark:text-slate-600">lock</span>
                <p className="mt-4 text-slate-500 dark:text-slate-400">Hanya admin yang dapat mengakses halaman ini</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Filters */}
            <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-4 border border-slate-200 dark:border-slate-800">
                <div className="flex flex-wrap gap-4">
                    <select
                        value={filters.action}
                        onChange={(e) => setFilters({ ...filters, action: e.target.value })}
                        className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-slate-900 dark:text-white"
                    >
                        <option value="">Semua Aksi</option>
                        <option value="LOGIN">LOGIN</option>
                        <option value="LOGOUT">LOGOUT</option>
                        <option value="LOAN">LOAN</option>
                        <option value="RETURN">RETURN</option>
                        <option value="CREATE">CREATE</option>
                        <option value="UPDATE">UPDATE</option>
                        <option value="DELETE">DELETE</option>
                    </select>
                    <select
                        value={filters.entity}
                        onChange={(e) => setFilters({ ...filters, entity: e.target.value })}
                        className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-slate-900 dark:text-white"
                    >
                        <option value="">Semua Entitas</option>
                        <option value="Book">Buku</option>
                        <option value="Member">Anggota</option>
                        <option value="Loan">Peminjaman</option>
                        <option value="User">User</option>
                    </select>
                    <input
                        type="date"
                        value={filters.startDate}
                        onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                        className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-slate-900 dark:text-white"
                    />
                    <input
                        type="date"
                        value={filters.endDate}
                        onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                        className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-slate-900 dark:text-white"
                    />
                    <button
                        onClick={handleFilter}
                        className="px-4 py-2 bg-primary hover:bg-primary/90 text-white font-semibold rounded-lg transition-all"
                    >
                        Filter
                    </button>
                </div>
            </div>

            {/* Logs Table */}
            <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Waktu</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">User</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Aksi</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Entitas</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Detail</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center">
                                        <div className="flex items-center justify-center">
                                            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary"></div>
                                        </div>
                                    </td>
                                </tr>
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                                        Tidak ada log aktivitas
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                            {new Date(log.createdAt).toLocaleString('id-ID')}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-800 dark:text-slate-200">
                                            {log.user?.name || 'System'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getActionBadge(log.action)}`}>
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                                            {log.entity} {log.entityId ? `#${log.entityId}` : ''}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 max-w-xs truncate">
                                            {log.details ? JSON.stringify(log.details).substring(0, 50) + '...' : '-'}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                    <div className="px-4 py-3 flex items-center justify-between border-t border-slate-200 dark:border-slate-800">
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Halaman {pagination.page} dari {pagination.totalPages}
                        </p>
                        <div className="flex space-x-2">
                            <button
                                onClick={() => fetchLogs(pagination.page - 1)}
                                disabled={pagination.page === 1}
                                className="px-3 py-1 text-sm bg-slate-100 dark:bg-slate-800 rounded-lg disabled:opacity-50"
                            >
                                Prev
                            </button>
                            <button
                                onClick={() => fetchLogs(pagination.page + 1)}
                                disabled={pagination.page === pagination.totalPages}
                                className="px-3 py-1 text-sm bg-slate-100 dark:bg-slate-800 rounded-lg disabled:opacity-50"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

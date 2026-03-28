import { useState, useEffect, useRef } from 'react';
import api from '../services/api';

interface Class {
    id: number;
    name: string;
    waliKelas: string | null;
    _count?: { members: number };
}

export default function Classes() {
    const [classes, setClasses] = useState<Class[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingClass, setEditingClass] = useState<Class | null>(null);
    const [formData, setFormData] = useState({ name: '', waliKelas: '' });
    const [error, setError] = useState('');
    const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });

    // Filter State
    const [showFilterPopover, setShowFilterPopover] = useState(false);
    const [filterHasWali, setFilterHasWali] = useState('');
    const [filterMemberCount, setFilterMemberCount] = useState('');
    const [sortBy, setSortBy] = useState('name');
    const [sortOrder, setSortOrder] = useState('asc');
    const filterRef = useRef<HTMLDivElement>(null);

    // Bulk Selection State
    const [selectedClasses, setSelectedClasses] = useState<number[]>([]);
    const [selectAllGlobal, setSelectAllGlobal] = useState(false);
    const [excludedIds, setExcludedIds] = useState<number[]>([]);
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);

    const activeFilterCount = [filterHasWali, filterMemberCount].filter(Boolean).length +
        (sortBy !== 'name' || sortOrder !== 'asc' ? 1 : 0);

    const fetchClasses = async (page = 1) => {
        try {
            setLoading(true);
            const res = await api.get('/classes', {
                params: {
                    search,
                    hasWali: filterHasWali || undefined,
                    memberCount: filterMemberCount || undefined,
                    sortBy,
                    sortOrder,
                    page,
                    limit: 10,
                },
            });

            // Handle both paginated and non-paginated response
            if (res.data.data) {
                setClasses(res.data.data);
                setPagination(res.data.pagination);
            } else {
                setClasses(res.data);
                setPagination({ page: 1, total: res.data.length, totalPages: 1 });
            }
        } catch (err) {
            console.error('Failed to fetch classes:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchClasses();
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchClasses(1);
            setSelectAllGlobal(false);
            setExcludedIds([]);
            setSelectedClasses([]);
        }, 500);
        return () => clearTimeout(timer);
    }, [search]);

    // Re-fetch when filters change
    useEffect(() => {
        fetchClasses(1);
        setSelectAllGlobal(false);
        setExcludedIds([]);
        setSelectedClasses([]);
    }, [filterHasWali, filterMemberCount, sortBy, sortOrder]);

    // Close filter popover on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
                setShowFilterPopover(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!formData.name.trim()) {
            setError('Nama kelas wajib diisi');
            return;
        }

        try {
            if (editingClass) {
                await api.put(`/classes/${editingClass.id}`, formData);
            } else {
                await api.post('/classes', formData);
            }
            setShowModal(false);
            setFormData({ name: '', waliKelas: '' });
            setEditingClass(null);
            fetchClasses(pagination.page);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Gagal menyimpan data');
        }
    };

    const handleEdit = (cls: Class) => {
        setEditingClass(cls);
        setFormData({ name: cls.name, waliKelas: cls.waliKelas || '' });
        setError('');
        setShowModal(true);
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Hapus kelas ini? Anggota di kelas ini akan dipindahkan ke tanpa kelas.')) return;
        try {
            await api.delete(`/classes/${id}`);
            fetchClasses(pagination.page);
        } catch (err: any) {
            alert(err.response?.data?.error || 'Gagal menghapus kelas');
        }
    };

    const openAddModal = () => {
        setEditingClass(null);
        setFormData({ name: '', waliKelas: '' });
        setError('');
        setShowModal(true);
    };

    // Bulk Actions
    const toggleSelectAll = () => {
        if (selectAllGlobal) {
            setSelectAllGlobal(false);
            setExcludedIds([]);
            setSelectedClasses([]);
        } else if (selectedClasses.length === classes.length && classes.length > 0) {
            setSelectedClasses([]);
        } else {
            setSelectedClasses(classes.map(c => c.id));
        }
    };

    const handleSelectAllGlobal = () => {
        setSelectAllGlobal(true);
        setExcludedIds([]);
        setSelectedClasses(classes.map(c => c.id));
    };

    const toggleSelectClass = (id: number) => {
        if (selectAllGlobal) {
            if (excludedIds.includes(id)) {
                setExcludedIds(excludedIds.filter(eId => eId !== id));
            } else {
                setExcludedIds([...excludedIds, id]);
            }
        } else {
            if (selectedClasses.includes(id)) {
                setSelectedClasses(selectedClasses.filter(cId => cId !== id));
            } else {
                setSelectedClasses([...selectedClasses, id]);
            }
        }
    };

    const isClassSelected = (id: number) => {
        if (selectAllGlobal) {
            return !excludedIds.includes(id);
        }
        return selectedClasses.includes(id);
    };

    const totalSelected = selectAllGlobal
        ? pagination.total - excludedIds.length
        : selectedClasses.length;

    const handleBulkDelete = async () => {
        if (totalSelected === 0) return;

        if (!confirm(`Yakin ingin menghapus ${totalSelected} kelas terpilih? Anggota di kelas tersebut akan dipindahkan ke tanpa kelas.`)) return;

        setIsBulkDeleting(true);
        try {
            const response = await api.post('/classes/bulk-delete', {
                ids: selectAllGlobal ? [] : selectedClasses,
                selectAll: selectAllGlobal,
                excludeIds: excludedIds,
                filters: { search },
            });
            const { deleted, membersAffected } = response.data;

            let message = `${deleted} kelas berhasil dihapus.`;
            if (membersAffected > 0) {
                message += ` ${membersAffected} anggota dipindahkan ke tanpa kelas.`;
            }

            alert(message);
            setSelectedClasses([]);
            setSelectAllGlobal(false);
            setExcludedIds([]);
            fetchClasses(pagination.page);
        } catch (err: any) {
            alert(err.response?.data?.error || 'Gagal menghapus kelas');
        } finally {
            setIsBulkDeleting(false);
        }
    };

    const clearFilters = () => {
        setFilterHasWali('');
        setFilterMemberCount('');
        setSortBy('name');
        setSortOrder('asc');
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
                            placeholder="Cari nama kelas atau wali kelas..."
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    {/* Filter Button */}
                    <div className="relative" ref={filterRef}>
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
                            <div className="absolute right-0 top-full mt-2 w-72 bg-surface-light dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl z-50 p-4 space-y-4 animate-fade-in">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-semibold text-slate-800 dark:text-white text-sm">Filter & Urutan</h4>
                                    {activeFilterCount > 0 && (
                                        <button onClick={clearFilters} className="text-xs text-primary hover:underline">Reset</button>
                                    )}
                                </div>

                                {/* Wali Kelas Filter */}
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Status Wali Kelas</label>
                                    <select
                                        value={filterHasWali}
                                        onChange={(e) => setFilterHasWali(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                    >
                                        <option value="">Semua</option>
                                        <option value="yes">Ada wali kelas</option>
                                        <option value="no">Belum ada wali kelas</option>
                                    </select>
                                </div>

                                {/* Member Count Filter */}
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Jumlah Anggota</label>
                                    <select
                                        value={filterMemberCount}
                                        onChange={(e) => setFilterMemberCount(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                    >
                                        <option value="">Semua</option>
                                        <option value="gt0">{'>'}0 anggota</option>
                                        <option value="eq0">0 anggota</option>
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
                                            <option value="name">Nama Kelas</option>
                                            <option value="memberCount">Jumlah Anggota</option>
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
                <button
                    onClick={openAddModal}
                    className="flex items-center justify-center space-x-2 px-6 py-2.5 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl transition-all shadow-lg shadow-primary/25 active:scale-95"
                >
                    <span className="material-icons-round text-lg">add</span>
                    <span>Tambah Kelas</span>
                </button>
            </div>

            {/* Bulk Action Bar & Selection Banner */}
            {(selectedClasses.length > 0 || selectAllGlobal) && (
                <div className="space-y-2">
                    {/* Global Selection Banner */}
                    {!selectAllGlobal && selectedClasses.length === classes.length && pagination.total > classes.length && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-lg text-sm text-center text-slate-600 dark:text-slate-300 border border-blue-100 dark:border-blue-800 animate-fade-in">
                            Semua <strong>{classes.length}</strong> kelas di halaman ini dipilih.
                            <button
                                onClick={handleSelectAllGlobal}
                                className="ml-2 font-bold text-blue-600 dark:text-blue-400 hover:underline focus:outline-none"
                            >
                                Pilih semua {pagination.total} kelas di database
                            </button>
                        </div>
                    )}

                    {selectAllGlobal && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-lg text-sm text-center text-slate-600 dark:text-slate-300 border border-blue-100 dark:border-blue-800 animate-fade-in">
                            Semua <strong>{pagination.total}</strong> kelas dipilih.
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
                                kelas terpilih
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

            {/* Data Indicator */}
            {!loading && (
                <div className="text-sm text-slate-500 dark:text-slate-400">
                    Menampilkan {classes.length} dari {pagination.total} data
                </div>
            )}

            {/* Table */}
            <div className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                {loading ? (
                    <div className="flex justify-center items-center h-48">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                    </div>
                ) : classes.length === 0 ? (
                    <div className="text-center py-16 text-slate-500">
                        <span className="material-icons-round text-5xl mb-3 opacity-30">school</span>
                        <p>{search || activeFilterCount > 0 ? 'Tidak ada kelas yang cocok dengan pencarian/filter' : 'Belum ada data kelas'}</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                                    <th className="w-12 px-4 py-4">
                                        <div className="flex items-center justify-center">
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                                                checked={classes.length > 0 && (selectAllGlobal || selectedClasses.length === classes.length)}
                                                onChange={toggleSelectAll}
                                            />
                                        </div>
                                    </th>
                                    <th className="text-left px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">No</th>
                                    <th className="text-left px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Nama Kelas</th>
                                    <th className="text-left px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Wali Kelas</th>
                                    <th className="text-left px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Jumlah Anggota</th>
                                    <th className="text-right px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {classes.map((cls, index) => (
                                    <tr key={cls.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group ${isClassSelected(cls.id) ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            <div className="flex items-center justify-center">
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                                                    checked={isClassSelected(cls.id)}
                                                    onChange={() => toggleSelectClass(cls.id)}
                                                />
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                                            {(pagination.page - 1) * 10 + index + 1}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center space-x-3">
                                                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 text-primary">
                                                    <span className="material-icons-round text-lg">school</span>
                                                </div>
                                                <span className="font-semibold text-slate-900 dark:text-white">{cls.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                                            {cls.waliKelas ? (
                                                <span className="flex items-center space-x-1.5">
                                                    <span className="material-icons-round text-sm text-emerald-500">person</span>
                                                    <span>{cls.waliKelas}</span>
                                                </span>
                                            ) : (
                                                <span className="text-slate-400 dark:text-slate-500 italic">Belum ditentukan</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${(cls._count?.members || 0) > 0
                                                ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                                : 'bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400'
                                                }`}>
                                                {cls._count?.members || 0} anggota
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end space-x-1">
                                                <button
                                                    onClick={() => handleEdit(cls)}
                                                    className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                                    title="Edit"
                                                >
                                                    <span className="material-icons-round text-lg">edit</span>
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(cls.id)}
                                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                                    title="Hapus"
                                                >
                                                    <span className="material-icons-round text-lg">delete</span>
                                                </button>
                                            </div>
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
                <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Halaman {pagination.page} dari {pagination.totalPages}
                    </p>
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={() => fetchClasses(pagination.page - 1)}
                            disabled={pagination.page <= 1}
                            className="px-3 py-2 bg-surface-light dark:bg-surface-dark border border-slate-200 dark:border-slate-700 rounded-lg text-sm disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                        >
                            <span className="material-icons-round text-sm">chevron_left</span>
                        </button>
                        {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => {
                            let pageNum: number;
                            if (pagination.totalPages <= 5) {
                                pageNum = i + 1;
                            } else if (pagination.page <= 3) {
                                pageNum = i + 1;
                            } else if (pagination.page >= pagination.totalPages - 2) {
                                pageNum = pagination.totalPages - 4 + i;
                            } else {
                                pageNum = pagination.page - 2 + i;
                            }
                            return (
                                <button
                                    key={pageNum}
                                    onClick={() => fetchClasses(pageNum)}
                                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${pagination.page === pageNum
                                        ? 'bg-primary text-white shadow-md'
                                        : 'bg-surface-light dark:bg-surface-dark border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                                        }`}
                                >
                                    {pageNum}
                                </button>
                            );
                        })}
                        <button
                            onClick={() => fetchClasses(pagination.page + 1)}
                            disabled={pagination.page >= pagination.totalPages}
                            className="px-3 py-2 bg-surface-light dark:bg-surface-dark border border-slate-200 dark:border-slate-700 rounded-lg text-sm disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                        >
                            <span className="material-icons-round text-sm">chevron_right</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowModal(false)}>
                    <div className="bg-surface-light dark:bg-surface-dark rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                {editingClass ? 'Edit Kelas' : 'Tambah Kelas'}
                            </h3>
                            <button
                                onClick={() => setShowModal(false)}
                                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
                            >
                                <span className="material-icons-round">close</span>
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            {error && (
                                <div className="p-3 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg text-sm">
                                    {error}
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                    Nama Kelas <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Contoh: XII IPA 1"
                                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                    Wali Kelas
                                </label>
                                <input
                                    type="text"
                                    value={formData.waliKelas}
                                    onChange={(e) => setFormData({ ...formData, waliKelas: e.target.value })}
                                    placeholder="Nama wali kelas"
                                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                />
                            </div>
                            <div className="flex justify-end space-x-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2.5 bg-primary text-white rounded-lg hover:bg-blue-600 transition-colors shadow-md"
                                >
                                    {editingClass ? 'Simpan' : 'Tambah'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

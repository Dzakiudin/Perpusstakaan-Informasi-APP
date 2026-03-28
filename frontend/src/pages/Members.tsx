import { useState, useEffect, useRef } from 'react';
import api from '../services/api';

interface Member {
    id: number;
    nis: string;
    name: string;
    classId: number;
    class: { id: number; name: string };
    phone: string | null;
    address: string | null;
    status: string;
    memberSince: string;
}

interface Class {
    id: number;
    name: string;
}

interface Stats {
    totalMembers: number;
    activeMembers: number;
    newMembersThisMonth: number;
}

interface ImportResult {
    total: number;
    success: number;
    failed: number;
    errors: { row: number; nis: string; error: string }[];
}

export default function Members() {
    const [members, setMembers] = useState<Member[]>([]);
    const [classes, setClasses] = useState<Class[]>([]);
    const [stats, setStats] = useState<Stats>({ totalMembers: 0, activeMembers: 0, newMembersThisMonth: 0 });
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState<ImportResult | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [editingMember, setEditingMember] = useState<Member | null>(null);
    const [formData, setFormData] = useState({
        nis: '',
        name: '',
        classId: '',
        phone: '',
        address: '',
    });
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });

    // Bulk Selection State
    // Bulk Selection State
    const [selectedMembers, setSelectedMembers] = useState<number[]>([]);
    const [selectAllGlobal, setSelectAllGlobal] = useState(false);
    const [excludedIds, setExcludedIds] = useState<number[]>([]);
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);
    const [isBulkPrinting, setIsBulkPrinting] = useState(false);

    // Filter State
    const [showFilterPopover, setShowFilterPopover] = useState(false);
    const [filterClassId, setFilterClassId] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [sortBy, setSortBy] = useState('name');
    const [sortOrder, setSortOrder] = useState('asc');
    const filterRef = useRef<HTMLDivElement>(null);

    const activeFilterCount = [filterClassId, filterStatus].filter(Boolean).length +
        (sortBy !== 'name' || sortOrder !== 'asc' ? 1 : 0);

    const fetchData = async (page = 1) => {
        try {
            setLoading(true);
            const [membersRes, classesRes, dashboardRes] = await Promise.all([
                api.get('/members', {
                    params: {
                        search, page, limit: 5,
                        classId: filterClassId || undefined,
                        status: filterStatus || undefined,
                        sortBy, sortOrder,
                    },
                }),
                api.get('/classes'),
                api.get('/dashboard')
            ]);

            setMembers(membersRes.data.data);
            setPagination(membersRes.data.pagination);
            setClasses(classesRes.data);

            const dashboardStats = dashboardRes.data.stats;
            // Calculate stats utilizing dashboard data and member list
            // Note: In a real app, you might want specific endpoints for these stats
            setStats({
                totalMembers: membersRes.data.pagination.total,
                activeMembers: dashboardStats.totalMembers || 0,
                newMembersThisMonth: 0
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
            setSelectedMembers([]);
        }, 500);
        return () => clearTimeout(timer);
    }, [search]);

    // Re-fetch when filters change
    useEffect(() => {
        fetchData(1);
        setSelectAllGlobal(false);
        setExcludedIds([]);
        setSelectedMembers([]);
    }, [filterClassId, filterStatus, sortBy, sortOrder]);

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

    const clearFilters = () => {
        setFilterClassId('');
        setFilterStatus('');
        setSortBy('name');
        setSortOrder('asc');
    };

    const openModal = (member?: Member) => {
        setError('');
        if (member) {
            setEditingMember(member);
            setFormData({
                nis: member.nis,
                name: member.name,
                classId: member.classId?.toString() || '',
                phone: member.phone || '',
                address: member.address || '',
            });
        } else {
            setEditingMember(null);
            setFormData({
                nis: '',
                name: '',
                classId: classes[0]?.id?.toString() || '',
                phone: '',
                address: '',
            });
        }
        setShowModal(true);
    };

    const handleDownloadTemplate = async () => {
        try {
            const response = await api.get('/members/import/template', {
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'template-import-anggota.xlsx');
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
            const response = await api.post('/members/import', formData, {
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

    // Bulk Actions
    const toggleSelectAll = () => {
        if (selectAllGlobal) {
            setSelectAllGlobal(false);
            setExcludedIds([]);
            setSelectedMembers([]);
        } else if (selectedMembers.length === members.length && members.length > 0) {
            setSelectedMembers([]);
        } else {
            setSelectedMembers(members.map(m => m.id));
        }
    };

    const handleSelectAllGlobal = () => {
        setSelectAllGlobal(true);
        setExcludedIds([]);
    };

    const toggleSelectMember = (id: number) => {
        if (selectAllGlobal) {
            if (excludedIds.includes(id)) {
                setExcludedIds(excludedIds.filter(eId => eId !== id));
            } else {
                setExcludedIds([...excludedIds, id]);
            }
        } else {
            if (selectedMembers.includes(id)) {
                setSelectedMembers(selectedMembers.filter(mId => mId !== id));
            } else {
                setSelectedMembers([...selectedMembers, id]);
            }
        }
    };

    const isMemberSelected = (id: number) => {
        if (selectAllGlobal) {
            return !excludedIds.includes(id);
        }
        return selectedMembers.includes(id);
    };

    const totalSelected = selectAllGlobal
        ? pagination.total - excludedIds.length
        : selectedMembers.length;

    const handleBulkDelete = async () => {
        if (totalSelected === 0) return;

        if (!confirm(`Yakin ingin menghapus ${totalSelected} anggota terpilih?`)) return;

        setIsBulkDeleting(true);
        try {
            const response = await api.post('/members/bulk-delete', {
                ids: selectAllGlobal ? [] : selectedMembers,
                selectAll: selectAllGlobal,
                excludeIds: excludedIds,
                filters: { search }
            });
            const { deleted, skipped } = response.data;

            let message = `${deleted} anggota berhasil dihapus.`;
            if (skipped && skipped.length > 0) {
                message += `\n${skipped.length} anggota dilewati karena memiliki peminjaman aktif.`;
            }

            alert(message);
            setSelectedMembers([]);
            setSelectAllGlobal(false);
            setExcludedIds([]);
            fetchData(pagination.page);
        } catch (err: any) {
            alert(err.response?.data?.error || 'Gagal menghapus anggota');
        } finally {
            setIsBulkDeleting(false);
        }
    };

    const handleBulkPrintCard = async () => {
        if (totalSelected === 0) return;

        setIsBulkPrinting(true);
        try {
            const payload = {
                memberIds: selectAllGlobal ? [] : selectedMembers,
                selectAll: selectAllGlobal,
                excludeIds: excludedIds,
                filters: { search }
            };

            const response = await api.post('/members/cards/bulk', payload, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `kartu-anggota-bulk-${totalSelected}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            console.error('Bulk print error:', err);
            alert('Gagal mencetak kartu anggota terpilih');
        } finally {
            setIsBulkPrinting(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSaving(true);

        try {
            if (editingMember) {
                await api.put(`/members/${editingMember.id}`, formData);
            } else {
                await api.post('/members', formData);
            }
            setShowModal(false);
            fetchData(pagination.page);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Gagal menyimpan anggota');
        } finally {
            setSaving(false);
        }
    };

    const handleToggleStatus = async (member: Member) => {
        const newStatus = member.status === 'active' ? 'inactive' : 'active';
        const actionName = newStatus === 'active' ? 'mengaktifkan' : 'menonaktifkan';

        if (!confirm(`Yakin ingin ${actionName} anggota ini?`)) return;

        try {
            await api.put(`/members/${member.id}`, { ...member, status: newStatus });
            fetchData(pagination.page);
        } catch (err: any) {
            alert(err.response?.data?.error || `Gagal ${actionName} anggota`);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Yakin ingin menghapus anggota ini secara permanen? Riwayat peminjaman akan tetap tersimpan.')) return;

        try {
            await api.delete(`/members/${id}`);
            fetchData(pagination.page);
        } catch (err: any) {
            alert(err.response?.data?.error || 'Gagal menghapus anggota');
        }
    };

    const downloadCard = async (id: number, nis: string) => {
        try {
            const response = await api.get(`/members/${id}/card.pdf`, {
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `kartu-${nis}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            alert('Gagal mengunduh kartu anggota');
        }
    };

    // Helper to generate initials from name
    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .substring(0, 2);
    };

    // Helper for random color based on name (consistent)
    const getAvatarColor = (name: string) => {
        const colors = [
            'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400',
            'bg-pink-100 dark:bg-pink-900/40 text-pink-600 dark:text-pink-400',
            'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400',
            'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400',
            'bg-teal-100 dark:bg-teal-900/40 text-teal-600 dark:text-teal-400',
            'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400',
        ];
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
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
                            placeholder="Cari nama, NIS, atau kelas..."
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
                            <div className="absolute right-0 top-full mt-2 w-80 bg-surface-light dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl z-50 p-4 space-y-4 animate-fade-in">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-semibold text-slate-800 dark:text-white text-sm">Filter & Urutan</h4>
                                    {activeFilterCount > 0 && (
                                        <button onClick={clearFilters} className="text-xs text-primary hover:underline">Reset</button>
                                    )}
                                </div>

                                {/* Class Filter */}
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Kelas</label>
                                    <select
                                        value={filterClassId}
                                        onChange={(e) => setFilterClassId(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                    >
                                        <option value="">Semua Kelas</option>
                                        {classes.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Status Filter */}
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Status</label>
                                    <select
                                        value={filterStatus}
                                        onChange={(e) => setFilterStatus(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                    >
                                        <option value="">Semua Status</option>
                                        <option value="active">Aktif</option>
                                        <option value="inactive">Non-aktif</option>
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
                                            <option value="name">Nama</option>
                                            <option value="nis">NIS</option>
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
                        <span className="material-icons-round text-lg">person_add</span>
                        <span>Tambah Anggota</span>
                    </button>
                </div>
            </div>

            {/* Data Indicator */}
            {!loading && (
                <div className="text-sm text-slate-500 dark:text-slate-400">
                    Menampilkan {members.length} dari {pagination.total} data
                </div>
            )}

            {/* Bulk Action Bar & Selection Banner */}
            {(selectedMembers.length > 0 || selectAllGlobal) && (
                <div className="space-y-2">
                    {/* Global Selection Banner */}
                    {!selectAllGlobal && selectedMembers.length === members.length && pagination.total > members.length && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-lg text-sm text-center text-slate-600 dark:text-slate-300 border border-blue-100 dark:border-blue-800 animate-fade-in">
                            Semua <strong>{members.length}</strong> anggota di halaman ini dipilih.
                            <button
                                onClick={handleSelectAllGlobal}
                                className="ml-2 font-bold text-blue-600 dark:text-blue-400 hover:underline focus:outline-none"
                            >
                                Pilih semua {pagination.total} anggota di database
                            </button>
                        </div>
                    )}

                    {selectAllGlobal && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-lg text-sm text-center text-slate-600 dark:text-slate-300 border border-blue-100 dark:border-blue-800 animate-fade-in">
                            Semua <strong>{pagination.total}</strong> anggota dipilih.
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
                                anggota terpilih
                            </span>
                        </div>
                        <div className="flex items-center space-x-2">
                            <button
                                onClick={handleBulkPrintCard}
                                disabled={isBulkPrinting}
                                className="flex items-center space-x-2 px-4 py-2 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors disabled:opacity-50"
                            >
                                {isBulkPrinting ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600/30 border-t-blue-600"></div>
                                ) : (
                                    <span className="material-icons-round text-lg">print</span>
                                )}
                                <span>Cetak Kartu</span>
                            </button>
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
                                            checked={members.length > 0 && (selectAllGlobal || selectedMembers.length === members.length)}
                                            onChange={toggleSelectAll}
                                        />
                                    </div>
                                </th>
                                <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">NIS</th>
                                <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Nama Lengkap</th>
                                <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Kelas</th>
                                <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">No. Telepon</th>
                                <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tanggal Bergabung</th>
                                <th className="px-6 py-4 text-center text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                                        <div className="flex justify-center items-center">
                                            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary mr-2"></div>
                                            Memuat data...
                                        </div>
                                    </td>
                                </tr>
                            ) : members.length > 0 ? (
                                members.map((member) => (
                                    <tr key={member.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group ${isMemberSelected(member.id) ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                                        <td className="px-6 py-5 whitespace-nowrap">
                                            <div className="flex items-center justify-center">
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                                                    checked={isMemberSelected(member.id)}
                                                    onChange={() => toggleSelectMember(member.id)}
                                                />
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 whitespace-nowrap">
                                            <span className="inline-flex px-2.5 py-1 text-xs font-mono font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-md">
                                                {member.nis}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 whitespace-nowrap">
                                            <div className="flex items-center space-x-3">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${getAvatarColor(member.name)}`}>
                                                    {getInitials(member.name)}
                                                </div>
                                                <span className="text-sm font-semibold text-slate-900 dark:text-white">{member.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 whitespace-nowrap">
                                            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{member.class?.name || '-'}</span>
                                        </td>
                                        <td className="px-6 py-5 whitespace-nowrap">
                                            <span className="text-sm text-slate-600 dark:text-slate-400">{member.phone || '-'}</span>
                                        </td>
                                        <td className="px-6 py-5 whitespace-nowrap">
                                            <span className={`inline-flex items-center px-3 py-1 text-[11px] font-bold rounded-full border uppercase tracking-tight ${member.status === 'active'
                                                ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20'
                                                : 'bg-slate-50 dark:bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-100 dark:border-slate-500/20'
                                                }`}>
                                                {member.status === 'active' ? 'Aktif' : 'Non-aktif'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 whitespace-nowrap">
                                            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                                                {new Date(member.memberSince).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 whitespace-nowrap text-center">
                                            <div className="flex justify-center space-x-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => downloadCard(member.id, member.nis)}
                                                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-600/10 rounded-lg transition-all"
                                                    title="Cetak Kartu"
                                                >
                                                    <span className="material-icons-round text-lg">badge</span>
                                                </button>
                                                <button
                                                    onClick={() => openModal(member)}
                                                    className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                                                    title="Edit Profile"
                                                >
                                                    <span className="material-icons-round text-lg">edit</span>
                                                </button>
                                                <button
                                                    onClick={() => handleToggleStatus(member)}
                                                    className={`p-2 rounded-lg transition-all ${member.status === 'active'
                                                        ? 'text-slate-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/10'
                                                        : 'text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
                                                        }`}
                                                    title={member.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}
                                                >
                                                    <span className="material-icons-round text-lg">
                                                        {member.status === 'active' ? 'block' : 'check_circle'}
                                                    </span>
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(member.id)}
                                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all"
                                                    title="Hapus"
                                                >
                                                    <span className="material-icons-round text-lg">delete</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center">
                                        <div className="flex flex-col items-center justify-center text-slate-400">
                                            <span className="material-icons-round text-4xl mb-2">person_off</span>
                                            <p className="text-sm">Tidak ada data anggota ditemukan</p>
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
                        Menampilkan {members.length > 0 ? ((pagination.page - 1) * 5) + 1 : 0}-
                        {Math.min(pagination.page * 5, pagination.total)} dari {pagination.total} anggota
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
                        <span className="material-icons-round">group</span>
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Total Anggota</p>
                        <p className="text-xl font-bold text-slate-900 dark:text-white leading-none mt-1">{stats.totalMembers.toLocaleString()}</p>
                    </div>
                </div>
                <div className="p-4 bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/10 rounded-2xl flex items-center space-x-4">
                    <div className="w-12 h-12 bg-emerald-500/10 text-emerald-600 rounded-xl flex items-center justify-center">
                        <span className="material-icons-round">how_to_reg</span>
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Anggota Aktif</p>
                        <p className="text-xl font-bold text-slate-900 dark:text-white leading-none mt-1">{stats.activeMembers.toLocaleString()}</p>
                    </div>
                </div>
                <div className="p-4 bg-purple-50 dark:bg-purple-500/5 border border-purple-100 dark:border-purple-500/10 rounded-2xl flex items-center space-x-4">
                    <div className="w-12 h-12 bg-purple-500/10 text-purple-600 rounded-xl flex items-center justify-center">
                        <span className="material-icons-round">person_add_alt_1</span>
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">Anggota Baru Bulan Ini</p>
                        <p className="text-xl font-bold text-slate-900 dark:text-white leading-none mt-1">{stats.newMembersThisMonth.toLocaleString()}</p>
                    </div>
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowModal(false)}>
                    <div className="bg-surface-light dark:bg-surface-dark w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{editingMember ? 'Edit Anggota' : 'Tambah Anggota Baru'}</h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-500 dark:hover:text-slate-300 transition-colors">
                                <span className="material-icons-round">close</span>
                            </button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="p-6 space-y-4">
                                {error && (
                                    <div className="p-3 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-sm rounded-lg">
                                        {error}
                                    </div>
                                )}

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">NIS <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-slate-900 dark:text-white"
                                        value={formData.nis}
                                        onChange={(e) => setFormData({ ...formData, nis: e.target.value })}
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Nama Lengkap <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-slate-900 dark:text-white"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Kelas <span className="text-red-500">*</span></label>
                                    <select
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-slate-900 dark:text-white"
                                        value={formData.classId}
                                        onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
                                        required
                                    >
                                        <option value="">Pilih Kelas</option>
                                        {classes.map((cls) => (
                                            <option key={cls.id} value={cls.id}>{cls.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Nomor Telepon</label>
                                    <input
                                        type="text"
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-slate-900 dark:text-white"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        placeholder="08xxxxxxxxxx"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Alamat</label>
                                    <textarea
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-slate-900 dark:text-white resize-none"
                                        rows={2}
                                        value={formData.address}
                                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                        placeholder="Alamat lengkap"
                                    />
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
                                    ) : (editingMember ? 'Simpan Perubahan' : 'Tambah Anggota')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Import Modal */}
            {showImportModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowImportModal(false)}>
                    <div className="bg-surface-light dark:bg-surface-dark w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Import Data Anggota</h3>
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
                                                    {err.row > 0 && `Baris ${err.row}: `}NIS {err.nis} - {err.error}
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
                                    <li>Isi data sesuai kolom yang tersedia</li>
                                    <li>Pastikan nama kelas sesuai dengan data kelas yang ada</li>
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

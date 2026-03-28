import { useState, useEffect } from 'react';
import api from '../services/api';

interface Setting {
    value: string;
    description: string | null;
}

interface Settings {
    [key: string]: Setting;
}

export default function Settings() {
    const [settings, setSettings] = useState<Settings>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');
    const [message, setMessage] = useState('');

    const fetchSettings = async () => {
        try {
            const response = await api.get('/settings');
            setSettings(response.data);
        } catch (err) {
            console.error('Failed to fetch settings:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    const initializeSettings = async () => {
        try {
            await api.post('/settings/init');
            fetchSettings();
            setMessage('Pengaturan berhasil diinisialisasi');
        } catch (err) {
            console.error('Failed to initialize settings:', err);
        }
    };

    const handleSave = async (key: string) => {
        setSaving(true);
        try {
            await api.put(`/settings/${key}`, {
                value: editValue,
                description: settings[key]?.description,
            });
            setSettings(prev => ({
                ...prev,
                [key]: { ...prev[key], value: editValue },
            }));
            setEditingKey(null);
            setMessage('Pengaturan berhasil disimpan');
        } catch (err) {
            console.error('Failed to save setting:', err);
        } finally {
            setSaving(false);
        }
    };

    const settingLabels: { [key: string]: string } = {
        fine_rate_per_day: 'Denda Per Hari (Rp)',
        max_loan_days: 'Maksimal Hari Peminjaman',
        max_books_per_loan: 'Maksimal Buku Per Peminjaman',
        library_name: 'Nama Perpustakaan',
        library_address: 'Alamat Perpustakaan',
        notification_email: 'Email Notifikasi',
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white">Pengaturan Sistem</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Konfigurasi perpustakaan</p>
                </div>
                {Object.keys(settings).length === 0 && (
                    <button
                        onClick={initializeSettings}
                        className="flex items-center space-x-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl transition-all"
                    >
                        <span className="material-icons-round text-lg">refresh</span>
                        <span>Inisialisasi</span>
                    </button>
                )}
            </div>

            {message && (
                <div className="p-3 bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 text-sm rounded-lg flex items-center space-x-2">
                    <span className="material-icons-round text-lg">check_circle</span>
                    <span>{message}</span>
                </div>
            )}

            {/* Settings Cards */}
            <div className="grid gap-4">
                {Object.entries(settings).map(([key, setting]) => (
                    <div
                        key={key}
                        className="bg-surface-light dark:bg-surface-dark rounded-xl p-4 border border-slate-200 dark:border-slate-800"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex-1">
                                <h3 className="font-semibold text-slate-800 dark:text-white">
                                    {settingLabels[key] || key}
                                </h3>
                                {setting.description && (
                                    <p className="text-sm text-slate-500 dark:text-slate-400">{setting.description}</p>
                                )}
                            </div>
                            <div className="flex items-center space-x-3">
                                {editingKey === key ? (
                                    <>
                                        <input
                                            type="text"
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            className="w-40 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-slate-900 dark:text-white"
                                        />
                                        <button
                                            onClick={() => handleSave(key)}
                                            disabled={saving}
                                            className="p-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
                                        >
                                            <span className="material-icons-round text-lg">check</span>
                                        </button>
                                        <button
                                            onClick={() => setEditingKey(null)}
                                            className="p-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-lg transition-colors"
                                        >
                                            <span className="material-icons-round text-lg">close</span>
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <span className="text-lg font-semibold text-primary">{setting.value || '-'}</span>
                                        <button
                                            onClick={() => {
                                                setEditingKey(key);
                                                setEditValue(setting.value);
                                            }}
                                            className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg transition-colors"
                                        >
                                            <span className="material-icons-round text-lg">edit</span>
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {Object.keys(settings).length === 0 && (
                <div className="text-center py-12">
                    <span className="material-icons-round text-6xl text-slate-300 dark:text-slate-600">settings</span>
                    <p className="mt-4 text-slate-500 dark:text-slate-400">Belum ada pengaturan. Klik "Inisialisasi" untuk memulai.</p>
                </div>
            )}
        </div>
    );
}

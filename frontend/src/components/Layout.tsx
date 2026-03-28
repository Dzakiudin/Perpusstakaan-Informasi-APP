import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../App';
import { useState, useEffect } from 'react';

interface LayoutProps {
    children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
    const { user, logout } = useAuth();
    const location = useLocation();
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

    useEffect(() => {
        // Check for saved theme
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            setIsDarkMode(true);
            document.documentElement.classList.add('dark');
        } else {
            setIsDarkMode(false);
            document.documentElement.classList.remove('dark');
        }
    }, []);

    // Close mobile sidebar on route change
    useEffect(() => {
        setIsMobileSidebarOpen(false);
    }, [location.pathname]);

    const toggleDarkMode = () => {
        const newMode = !isDarkMode;
        setIsDarkMode(newMode);
        if (newMode) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    };

    const getPageTitle = () => {
        switch (location.pathname) {
            case '/': return 'Dashboard';
            case '/books': return 'Data Buku';
            case '/members': return 'Data Anggota';
            case '/classes': return 'Data Kelas';
            case '/loans': return 'Peminjaman';
            case '/returns': return 'Pengembalian';
            case '/reservations': return 'Reservasi';
            case '/history': return 'Riwayat';
            case '/reports': return 'Laporan';
            case '/settings': return 'Pengaturan';
            case '/audit-logs': return 'Audit Log';
            case '/users': return 'Kelola User';
            default: return 'Perpustakaan';
        }
    };

    const getPageSubtitle = () => {
        switch (location.pathname) {
            case '/': return 'Ringkasan Sistem';
            case '/books': return 'Manajemen Koleksi';
            case '/members': return 'Daftar Anggota';
            case '/classes': return 'Manajemen Kelas';
            case '/loans': return 'Transaksi Peminjaman';
            case '/returns': return 'Transaksi Pengembalian';
            case '/reservations': return 'Antrian Reservasi';
            case '/history': return 'Riwayat Peminjaman';
            case '/reports': return 'Unduh Laporan';
            case '/settings': return 'Konfigurasi Sistem';
            case '/audit-logs': return 'Log Aktivitas';
            case '/users': return 'Manajemen Pengguna';
            default: return 'Sistem Manajemen';
        }
    };

    // Helper to determine if a menu should be locked
    const isLocked = (allowedRoles: string[]) => {
        if (!user) return true;
        return !allowedRoles.includes(user.role);
    };

    const NavItem = ({ to, icon, label, allowedRoles }: { to: string; icon: string; label: string; allowedRoles?: string[] }) => {
        const locked = allowedRoles ? isLocked(allowedRoles) : false;

        if (locked) {
            return (
                <div className="group relative flex items-center px-4 py-3 text-slate-600 bg-slate-800/20 rounded-lg cursor-not-allowed opacity-60">
                    <span className="material-icons-round text-xl mr-3">{icon}</span>
                    <span className="text-sm font-medium">{label}</span>
                    <span className="material-icons-round text-base absolute right-4 text-slate-500">lock</span>

                    {/* Tooltip */}
                    <div className="absolute left-0 top-full mt-1 w-full px-3 py-2 bg-slate-800 text-white text-center text-xs rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                        Akses tidak tersedia untuk role Anda
                    </div>
                </div>
            );
        }

        return (
            <NavLink
                to={to}
                className={({ isActive }) =>
                    isActive
                        ? "flex items-center px-4 py-3 bg-primary/10 text-primary rounded-lg transition-all"
                        : "flex items-center px-4 py-3 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all group"
                }
            >
                <span className="material-icons-round text-xl mr-3">{icon}</span>
                <span className="text-sm font-medium">{label}</span>
            </NavLink>
        );
    };

    // Sidebar Content Component
    const SidebarContent = () => (
        <>
            <div className="p-6 flex items-center space-x-3">
                <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
                    <span className="material-icons-round text-white">auto_stories</span>
                </div>
                <div>
                    <h1 className="font-bold text-lg leading-tight">Perpustakaan</h1>
                    <p className="text-xs text-slate-400">Sistem Manajemen</p>
                </div>
            </div>

            <nav className="mt-6 flex-1 px-4 space-y-1 overflow-y-auto no-scrollbar">
                <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Menu Utama</p>
                <NavItem to="/" icon="dashboard" label="Dashboard" />
                <NavItem to="/books" icon="book" label="Data Buku" allowedRoles={['admin', 'pustakawan']} />
                <NavItem to="/members" icon="group" label="Data Anggota" allowedRoles={['admin', 'pustakawan']} />
                <NavItem to="/classes" icon="school" label="Data Kelas" allowedRoles={['admin', 'pustakawan']} />

                <p className="px-2 pt-6 text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Transaksi</p>
                <NavItem to="/loans" icon="assignment_return" label="Peminjaman" />
                <NavItem to="/returns" icon="keyboard_return" label="Pengembalian" />

                <p className="px-2 pt-6 text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Riwayat & Laporan</p>
                <NavItem to="/history" icon="history" label="Riwayat" />
                <NavItem to="/reports" icon="summarize" label="Unduh Laporan" />

                <p className="px-2 pt-6 text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Pengaturan</p>
                <NavItem to="/settings" icon="settings" label="Pengaturan" allowedRoles={['admin', 'pustakawan']} />
                <NavItem to="/users" icon="people_alt" label="Kelola User" allowedRoles={['admin']} />
                <NavItem to="/audit-logs" icon="receipt_long" label="Audit Log" allowedRoles={['admin']} />
            </nav>

            <div className="p-4 mt-auto">
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                    <div className="flex items-center space-x-3 mb-3">
                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-xs font-bold uppercase">
                            {user?.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-xs font-semibold truncate">{user?.name}</p>
                            <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
                        </div>
                    </div>
                    <button
                        onClick={logout}
                        className="w-full flex items-center justify-center space-x-2 py-2 text-xs font-semibold bg-slate-700 hover:bg-red-500/20 hover:text-red-400 rounded-lg transition-colors"
                    >
                        <span className="material-icons-round text-sm">logout</span>
                        <span>Logout</span>
                    </button>
                </div>
            </div>
        </>
    );

    return (
        <div className="flex min-h-screen bg-background-light dark:bg-background-dark text-slate-800 dark:text-slate-200 transition-colors duration-200 font-display">
            {/* Desktop Sidebar */}
            <aside className="w-64 bg-sidebar-dark text-white hidden md:flex flex-col flex-shrink-0 transition-all duration-300">
                <SidebarContent />
            </aside>

            {/* Mobile Sidebar Overlay */}
            {isMobileSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/60 z-40 md:hidden transition-opacity duration-300"
                    onClick={() => setIsMobileSidebarOpen(false)}
                />
            )}

            {/* Mobile Sidebar */}
            <aside className={`fixed inset-y-0 left-0 w-72 bg-sidebar-dark text-white flex flex-col z-50 transform transition-transform duration-300 ease-in-out md:hidden ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                {/* Close Button for Mobile */}
                <button
                    onClick={() => setIsMobileSidebarOpen(false)}
                    className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white transition-colors"
                >
                    <span className="material-icons-round">close</span>
                </button>
                <SidebarContent />
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-screen overflow-hidden">
                <header className="h-16 flex items-center justify-between px-4 md:px-8 bg-surface-light dark:bg-surface-dark border-b border-slate-200 dark:border-slate-800 transition-colors">
                    <div className="flex items-center space-x-2">
                        {/* Mobile Menu Button */}
                        <button
                            onClick={() => setIsMobileSidebarOpen(true)}
                            className="p-2 mr-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors md:hidden"
                        >
                            <span className="material-icons-round">menu</span>
                        </button>
                        <h2 className="text-lg md:text-xl font-bold tracking-tight">{getPageTitle()}</h2>
                        <span className="text-slate-400 dark:text-slate-500 mx-1 md:mx-2 hidden sm:inline">/</span>
                        <span className="text-sm font-medium text-slate-500 dark:text-slate-400 hidden sm:inline">{getPageSubtitle()}</span>
                    </div>
                    <div className="flex items-center space-x-2 md:space-x-4">
                        <button
                            className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                            onClick={toggleDarkMode}
                        >
                            {isDarkMode ? (
                                <span className="material-icons-round text-xl">light_mode</span>
                            ) : (
                                <span className="material-icons-round text-xl">dark_mode</span>
                            )}
                        </button>
                        <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block"></div>
                        <div className="flex items-center space-x-3">
                            <span className="text-sm font-medium hidden lg:inline-block">{user?.role} Panel</span>
                            <div className="w-8 h-8 rounded-full ring-2 ring-primary/20 bg-primary/10 flex items-center justify-center text-primary font-bold">
                                {user?.name?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto no-scrollbar bg-background-light dark:bg-background-dark p-4 md:p-8">
                    {children}

                    {/* Copyright Footer */}
                    <footer className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700/50">
                        <div className="flex flex-col md:flex-row justify-between items-center text-xs text-slate-500 dark:text-slate-400">
                            <p>&copy; 2026 <span className="font-semibold text-slate-700 dark:text-slate-300">Ahmad Dzakiudin</span>. All Rights Reserved.</p>
                            <div className="flex items-center space-x-4 mt-2 md:mt-0">
                                <span>Version 1.0.0</span>
                                <span className="hidden md:inline">&bull;</span>
                                <a href="mailto:dzakiudin07@gmail.com" className="hover:text-primary transition-colors">Support</a>
                            </div>
                        </div>
                    </footer>
                </div>
            </main>
        </div>
    );
}

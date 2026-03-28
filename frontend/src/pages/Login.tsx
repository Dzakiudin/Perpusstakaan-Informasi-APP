import { useState, useEffect } from 'react';
import { useAuth } from '../App';
import api from '../services/api';

export default function Login() {
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setIsLoaded(true), 100);
        return () => clearTimeout(timer);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await api.post('/auth/login', { email, password });
            login(response.data.token, response.data.user);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Login gagal. Periksa email dan password.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#06090E] text-cream">
            {/* Ambient Background with Generated Image or Fallback */}
            <div
                className="absolute inset-0 opacity-40 bg-cover bg-center bg-no-repeat transition-transform duration-[10000ms] scale-110"
                style={{
                    backgroundImage: `linear-gradient(to right, rgba(6, 9, 14, 1) 0%, rgba(6, 9, 14, 0.4) 50%, rgba(6, 9, 14, 1) 100%), url('https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&q=80&w=2000')`,
                    transform: isLoaded ? 'scale(1)' : 'scale(1.1)'
                }}
            />

            {/* Scholarly "Dust" Particles (CSS only) */}
            <div className="absolute inset-0 pointer-events-none opacity-20 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]" />

            {/* Login Container */}
            <div className={`relative z-10 w-full max-w-xl px-4 transition-all duration-1000 delay-300 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                <div className="bg-surface-dark/40 backdrop-blur-xl border border-white/5 rounded-2xl p-10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] relative overflow-hidden">

                    {/* Decorative Top Border (Gold) */}
                    <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-right from-transparent via-accent-gold/50 to-transparent" />

                    {/* Branding Section */}
                    <div className="text-center mb-12">
                        <div className="inline-block relative mb-6">
                            <div className="absolute inset-0 bg-accent-gold/20 blur-2xl rounded-full" />
                            <span className="material-icons-round text-accent-gold text-5xl relative">menu_book</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-serif font-bold text-cream tracking-tight mb-2">
                            Library <span className="text-accent-gold italic">System</span>
                        </h1>
                        <p className="font-sans text-slate-300 uppercase tracking-[0.2em] text-[10px] font-semibold">
                            Archive Management Systems // Est. 2026
                        </p>
                    </div>

                    {/* Error Alert */}
                    {error && (
                        <div
                            data-testid="login-error"
                            className="mb-8 p-4 bg-red-950/40 border border-red-500/20 text-red-400 rounded-lg text-sm flex items-center shadow-xl animate-shake"
                        >
                            <span className="material-icons-round text-lg mr-3">gpp_bad</span>
                            {error}
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-8">
                        {/* Email Field with Scholarly Label */}
                        <div className="group space-y-2">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1 transition-colors group-focus-within:text-accent-gold" htmlFor="email">
                                Identification (Email)
                            </label>
                            <input
                                className="block w-full px-5 py-4 bg-black/40 border border-white/10 rounded-xl text-cream placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-accent-gold/40 focus:border-accent-gold/60 transition-all duration-300"
                                id="email"
                                name="email"
                                placeholder="Enter your credentials"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>

                        {/* Password Field */}
                        <div className="group space-y-2">
                            <div className="flex justify-between items-center px-1">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest transition-colors group-focus-within:text-accent-gold" htmlFor="password">
                                    Cipher (Password)
                                </label>
                                <a href="#" className="text-[10px] text-slate-400 hover:text-accent-gold transition-colors font-bold uppercase tracking-tighter">Lost Cipher?</a>
                            </div>
                            <div className="relative">
                                <input
                                    className="block w-full px-5 py-4 bg-black/40 border border-white/10 rounded-xl text-cream placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-accent-gold/40 focus:border-accent-gold/60 transition-all duration-300"
                                    id="password"
                                    name="password"
                                    placeholder="••••••••"
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-accent-gold transition-colors"
                                >
                                    <span className="material-icons-round text-lg">
                                        {showPassword ? 'visibility_off' : 'visibility'}
                                    </span>
                                </button>
                            </div>
                        </div>

                        {/* Remember Me */}
                        <div className="flex items-center px-1">
                            <label className="flex items-center cursor-pointer group select-none">
                                <input
                                    type="checkbox"
                                    className="h-4 w-4 bg-black/30 border-white/10 rounded text-accent-gold focus:ring-1 focus:ring-accent-gold focus:ring-offset-black cursor-pointer"
                                />
                                <span className="ml-3 text-xs text-slate-400 group-hover:text-slate-200 transition-colors">Maintain active session</span>
                            </label>
                        </div>

                        {/* Login Button - Luxury Variant */}
                        <div className="pt-4">
                            <button
                                type="submit"
                                disabled={loading}
                                className="relative w-full overflow-hidden group py-4 px-6 rounded-xl transition-all duration-500 active:scale-[0.98]"
                            >
                                <div className="absolute inset-0 bg-primary bg-gradient-to-right from-primary to-[#061A14] group-hover:scale-105 transition-transform duration-500" />
                                <div className="absolute inset-0 border border-white/10 rounded-xl" />
                                <span className="relative font-serif text-lg font-bold text-cream flex items-center justify-center gap-3">
                                    {loading ? (
                                        <span className="animate-spin material-icons-round">refresh</span>
                                    ) : (
                                        <>Access Archive <span className="material-icons-round text-xl group-hover:translate-x-1 transition-transform">arrow_forward</span></>
                                    )}
                                </span>
                            </button>
                        </div>
                    </form>

                    {/* Quick Access Grid - Refined */}
                    <div className="mt-12 pt-8 border-t border-white/5">
                        <div className="flex items-center justify-center gap-4 mb-6">
                            <div className="h-[1px] w-8 bg-white/10" />
                            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">Quick Portal</span>
                            <div className="h-[1px] w-8 bg-white/10" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => { setEmail('admin@perpus.com'); setPassword('admin123'); }}
                                className="flex flex-col items-center gap-2 p-4 bg-black/30 border border-white/10 rounded-xl hover:bg-accent-gold/10 hover:border-accent-gold/30 transition-all group"
                            >
                                <span className="material-icons-round text-slate-400 group-hover:text-accent-gold transition-colors">admin_panel_settings</span>
                                <span className="text-[10px] font-bold text-slate-400 group-hover:text-cream">Master Admin</span>
                            </button>
                            <button
                                onClick={() => { setEmail('pustakawan@perpus.com'); setPassword('pustakawan123'); }}
                                className="flex flex-col items-center gap-2 p-4 bg-black/30 border border-white/10 rounded-xl hover:bg-accent-gold/10 hover:border-accent-gold/30 transition-all group"
                            >
                                <span className="material-icons-round text-slate-400 group-hover:text-accent-gold transition-colors">local_library</span>
                                <span className="text-[10px] font-bold text-slate-400 group-hover:text-cream">Staff Librarian</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Copyright Notice */}
                <p className="mt-8 text-center text-[10px] text-slate-400 uppercase tracking-widest opacity-80">
                    &copy; 2026 Archive Management &bull; Security Protocol 8.2a
                </p>
            </div>
        </div>
    );
}

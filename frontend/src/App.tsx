import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect, createContext, useContext } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Books from './pages/Books';
import Members from './pages/Members';
import Loans from './pages/Loans';
import Returns from './pages/Returns';
import Classes from './pages/Classes';
import History from './pages/History';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import AuditLogs from './pages/AuditLogs';
import Users from './pages/Users';
import Layout from './components/Layout';
import RoleBasedRoute from './components/RoleBasedRoute';

// Auth Context
interface User {
    id: number;
    name: string;
    email: string;
    role: string;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (token: string, user: User) => void;
    logout: () => void;
}

export const AuthContext = createContext<AuthContextType>({
    user: null,
    token: null,
    login: () => { },
    logout: () => { },
});

export const useAuth = () => useContext(AuthContext);

function App() {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check for saved auth
        const savedToken = localStorage.getItem('token');
        const savedUser = localStorage.getItem('user');

        if (savedToken && savedUser) {
            setToken(savedToken);
            setUser(JSON.parse(savedUser));
        }
        setLoading(false);
    }, []);

    const login = (newToken: string, newUser: User) => {
        setToken(newToken);
        setUser(newUser);
        localStorage.setItem('token', newToken);
        localStorage.setItem('user', JSON.stringify(newUser));
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <AuthContext.Provider value={{ user, token, login, logout }}>
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <Routes>
                    <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
                    <Route
                        path="/*"
                        element={
                            user ? (
                                <Layout>
                                    <Routes>
                                        {/* Public / Common Routes (All Roles: Admin, Pustakawan, Guru, Siswa) */}
                                        <Route path="/" element={<Dashboard />} />
                                        <Route path="/loans" element={<Loans />} />
                                        <Route path="/returns" element={<Returns />} />
                                        <Route path="/history" element={<History />} />
                                        <Route path="/reports" element={<Reports />} />

                                        {/* Staff Routes (Admin & Pustakawan Only) */}
                                        <Route element={<RoleBasedRoute allowedRoles={['admin', 'pustakawan']} />}>
                                            <Route path="/books" element={<Books />} />
                                            <Route path="/members" element={<Members />} />
                                            <Route path="/classes" element={<Classes />} />
                                            <Route path="/settings" element={<Settings />} />
                                        </Route>

                                        {/* Admin Only Routes */}
                                        <Route element={<RoleBasedRoute allowedRoles={['admin']} />}>
                                            <Route path="/audit-logs" element={<AuditLogs />} />
                                            <Route path="/users" element={<Users />} />
                                        </Route>
                                    </Routes>
                                </Layout>
                            ) : (
                                <Navigate to="/login" />
                            )
                        }
                    />
                </Routes>
            </BrowserRouter>
        </AuthContext.Provider>
    );
}

export default App;

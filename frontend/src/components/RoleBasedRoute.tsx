import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../App';

interface RoleBasedRouteProps {
    allowedRoles: string[];
}

const RoleBasedRoute = ({ allowedRoles }: RoleBasedRouteProps) => {
    const { user } = useAuth();

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (!allowedRoles.includes(user.role)) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-full mb-4">
                    <span className="material-icons-round text-4xl text-red-500">gpp_bad</span>
                </div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Akses Ditolak</h2>
                <p className="text-slate-600 dark:text-slate-400 max-w-md">
                    Anda tidak memiliki izin untuk mengakses halaman ini.
                    Silakan hubungi administrator jika Anda merasa ini adalah kesalahan.
                </p>
            </div>
        );
    }

    return <Outlet />;
};

export default RoleBasedRoute;

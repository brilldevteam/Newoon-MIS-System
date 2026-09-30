import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { defaultRouteForUser, hasAnyRole } from '../utils/access-control';

export function RequireRoles({ roles }: { roles: string[] }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <p className="p-6 text-sm text-slate-500">Checking access...</p>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!hasAnyRole(user, roles)) {
    return <Navigate to="/access-denied" replace />;
  }

  return <Outlet />;
}

export function RequireAccess({ area, write = false, fallbackRoles }: { area: string; write?: boolean; fallbackRoles: string[] }) {
  const { user, loading } = useAuth();

  if (loading) return <p className="p-6 text-sm text-slate-500">Checking access...</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.roles.includes('SUPER_ADMIN')) return <Outlet />;

  const allowed = user.accessControlConfigured
    ? user.permissions?.includes(write ? `${area}.edit` : `${area}.view`)
    : hasAnyRole(user, fallbackRoles);
  return allowed ? <Outlet /> : <Navigate to="/access-denied" replace />;
}

export function HomeRedirect() {
  const { user, loading } = useAuth();

  if (loading) {
    return <p className="p-6 text-sm text-slate-500">Loading workspace...</p>;
  }

  return <Navigate to={defaultRouteForUser(user)} replace />;
}

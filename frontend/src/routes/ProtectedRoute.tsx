import { Navigate, Outlet } from 'react-router-dom';

export function ProtectedRoute() {
  const token = localStorage.getItem('newoon_token');
  return token ? <Outlet /> : <Navigate to="/login" replace />;
}

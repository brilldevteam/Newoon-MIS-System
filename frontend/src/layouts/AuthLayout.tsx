import { Outlet } from 'react-router-dom';

export function AuthLayout() {
  return (
    <main className="min-h-screen bg-[#eef0f4] text-slate-950">
      <Outlet />
    </main>
  );
}

import {
  Building2,
  ClipboardCheck,
  LayoutDashboard,
  Layers,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  UserCircle,
  UserRoundPlus,
  Users
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/clients', label: 'Clients', icon: UserRoundPlus },
  { to: '/kyc-workflow', label: 'KYC Workflow', icon: ClipboardCheck },
  { to: '/aml', label: 'AML Dashboard', icon: ShieldCheck },
  { to: '/tenants', label: 'Tenants', icon: Building2 },
  { to: '/modules', label: 'Modules', icon: Layers },
  { to: '/users', label: 'Users', icon: Users }
];

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isFocusedWorkspace = /^\/kyc\/[^/]+\/form$/.test(location.pathname);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const useCollapsedSidebar = isFocusedWorkspace && isSidebarCollapsed;
  const fullName = user ? `${user.firstName} ${user.lastName}`.trim() : '';

  useEffect(() => {
    setIsSidebarCollapsed(isFocusedWorkspace);
  }, [isFocusedWorkspace]);

  function logout() {
    localStorage.removeItem('newoon_token');
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <aside
        className={`fixed inset-y-0 left-0 hidden border-r border-slate-200 bg-white transition-all duration-200 lg:block ${
          useCollapsedSidebar ? 'w-20' : 'w-64'
        }`}
      >
        <div className={`flex h-[85px] items-center border-b border-slate-200 ${useCollapsedSidebar ? 'justify-center px-3' : 'justify-between px-6'}`}>
          <div className={useCollapsedSidebar ? 'hidden' : 'min-w-0'}>
            <p className="text-lg font-semibold text-slate-950">Newoon MIS</p>
            <p className="text-sm text-slate-500">KYC & Engagement Platform</p>
          </div>
          {useCollapsedSidebar && <p className="text-lg font-semibold text-slate-950">NM</p>}
          {isFocusedWorkspace && (
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed((current) => !current)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
              aria-label={useCollapsedSidebar ? 'Expand sidebar' : 'Collapse sidebar'}
              title={useCollapsedSidebar ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {useCollapsedSidebar ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
          )}
        </div>
        <nav className={`space-y-1 py-4 ${useCollapsedSidebar ? 'px-3' : 'px-3'}`}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              title={useCollapsedSidebar ? item.label : undefined}
              className={({ isActive }) =>
                `flex items-center rounded-md py-2 text-sm font-medium ${
                  useCollapsedSidebar ? 'justify-center px-0' : 'gap-3 px-3'
                } ${
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'
                }`
              }
            >
              <item.icon className="h-4 w-4" />
              {!useCollapsedSidebar && item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className={useCollapsedSidebar ? 'lg:pl-20' : 'lg:pl-64'}>
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-8">
          <div>
            <p className="text-sm font-medium text-slate-500">SaaS-ready workspace</p>
            <p className="text-base font-semibold text-slate-950">Newoon Operations</p>
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <div className="hidden items-center gap-2 border-r border-slate-200 pr-3 sm:flex">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                  <UserCircle className="h-5 w-5" />
                </span>
                <div className="min-w-0 text-right">
                  <p className="truncate text-sm font-semibold text-slate-950">{fullName || user.email}</p>
                  <p className="truncate text-xs text-slate-500">{user.email}</p>
                </div>
              </div>
            ) : null}
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </header>
        <main className="px-4 py-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

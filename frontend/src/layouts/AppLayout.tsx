import {
  Building2,
  Bell,
  CheckCheck,
  ClipboardCheck,
  Inbox,
  LayoutDashboard,
  Layers,
  ListChecks,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  SearchCheck,
  SlidersHorizontal,
  ShieldCheck,
  UserCircle,
  UserRoundPlus,
  Users
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { AppNotification, getNotifications, markAllNotificationsRead, markNotificationRead } from '../services/kyc-workflow.service';
import { hasAnyRole, roleList, workflowRoles } from '../utils/access-control';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: [] },
  { to: '/enquiries', label: 'Enquiries', icon: Inbox, roles: workflowRoles.enquiries, area: 'enquiries' },
  { to: '/clients', label: 'Clients', icon: UserRoundPlus, roles: workflowRoles.clientIntake, area: 'clients' },
  { to: '/kyc-workflow', label: 'KYC Workflow', icon: ClipboardCheck, roles: [...workflowRoles.caseCreation, ...workflowRoles.kycPreparation, ...workflowRoles.reviewTasks], area: 'kyc' },
  { to: '/screening', label: 'Screening', icon: SearchCheck, roles: workflowRoles.screening, area: 'screening' },
  { to: '/crrf', label: 'CRRF', icon: ShieldCheck, roles: workflowRoles.crrf, area: 'crrf' },
  { to: '/review-tasks', label: 'My Review Tasks', icon: ListChecks, roles: workflowRoles.reviewTasks, area: 'approvals' },
  { to: '/tenants', label: 'Tenants', icon: Building2, roles: workflowRoles.admin, area: 'administration' },
  { to: '/modules', label: 'Modules', icon: Layers, roles: workflowRoles.admin, area: 'administration' },
  { to: '/users', label: 'Users', icon: Users, roles: workflowRoles.userAdmin, area: 'administration' },
  { to: '/access-control', label: 'Access Control', icon: SlidersHorizontal, roles: workflowRoles.admin }
];

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isFocusedWorkspace = /^\/kyc\/[^/]+\/form$/.test(location.pathname);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const [notificationsError, setNotificationsError] = useState('');
  const useCollapsedSidebar = isFocusedWorkspace && isSidebarCollapsed;
  const fullName = user ? `${user.firstName} ${user.lastName}`.trim() : '';
  const unreadCount = notifications.filter((notification) => !notification.isRead).length;

  useEffect(() => {
    setIsSidebarCollapsed(isFocusedWorkspace);
  }, [isFocusedWorkspace]);

  useEffect(() => {
    setNotificationsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!notificationsOpen) return;

    function closeOnOutsidePointerDown(event: PointerEvent) {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    }

    document.addEventListener('pointerdown', closeOnOutsidePointerDown);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointerDown);
  }, [notificationsOpen]);

  useEffect(() => {
    if (!user) return;

    let isActive = true;

    async function loadNotifications() {
      try {
        const nextNotifications = await getNotifications();
        if (!isActive) return;
        setNotifications(nextNotifications);
        setNotificationsError('');
      } catch {
        if (!isActive) return;
        setNotificationsError('Unable to load notifications');
      }
    }

    loadNotifications();
    const intervalId = window.setInterval(loadNotifications, 30000);

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
    };
  }, [user, location.pathname]);

  function logout() {
    localStorage.removeItem('newoon_token');
    navigate('/login', { replace: true });
  }

  async function markRead(notification: AppNotification) {
    if (!notification.isRead) {
      setNotifications((current) => current.map((item) => (item.id === notification.id ? { ...item, isRead: true } : item)));
      try {
        await markNotificationRead(notification.id);
      } catch {
        setNotificationsError('Unable to update notification');
      }
    }
  }

  async function markAllRead() {
    setNotifications((current) => current.map((notification) => ({ ...notification, isRead: true })));
    try {
      const nextNotifications = await markAllNotificationsRead();
      setNotifications(nextNotifications);
      setNotificationsError('');
    } catch {
      setNotificationsError('Unable to update notifications');
    }
  }

  return (
    <div className="min-h-screen bg-[#eef3f8]">
      <aside
        className={`fixed inset-y-0 left-0 hidden border-r border-slate-200/80 bg-white/95 shadow-sm transition-all duration-200 lg:block ${
          useCollapsedSidebar ? 'w-20' : 'w-64'
        }`}
      >
        <div className={`flex h-[85px] items-center border-b border-slate-200/80 ${useCollapsedSidebar ? 'justify-center px-3' : 'justify-between px-6'}`}>
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
          {navItems.filter((item) => canAccessNavigation(user, item.roles, item.area)).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              title={useCollapsedSidebar ? item.label : undefined}
              className={({ isActive }) =>
                `flex items-center rounded-xl py-2.5 text-sm font-medium transition ${
                  useCollapsedSidebar ? 'justify-center px-0' : 'gap-3 px-3'
                } ${
                  isActive ? 'bg-brand-50 text-brand-700 shadow-sm shadow-brand-100/50' : 'text-slate-600 hover:bg-slate-50'
                }`
              }
            >
              <item.icon className="h-4 w-4" />
              {!useCollapsedSidebar && item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className={useCollapsedSidebar ? 'min-w-0 lg:pl-20' : 'min-w-0 lg:pl-64'}>
        <header className="sticky top-0 z-10 flex h-16 min-w-0 items-center justify-between gap-3 border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur lg:px-8">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-slate-950">Newoon Operations</p>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {user ? (
              <div ref={notificationsRef} className="relative">
                <button
                  type="button"
                  onClick={() => setNotificationsOpen((current) => !current)}
                  className="relative inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50"
                  aria-label="Notifications"
                  title="Notifications"
                >
                  <Bell className="h-4 w-4" />
                  {unreadCount ? (
                    <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  ) : null}
                </button>
                {notificationsOpen ? (
                  <div className="absolute right-0 top-12 z-30 w-[min(420px,calc(100vw-2rem))] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                    <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">Notifications</p>
                        <p className="text-xs text-slate-500">{unreadCount} unread</p>
                      </div>
                      <button
                        type="button"
                        onClick={markAllRead}
                        disabled={!unreadCount}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <CheckCheck className="h-3.5 w-3.5" />
                        Mark all read
                      </button>
                    </div>
                    {notificationsError ? <p className="border-b border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700">{notificationsError}</p> : null}
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.length ? (
                        notifications.map((notification) => (
                          <Link
                            key={notification.id}
                            to={notificationLink(notification)}
                            onClick={() => markRead(notification)}
                            className={`block border-b border-slate-100 px-4 py-3 last:border-b-0 hover:bg-slate-50 ${
                              notification.isRead ? 'bg-white' : 'bg-brand-50/50'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <span
                                className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                                  notification.isRead ? 'bg-slate-300' : 'bg-brand-600'
                                }`}
                              />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-950">{notification.title}</p>
                                <p className="line-clamp-2 text-sm text-slate-500">{notification.message}</p>
                                <p className="mt-1 text-xs text-slate-400">{formatNotificationDate(notification.createdAt)}</p>
                              </div>
                            </div>
                          </Link>
                        ))
                      ) : (
                        <p className="px-4 py-6 text-sm text-slate-500">No notifications yet.</p>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
            {user ? (
              <div className="hidden items-center gap-2 border-r border-slate-200 pr-3 sm:flex">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                  <UserCircle className="h-5 w-5" />
                </span>
                <div className="min-w-0 text-right">
                  <p className="truncate text-sm font-semibold text-slate-950">{fullName || user.email}</p>
                  <p className="truncate text-xs text-slate-500">{roleList(user)}</p>
                </div>
              </div>
            ) : null}
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>
        <main className="min-w-0 px-4 py-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function canAccessNavigation(user: ReturnType<typeof useAuth>['user'], roles: string[], area?: string) {
  if (!user) return false;
  if (user.roles.includes('SUPER_ADMIN')) return true;
  if (area && user.accessControlConfigured) return Boolean(user.permissions?.includes(`${area}.view`));
  return !roles.length || hasAnyRole(user, roles);
}

function notificationLink(notification: AppNotification) {
  const caseId = notification.kycCase?.id;
  if (notification.enquiry?.id) return `/enquiries/${notification.enquiry.id}`;
  if (!caseId) {
    return ['GENERAL', 'AML_CASE_SUBMITTED', 'ADDITIONAL_INFORMATION_REQUESTED'].includes(notification.type) ? '/enquiries' : '/review-tasks';
  }

  if (
    [
      'DMLRO_TASK_ASSIGNED',
      'MLRO_TASK_ASSIGNED',
      'SEF_TASK_ASSIGNED',
      'DMLRO_REVIEW_COMPLETED',
      'MLRO_APPROVAL_COMPLETED',
      'MLRO_APPROVAL_WITH_CONDITIONS',
      'MLRO_REJECTION'
    ].includes(notification.type)
  ) {
    return `/kyc/${caseId}`;
  }

  if (['AML_CASE_SUBMITTED', 'SUPERVISOR_TASK_ASSIGNED', 'ADDITIONAL_INFORMATION_REQUESTED'].includes(notification.type)) {
    return `/kyc/${caseId}`;
  }

  return `/kyc/${caseId}`;
}

function formatNotificationDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

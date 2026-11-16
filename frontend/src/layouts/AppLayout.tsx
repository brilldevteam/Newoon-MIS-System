import {
  Building2,
  Bell,
  CheckCheck,
  ChevronDown,
  ClipboardCheck,
  Inbox,
  LayoutDashboard,
  Layers,
  ListChecks,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  SearchCheck,
  SlidersHorizontal,
  ShieldCheck,
  ShieldEllipsis,
  UserCheck,
  Users,
  WifiOff,
  X
} from 'lucide-react';
import { ComponentType, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { AccountMenu } from '../components/AccountMenu';
import { InstallAppButton } from '../components/InstallAppButton';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { AppNotification, getNotifications, markAllNotificationsRead, markNotificationRead } from '../services/kyc-workflow.service';
import { hasAnyRole, roleList, workflowRoles } from '../utils/access-control';
import { enquiryNotificationLink } from '../utils/enquiry-notification-link';

type NavLinkItem = { to: string; label: string; icon: ComponentType<{ className?: string }>; roles: string[]; area?: string };
type NavGroupItem = { key: string; label: string; icon: ComponentType<{ className?: string }>; pathPrefix: string; children: NavLinkItem[] };
type NavItem = NavLinkItem | NavGroupItem;

const isNavGroup = (item: NavItem): item is NavGroupItem => 'children' in item;

const navItems: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: [] },
  { to: '/enquiries', label: 'Enquiries', icon: Inbox, roles: workflowRoles.enquiries, area: 'enquiries' },
  // Ordered as a client moves through the system: enquiry -> KYC (screening, CRRF, reviews) -> compliance.
  // Onboarded clients live under Compliance -> Compliance Clients (the separate Clients menu was removed).
  { to: '/kyc-workflow', label: 'KYC Workflow', icon: ClipboardCheck, roles: [...workflowRoles.caseCreation, ...workflowRoles.kycPreparation, ...workflowRoles.reviewTasks], area: 'kyc' },
  { to: '/screening', label: 'Screening', icon: SearchCheck, roles: workflowRoles.screening, area: 'screening' },
  { to: '/crrf', label: 'CRRF', icon: ShieldCheck, roles: workflowRoles.crrf, area: 'crrf' },
  { to: '/review-tasks', label: 'My Review Tasks', icon: ListChecks, roles: workflowRoles.reviewTasks, area: 'approvals' },
  // Compliance area (legacy "Compliance Hub"); later submenu items such as Compliance Staff belong here too.
  {
    key: 'compliance',
    label: 'Compliance',
    icon: ShieldEllipsis,
    pathPrefix: '/compliance',
    children: [{ to: '/compliance/clients', label: 'Compliance Clients', icon: UserCheck, roles: workflowRoles.complianceView, area: 'compliance' }]
  },
  // Platform-wide pages: Super Admin only, not controlled by the role matrix.
  { to: '/tenants', label: 'Tenants', icon: Building2, roles: workflowRoles.admin },
  { to: '/modules', label: 'Modules', icon: Layers, roles: workflowRoles.admin },
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
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const online = useOnlineStatus();
  const visibleNavItems = navItems
    .map((item) => (isNavGroup(item) ? { ...item, children: item.children.filter((child) => canAccessNavigation(user, child.roles, child.area)) } : item))
    .filter((item) => (isNavGroup(item) ? item.children.length > 0 : canAccessNavigation(user, item.roles, item.area)));

  // A group opens automatically while one of its pages is shown.
  useEffect(() => {
    const active = navItems.find((item) => isNavGroup(item) && location.pathname.startsWith(`${item.pathPrefix}/`));
    if (active && isNavGroup(active)) setOpenGroups((current) => (current[active.key] ? current : { ...current, [active.key]: true }));
  }, [location.pathname]);

  useEffect(() => {
    setIsSidebarCollapsed(isFocusedWorkspace);
  }, [isFocusedWorkspace]);

  useEffect(() => {
    setNotificationsOpen(false);
    setMobileNavOpen(false);
  }, [location.pathname]);

  // Mobile drawer: close with Escape and keep the page behind it from scrolling.
  useEffect(() => {
    if (!mobileNavOpen) return;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setMobileNavOpen(false); };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', escape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', escape);
    };
  }, [mobileNavOpen]);

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
        <div className={`flex h-[85px] items-center border-b border-slate-200/80 ${useCollapsedSidebar ? 'flex-col justify-center gap-1 px-3' : 'justify-between gap-3 px-5'}`}>
          <Link to="/" className={useCollapsedSidebar ? 'hidden' : 'flex min-w-0 flex-col'} aria-label="Newoon MIS home">
            <img src="/brand/newoon-logo.png" alt="Newoon Global LTD." className="h-14 w-auto self-start" width={125} height={56} />
            <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">MIS · KYC & Engagement</span>
          </Link>
          {useCollapsedSidebar && (
            <Link to="/" aria-label="Newoon MIS home" title="Newoon MIS">
              <img src="/brand/newoon-mark.png" alt="Newoon" className="h-7 w-7 rounded" width={28} height={28} />
            </Link>
          )}
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
        <nav className="space-y-1 px-3 py-4" aria-label="Main navigation">
          <NavItems items={visibleNavItems} collapsed={useCollapsedSidebar} openGroups={openGroups} setOpenGroups={setOpenGroups} pathname={location.pathname} />
        </nav>
      </aside>

      {mobileNavOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Main menu">
          <button type="button" aria-label="Close menu" onClick={() => setMobileNavOpen(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]" />
          <div className="mobile-drawer absolute inset-y-0 left-0 flex w-[min(20rem,86vw)] flex-col bg-white shadow-xl">
            <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4">
              <Link to="/" aria-label="Newoon MIS home" className="min-w-0">
                <img src="/brand/newoon-logo.png" alt="Newoon Global LTD." className="h-11 w-auto" width={98} height={44} />
              </Link>
              <button type="button" onClick={() => setMobileNavOpen(false)} aria-label="Close menu" className="grid h-10 w-10 place-items-center rounded-md text-slate-600 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="scrollbar-thin flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Main navigation">
              <NavItems items={visibleNavItems} collapsed={false} openGroups={openGroups} setOpenGroups={setOpenGroups} pathname={location.pathname} />
            </nav>
            <div className="shrink-0 space-y-2 border-t border-slate-200 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              {user ? (
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{fullName || user.email}</p>
                  <p className="truncate text-xs text-slate-500">{roleList(user)}</p>
                </div>
              ) : null}
              <InstallAppButton />
              <button type="button" onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-brand-700 hover:bg-brand-50">
                <LogOut className="h-4 w-4" />
                Log out
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className={useCollapsedSidebar ? 'min-w-0 lg:pl-20' : 'min-w-0 lg:pl-64'}>
        <header className="sticky top-0 z-10 flex h-16 min-w-0 items-center justify-between gap-3 border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur lg:px-8">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open menu"
              aria-expanded={mobileNavOpen}
              className="-ml-1 grid h-10 w-10 shrink-0 place-items-center rounded-md text-slate-700 hover:bg-slate-100 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link to="/" aria-label="Newoon MIS home" className="shrink-0 lg:hidden">
              <img src="/brand/newoon-mark.png" alt="" className="h-8 w-8 rounded" width={32} height={32} />
            </Link>
            <p className="truncate text-base font-semibold text-slate-950">
              <span className="lg:hidden">Newoon MIS</span>
              <span className="hidden lg:inline">Newoon Operations</span>
            </p>
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
                            to={enquiryNotificationLink(notification, user) || notificationLink(notification)}
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
            {user ? <AccountMenu name={fullName || user.email} role={roleList(user)} logout={logout} /> : null}
          </div>
        </header>
        {!online ? (
          <div role="status" className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 lg:px-8">
            <WifiOff className="h-4 w-4 shrink-0" />
            You are offline. Changes cannot be saved until the connection returns.
          </div>
        ) : null}
        <main className="min-w-0 px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-5 sm:pt-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

type GroupState = Record<string, boolean>;

// Navigation shared by the desktop sidebar and the mobile drawer.
function NavItems({ items, collapsed, openGroups, setOpenGroups, pathname }: {
  items: NavItem[];
  collapsed: boolean;
  openGroups: GroupState;
  setOpenGroups: (update: (current: GroupState) => GroupState) => void;
  pathname: string;
}) {
  return (
    <>
      {items.map((item) => {
        if (!isNavGroup(item)) return <SidebarLink key={item.to} item={item} collapsed={collapsed} />;
        // A collapsed sidebar has no room for a group header, so it shows the group's pages as icons.
        if (collapsed) return item.children.map((child) => <SidebarLink key={child.to} item={child} collapsed />);
        const open = Boolean(openGroups[item.key]);
        const groupActive = pathname.startsWith(`${item.pathPrefix}/`);
        return (
          <div key={item.key}>
            <button
              type="button"
              onClick={() => setOpenGroups((current) => ({ ...current, [item.key]: !open }))}
              aria-expanded={open}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                groupActive && !open ? 'bg-brand-50 text-brand-700' : groupActive ? 'text-brand-700 hover:bg-slate-50' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <item.icon className="h-4 w-4" />
              <span className="flex-1 text-left">{item.label}</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open ? (
              <div className="ml-5 mt-1 space-y-1 border-l border-slate-200 pl-3">
                {item.children.map((child) => <SidebarLink key={child.to} item={child} collapsed={false} />)}
              </div>
            ) : null}
          </div>
        );
      })}
    </>
  );
}

function SidebarLink({ item, collapsed }: { item: NavLinkItem; collapsed: boolean }) {
  return (
    <NavLink
      to={item.to}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        `flex items-center rounded-xl py-2.5 text-sm font-medium transition ${collapsed ? 'justify-center px-0' : 'gap-3 px-3'} ${
          isActive ? 'bg-brand-50 text-brand-700 shadow-sm shadow-brand-100/50' : 'text-slate-600 hover:bg-slate-50'
        }`
      }
    >
      <item.icon className="h-4 w-4" />
      {!collapsed && item.label}
    </NavLink>
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
  // Compliance client monitoring notifications open the matching tab of the client page.
  if (notification.client?.id) {
    const tab = {
      COMPLIANCE_SCREENING_ALERT: 'screening',
      COMPLIANCE_DOCUMENT_EXPIRING: 'expiry',
      COMPLIANCE_REVIEW_DUE: 'reviews',
      COMPLIANCE_RISK_CHANGE_REQUESTED: 'reviews',
      COMPLIANCE_RISK_CHANGE_DECIDED: 'reviews'
    }[notification.type];
    return `/compliance/clients/${notification.client.id}${tab ? `?tab=${tab}` : ''}`;
  }
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

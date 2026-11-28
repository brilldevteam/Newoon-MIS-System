import {
  Building2,
  Bell,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ClipboardCheck,
  Inbox,
  LayoutDashboard,
  LayoutGrid,
  Layers,
  ListChecks,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  SearchCheck,
  SlidersHorizontal,
  ShieldCheck,
  Sparkles,
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
import { QuickFind } from '../components/QuickFind';
import { DownloadToast } from '../components/DownloadToast';
import { InstallAppButton } from '../components/InstallAppButton';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { AppNotification, getNotifications, markAllNotificationsRead, markNotificationRead } from '../services/kyc-workflow.service';
import { hasAnyRole, roleList, workflowRoles } from '../utils/access-control';
import { enquiryNotificationLink } from '../utils/enquiry-notification-link';
import { navigationInWorkspace, workspaceForPath, workspaceModules } from '../utils/workspace-modules';

type NavLinkItem = { to: string; label: string; icon: ComponentType<{ className?: string }>; roles: string[]; area?: string; section: string };

const SECTIONS = ['Overview', 'Client onboarding', 'Compliance', 'Administration'];

const navItems: NavLinkItem[] = [
  { to: '/workspace', label: 'All Workspaces', icon: Layers, roles: [], section: 'Overview' },
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: [], section: 'Overview' },
  // Ordered as a client moves through the system: enquiry -> KYC (screening, CRRF, reviews) -> compliance.
  // Onboarded clients live under Compliance -> Compliance Clients (the separate Clients menu was removed).
  { to: '/enquiries', label: 'Enquiries', icon: Inbox, roles: workflowRoles.enquiries, area: 'enquiries', section: 'Client onboarding' },
  { to: '/kyc-workflow', label: 'KYC Workflow', icon: ClipboardCheck, roles: [...workflowRoles.caseCreation, ...workflowRoles.kycPreparation, ...workflowRoles.reviewTasks], area: 'kyc', section: 'Client onboarding' },
  { to: '/screening', label: 'Screening', icon: SearchCheck, roles: workflowRoles.screening, area: 'screening', section: 'Client onboarding' },
  { to: '/crrf', label: 'CRRF', icon: ShieldCheck, roles: workflowRoles.crrf, area: 'crrf', section: 'Client onboarding' },
  { to: '/review-tasks', label: 'My Review Tasks', icon: ListChecks, roles: workflowRoles.reviewTasks, area: 'approvals', section: 'Client onboarding' },
  // Compliance area (legacy "Compliance Hub"); later pages such as Compliance Staff belong here too.
  { to: '/compliance/clients', label: 'Compliance Clients', icon: UserCheck, roles: workflowRoles.complianceView, area: 'compliance', section: 'Compliance' },
  // Platform-wide pages: Super Admin only, not controlled by the role matrix.
  { to: '/tenants', label: 'Tenants', icon: Building2, roles: workflowRoles.admin, section: 'Administration' },
  { to: '/modules', label: 'Modules', icon: Layers, roles: workflowRoles.admin, section: 'Administration' },
  { to: '/users', label: 'Users', icon: Users, roles: workflowRoles.userAdmin, area: 'administration', section: 'Administration' },
  { to: '/settings/ai-document-reading', label: 'AI Document Reading', icon: Sparkles, roles: workflowRoles.userAdmin, area: 'administration', section: 'Administration' },
  { to: '/access-control', label: 'Access Control', icon: SlidersHorizontal, roles: workflowRoles.admin, section: 'Administration' }
];

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const isWorkspaceHome = location.pathname === '/workspace';
  const { user } = useAuth();
  const isFocusedWorkspace = /^\/kyc\/[^/]+\/(?:form|screening|crrf)$/.test(location.pathname) || /^\/enquiries\/(?:new|[^/]+\/edit)$/.test(location.pathname);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(isFocusedWorkspace);
  // Sections of the menu the user folded away (kept for next time).
  const [closedSections, setClosedSections] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem('newoon_nav_closed') || '{}'); } catch { return {}; }
  });
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const [notificationsError, setNotificationsError] = useState('');
  const useCollapsedSidebar = isSidebarCollapsed;
  const fullName = user ? `${user.firstName} ${user.lastName}`.trim() : '';
  const unreadCount = notifications.filter((notification) => !notification.isRead).length;
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const online = useOnlineStatus();
  const visibleNavItems = navItems
    .map((item) => item.to === '/dashboard'
      ? { ...item, to: workspaceModules.find((module) => module.id === workspaceForPath(location.pathname))?.to || item.to }
      : item)
    .filter((item) => navigationInWorkspace(location.pathname, item.to))
    .filter((item) => canAccessNavigation(user, item.roles, item.area));

  const activeSection = visibleNavItems.find((item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`))?.section;
  // The section of the page you are on is always open.
  useEffect(() => {
    if (activeSection) setClosedSections((current) => (current[activeSection] ? { ...current, [activeSection]: false } : current));
  }, [activeSection]);
  useEffect(() => {
    try { localStorage.setItem('newoon_nav_closed', JSON.stringify(closedSections)); } catch { /* the choice just is not remembered */ }
  }, [closedSections]);

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
      {!isWorkspaceHome && <aside
        className={`fixed inset-y-0 left-0 z-20 hidden bg-white transition-[width] duration-200 lg:flex lg:flex-col ${
          useCollapsedSidebar ? 'w-20' : 'w-64'
        }`}
      >
        <div className={`flex h-16 shrink-0 items-center border-b border-slate-200 ${useCollapsedSidebar ? 'justify-center px-3' : 'px-5'}`}>
          {useCollapsedSidebar ? (
            <Link to="/" aria-label="Newoon MIS home" title="Newoon MIS">
              <img src="/brand/newoon-mark.png" alt="Newoon" className="h-8 w-8 rounded" width={32} height={32} />
            </Link>
          ) : (
            <Link to="/" className="flex min-w-0 items-center" aria-label="Newoon MIS home">
              <img src="/brand/newoon-logo.png" alt="Newoon Global LTD." className="h-11 w-auto" width={98} height={44} />
            </Link>
          )}
        </div>
        <button
          type="button"
          onClick={() => setIsSidebarCollapsed((current) => !current)}
          className="absolute -right-3.5 top-[3.4rem] z-30 grid h-7 w-7 place-items-center rounded-full bg-brand-600 text-white shadow-md ring-2 ring-white hover:bg-brand-700 focus:outline-none focus-visible:ring-brand-300"
          aria-label={useCollapsedSidebar ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!useCollapsedSidebar}
          title={useCollapsedSidebar ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {useCollapsedSidebar ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
        <nav className="scrollbar-thin min-h-0 flex-1 overflow-y-auto border-r-2 border-brand-600/50 px-3 py-3" aria-label="Main navigation">
          <NavItems items={visibleNavItems} collapsed={useCollapsedSidebar} closedSections={closedSections} setClosedSections={setClosedSections} />
        </nav>
      </aside>}

      {!isWorkspaceHome && mobileNavOpen ? (
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
              <NavItems items={visibleNavItems} collapsed={false} closedSections={closedSections} setClosedSections={setClosedSections} />
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

      <div className={`min-w-0 transition-[padding] duration-200 ${isWorkspaceHome ? '' : useCollapsedSidebar ? 'lg:pl-20' : 'lg:pl-64'}`}>
        <header className="sticky top-0 z-10 flex h-16 min-w-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 lg:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {!isWorkspaceHome && <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open menu"
              aria-expanded={mobileNavOpen}
              className="-ml-1 grid h-10 w-10 shrink-0 place-items-center rounded-lg text-slate-700 hover:bg-slate-100 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>}
            <Link to="/" aria-label="Newoon MIS home" className={isWorkspaceHome ? 'shrink-0' : 'shrink-0 lg:hidden'}>
              <img src="/brand/newoon-mark.png" alt="" className="h-8 w-8 rounded" width={32} height={32} />
            </Link>
            <QuickFind items={visibleNavItems} />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 md:inline-flex" title="Current workspace">
              <Building2 aria-hidden="true" className="h-4 w-4 text-slate-500" />
              <span className="max-w-40 truncate">{workspaceModules.find((module) => module.id === workspaceForPath(location.pathname))?.label || 'Newoon Operations'}</span>
            </span>
            <Link to="/workspace" aria-label="All workspaces" title="All workspaces" aria-current={isWorkspaceHome ? 'page' : undefined} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600">
              <LayoutGrid className="h-4 w-4" />
            </Link>
            {user ? (
              <div ref={notificationsRef} className="relative">
                <button
                  type="button"
                  onClick={() => setNotificationsOpen((current) => !current)}
                  className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
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
        <DownloadToast />
      </div>
    </div>
  );
}

type ClosedSections = Record<string, boolean>;

// Navigation shared by the desktop sidebar and the mobile drawer: titled sections that fold open and shut.
function NavItems({ items, collapsed, closedSections, setClosedSections }: {
  items: NavLinkItem[];
  collapsed: boolean;
  closedSections: ClosedSections;
  setClosedSections: (update: (current: ClosedSections) => ClosedSections) => void;
}) {
  const sections = SECTIONS.map((title) => ({ title, links: items.filter((item) => item.section === title) })).filter((section) => section.links.length);
  return (
    <>
      {sections.map((section, index) => {
        const closed = Boolean(closedSections[section.title]);
        // A collapsed sidebar has no room for section titles, so sections are separated by a line.
        if (collapsed) {
          return (
            <div key={section.title} className={index ? 'mt-2 border-t border-slate-100 pt-2' : ''}>
              {section.links.map((item) => <SidebarLink key={item.to} item={item} collapsed />)}
            </div>
          );
        }
        return (
          <div key={section.title} className="mb-1">
            <button
              type="button"
              onClick={() => setClosedSections((current) => ({ ...current, [section.title]: !closed }))}
              aria-expanded={!closed}
              className="flex w-full items-center justify-between rounded-md px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-800"
            >
              {section.title}
              {closed ? <ChevronDown aria-hidden="true" className="h-4 w-4" /> : <ChevronUp aria-hidden="true" className="h-4 w-4" />}
            </button>
            {closed ? null : <div className="space-y-0.5">{section.links.map((item) => <SidebarLink key={item.to} item={item} collapsed={false} />)}</div>}
          </div>
        );
      })}
    </>
  );
}

function SidebarLink({ item, collapsed }: { item: NavLinkItem; collapsed: boolean }) {
  const dashboardOpen = useLocation().pathname.endsWith('/dashboard');
  return (
    <NavLink
      to={item.to}
      end={dashboardOpen}
      title={collapsed ? item.label : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        `flex h-10 items-center rounded-lg text-sm transition-colors ${collapsed ? 'justify-center px-0' : 'gap-3 px-3'} ${
          isActive ? 'bg-brand-50 font-semibold text-brand-700' : 'font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-950'
        }`
      }
    >
      <item.icon className="h-[18px] w-[18px] shrink-0" />
      {!collapsed && <span className="min-w-0 truncate">{item.label}</span>}
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
      COMPLIANCE_LEGAL_DOCUMENT_CHANGED: 'documents',
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

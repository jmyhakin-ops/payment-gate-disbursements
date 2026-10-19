import { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/auth.store';
import { api } from '../services/api';
import { cn } from '../lib/utils';
import {
  LayoutDashboard, CreditCard, CheckSquare, ShieldCheck, Wallet,
  Users, Building2, Settings, BarChart3, FileText, Bell, LogOut,
  ChevronDown, ChevronRight, User, Key, Zap, BadgeCheck, Building,
  Globe, Shield, BookOpen, Store, GitMerge, PanelLeftClose,
  PanelLeftOpen, Menu, X,
} from 'lucide-react';

interface NavItem {
  label: string;
  href?: string;
  icon: React.ElementType;
  roles?: string[];
  badge?: number;
  children?: NavItem[];
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

function getInitials(first?: string, last?: string) {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase();
}

/** Tooltip that appears on the right side of an icon when sidebar is collapsed */
function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  return (
    <div
      className="relative flex items-center"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div className="absolute left-full ml-3 z-50 whitespace-nowrap bg-slate-900 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg shadow-xl border border-slate-700 pointer-events-none">
          {label}
          <span className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 w-2 h-2 bg-slate-900 border-l border-b border-slate-700 rotate-45" />
        </div>
      )}
    </div>
  );
}

export function DashboardLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({});
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close profile dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Auto-expand parent menus matching current route
  useEffect(() => {
    navGroups.forEach(g => g.items.forEach(item => {
      if (item.children?.some(c => location.pathname.startsWith(c.href ?? ''))) {
        setExpandedMenus(prev => ({ ...prev, [item.label]: true }));
      }
    }));
  }, [location.pathname]);

  // Close mobile sidebar on navigation
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  const { data: pendingData } = useQuery({
    queryKey: ['pending-counts'],
    queryFn: () =>
      api.get('/payments/pending-approvals').then(r => ({
        checker: r.data.data?.checkerCount ?? 0,
        director: r.data.data?.directorCount ?? 0,
      })).catch(() => ({ checker: 0, director: 0 })),
    refetchInterval: 30000,
  });

  const { data: notifCount } = useQuery({
    queryKey: ['notif-count'],
    queryFn: () => api.get('/users/notifications?unreadOnly=true&limit=1').then(r => r.data.meta?.unreadCount ?? 0).catch(() => 0),
    refetchInterval: 60000,
  });

  const navGroups: NavGroup[] = [
    {
      group: 'Main',
      items: [
        { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        { label: 'Payments', href: '/payments', icon: CreditCard },
        { label: 'Wallets', href: '/wallets', icon: Wallet },
      ],
    },
    {
      group: 'Approvals',
      items: [
        {
          label: 'Checker Queue', href: '/approvals', icon: CheckSquare,
          roles: ['CHECKER', 'FINANCE', 'ORG_ADMIN', 'SUPER_ADMIN'],
          badge: pendingData?.checker,
        },
        {
          label: 'Director Sign-off', href: '/directors/approvals', icon: ShieldCheck,
          roles: ['DIRECTOR', 'ORG_ADMIN', 'SUPER_ADMIN'],
          badge: pendingData?.director,
        },
      ],
    },
    {
      group: 'People & Suppliers',
      items: [
        {
          label: 'Users', href: '/users', icon: Users,
          roles: ['ORG_ADMIN', 'SUPER_ADMIN', 'FINANCE'],
        },
        { label: 'Suppliers', href: '/suppliers', icon: Store },
      ],
    },
    {
      group: 'Organization',
      items: [
        {
          label: 'My Organization', icon: Building2,
          roles: ['ORG_ADMIN', 'FINANCE', 'DIRECTOR'],
          children: [
            { label: 'Profile & Rails', href: '/organization', icon: Building },
            { label: 'Directors', href: '/organization/directors', icon: BadgeCheck },
          ],
        },
        {
          label: 'All Organizations', href: '/organizations', icon: Globe,
          roles: ['SUPER_ADMIN'],
        },
      ],
    },
    {
      group: 'Analytics',
      items: [
        {
          label: 'Reports', icon: BarChart3,
          roles: ['ORG_ADMIN', 'SUPER_ADMIN', 'FINANCE'],
          children: [
            { label: 'Analytics', href: '/reports', icon: BarChart3 },
            { label: 'Reconciliation', href: '/reports/reconciliation', icon: GitMerge },
          ],
        },
        {
          label: 'Audit Trail', href: '/audit', icon: FileText,
          roles: ['ORG_ADMIN', 'SUPER_ADMIN', 'FINANCE'],
        },
      ],
    },
    {
      group: 'Configuration',
      items: [
        {
          label: 'Settings', icon: Settings,
          roles: ['ORG_ADMIN', 'SUPER_ADMIN'],
          children: [
            { label: 'General', href: '/settings', icon: Settings },
            { label: 'API Credentials', href: '/settings/api-credentials', icon: Key },
            { label: 'Activation', href: '/settings/activation', icon: Zap },
            { label: 'Bank Accounts', href: '/settings/bank-accounts', icon: BookOpen },
          ],
        },
      ],
    },
  ];

  const isVisible = (item: NavItem) => {
    if (!item.roles) return true;
    return !!user && item.roles.includes(user.role);
  };

  const toggleMenu = (label: string) =>
    setExpandedMenus(prev => ({ ...prev, [label]: !prev[label] }));

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // ── Sidebar content shared between mobile and desktop ──
  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo + collapse button */}
      <div className={cn(
        'h-16 flex items-center border-b border-slate-700/60 flex-shrink-0 transition-all duration-300',
        collapsed ? 'px-3 justify-center' : 'px-4 gap-3 justify-between'
      )}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
            <Wallet className="w-4 h-4 text-white" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="font-bold text-sm text-white leading-tight">KenyaPay</p>
              <p className="text-slate-400 text-xs">Payment Platform</p>
            </div>
          )}
        </div>
        {/* Desktop collapse toggle */}
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="hidden lg:flex p-1.5 rounded-lg hover:bg-slate-700/60 text-slate-400 hover:text-white transition-colors"
            title="Collapse sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Expand button when collapsed (at top of nav area) */}
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="hidden lg:flex mx-auto mt-3 p-2 rounded-lg hover:bg-slate-700/60 text-slate-400 hover:text-white transition-colors"
          title="Expand sidebar"
        >
          <PanelLeftOpen className="w-4 h-4" />
        </button>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 space-y-0.5">
        {navGroups.map(group => {
          const visibleItems = group.items.filter(isVisible);
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.group} className="px-2 mb-1">
              {/* Group label */}
              {!collapsed && (
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-3 py-2 mt-2">
                  {group.group}
                </p>
              )}
              {collapsed && <div className="my-2 border-t border-slate-700/40" />}

              {visibleItems.map(item => {
                const Icon = item.icon;
                const hasChildren = !!item.children?.length;
                const isExpanded = expandedMenus[item.label];
                const isActive = item.href
                  ? location.pathname === item.href || (item.href !== '/dashboard' && location.pathname.startsWith(item.href))
                  : item.children?.some(c => location.pathname.startsWith(c.href ?? ''));

                const baseBtn = cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                  collapsed ? 'justify-center' : '',
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/30'
                    : 'text-slate-300 hover:bg-slate-700/60 hover:text-white'
                );

                const iconEl = <Icon className="w-4 h-4 flex-shrink-0" />;

                return (
                  <div key={item.label}>
                    {collapsed ? (
                      // Collapsed → icon only with tooltip, no children support
                      <Tooltip label={item.label}>
                        {item.href ? (
                          <NavLink to={item.href} className={({ isActive: a }) => cn(
                            'relative flex items-center justify-center p-2.5 rounded-xl transition-all duration-150 w-full',
                            a ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/30' : 'text-slate-300 hover:bg-slate-700/60 hover:text-white'
                          )}>
                            {iconEl}
                            {!!item.badge && item.badge > 0 && (
                              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                            )}
                          </NavLink>
                        ) : (
                          <button onClick={() => { setCollapsed(false); toggleMenu(item.label); }} className={cn(baseBtn, 'relative')}>
                            {iconEl}
                            {isActive && <span className="absolute top-1 right-1 w-2 h-2 bg-indigo-300 rounded-full" />}
                          </button>
                        )}
                      </Tooltip>
                    ) : hasChildren ? (
                      // Expanded with children → accordion
                      <>
                        <button onClick={() => toggleMenu(item.label)} className={baseBtn}>
                          {iconEl}
                          <span className="flex-1 text-left">{item.label}</span>
                          <ChevronDown className={cn(
                            'w-3.5 h-3.5 text-slate-400 transition-transform duration-200',
                            isExpanded && 'rotate-180'
                          )} />
                        </button>

                        {/* Animated submenu */}
                        <div className={cn(
                          'overflow-hidden transition-all duration-200 ease-in-out',
                          isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                        )}>
                          <div className="ml-4 mt-1 mb-1 border-l-2 border-slate-700/50 pl-3 space-y-0.5">
                            {item.children!.map(child => (
                              <NavLink
                                key={child.href}
                                to={child.href!}
                                end
                                className={({ isActive: a }) => cn(
                                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
                                  a
                                    ? 'text-indigo-400 bg-indigo-900/30'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-700/40'
                                )}
                              >
                                <child.icon className="w-3.5 h-3.5 flex-shrink-0" />
                                <span>{child.label}</span>
                              </NavLink>
                            ))}
                          </div>
                        </div>
                      </>
                    ) : (
                      // Expanded simple link
                      <NavLink
                        to={item.href!}
                        className={({ isActive: a }) => cn(
                          'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 relative',
                          a
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/30'
                            : 'text-slate-300 hover:bg-slate-700/60 hover:text-white'
                        )}
                      >
                        {iconEl}
                        <span className="flex-1">{item.label}</span>
                        {!!item.badge && item.badge > 0 && (
                          <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                            {item.badge > 99 ? '99+' : item.badge}
                          </span>
                        )}
                      </NavLink>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* User footer */}
      <div className={cn(
        'border-t border-slate-700/60 p-3 flex-shrink-0',
        collapsed && 'flex justify-center'
      )} ref={profileRef}>
        {collapsed ? (
          <Tooltip label={`${user?.firstName} ${user?.lastName}`}>
            <NavLink to="/profile" className="block">
              <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white text-xs font-bold shadow">
                {getInitials(user?.firstName, user?.lastName)}
              </div>
            </NavLink>
          </Tooltip>
        ) : (
          <div className="relative">
            <button
              onClick={() => setProfileOpen(v => !v)}
              className="w-full flex items-center gap-3 rounded-xl hover:bg-slate-700/60 px-2 py-2 transition-colors group"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                {getInitials(user?.firstName, user?.lastName)}
              </div>
              <div className="flex-1 text-left overflow-hidden">
                <p className="text-sm font-semibold text-white truncate">{user?.firstName} {user?.lastName}</p>
                <p className="text-xs text-slate-400 truncate">{user?.role?.replace(/_/g, ' ')}</p>
              </div>
              <ChevronDown className={cn('w-3.5 h-3.5 text-slate-400 transition-transform', profileOpen && 'rotate-180')} />
            </button>

            {/* Profile Popover */}
            {profileOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-slate-700/60">
                  <p className="text-sm font-semibold text-white">{user?.firstName} {user?.lastName}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{user?.email}</p>
                </div>
                <NavLink
                  to="/profile"
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                  onClick={() => setProfileOpen(false)}
                >
                  <User className="w-4 h-4" /> My Profile
                </NavLink>
                <NavLink
                  to="/settings"
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                  onClick={() => setProfileOpen(false)}
                >
                  <Settings className="w-4 h-4" /> Settings
                </NavLink>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-slate-700 hover:text-red-300 transition-colors border-t border-slate-700/60"
                >
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden">

      {/* ── Mobile Overlay ── */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* ── Mobile Sidebar ── */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 flex flex-col transform transition-transform duration-300 lg:hidden',
        mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="absolute top-4 right-4">
          <button
            onClick={() => setMobileSidebarOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <SidebarContent />
      </aside>

      {/* ── Desktop Sidebar ── */}
      <aside className={cn(
        'hidden lg:flex flex-col bg-slate-900 flex-shrink-0 transition-all duration-300 ease-in-out z-30',
        collapsed ? 'w-[68px]' : 'w-64'
      )}>
        <SidebarContent />
      </aside>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top Bar */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 lg:px-6 flex-shrink-0 gap-4 z-20">
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Org name */}
            {user?.organization && (
              <div className="hidden md:flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {user.organization.name}
                </span>
                <span className={cn(
                  'px-2 py-0.5 rounded-full text-xs font-semibold',
                  user.organization.status === 'ACTIVE'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                )}>
                  {user.organization.status}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Secure Session badge */}
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <Shield className="w-3.5 h-3.5 text-green-600 dark:text-green-500" />
              <span className="text-xs font-medium text-green-700 dark:text-green-400">Secure</span>
            </div>

            {/* Notifications bell */}
            <NavLink
              to="/profile"
              className="relative p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
            >
              <Bell className="w-5 h-5" />
              {!!notifCount && notifCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-slate-900" />
              )}
            </NavLink>

            {/* Avatar */}
            <NavLink to="/profile" className="flex items-center gap-2 group">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow group-hover:shadow-md transition-shadow">
                {user ? getInitials(user.firstName, user.lastName) : '?'}
              </div>
            </NavLink>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          <div className="p-4 lg:p-6 max-w-[1600px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/auth.store';
import { api } from '../services/api';
import { cn } from '../lib/utils';
import {
  LayoutDashboard, CreditCard, CheckSquare, ShieldCheck, Wallet,
  Users, Building2, Settings, BarChart3, FileText, Bell, LogOut,
  ChevronDown, User, Key, Zap, BadgeCheck, Building,
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

/** Tooltip for collapsed sidebar */
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
        <div className="absolute left-full ml-3 z-50 whitespace-nowrap bg-gray-900 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg shadow-xl border border-gray-700 pointer-events-none">
          {label}
          <span className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 w-2 h-2 bg-gray-900 border-l border-b border-gray-700 rotate-45" />
        </div>
      )}
    </div>
  );
}

/** Top loading bar that animates on route change */
function LoadingBar({ active }: { active: boolean }) {
  return (
    <div className="fixed top-0 left-0 right-0 z-[999] h-[3px] pointer-events-none">
      <div
        className={cn(
          'h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 transition-all duration-500 ease-out',
          active ? 'w-[85%] opacity-100' : 'w-full opacity-0'
        )}
      />
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
  const [routeChanging, setRouteChanging] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const prevPath = useRef(location.pathname);

  // Loading bar on route change
  useEffect(() => {
    if (location.pathname !== prevPath.current) {
      setRouteChanging(true);
      const t = setTimeout(() => setRouteChanging(false), 400);
      prevPath.current = location.pathname;
      return () => clearTimeout(t);
    }
  }, [location.pathname]);

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

  const prevNotifCount = useRef(0);

  const { data: notifCount } = useQuery({
    queryKey: ['notif-count'],
    queryFn: () => api.get('/users/notifications?unreadOnly=true&limit=1').then(r => r.data.meta?.unreadCount ?? 0).catch(() => 0),
    refetchInterval: 15000, // check every 15 seconds for faster notifications
  });

  // Play notification sound when new notifications arrive
  useEffect(() => {
    if (typeof notifCount === 'number' && notifCount > prevNotifCount.current && prevNotifCount.current >= 0) {
      // Play a notification sound using Web Audio API
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const playTone = (freq: number, start: number, dur: number) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.3, ctx.currentTime + start);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + start + dur);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + start);
          osc.stop(ctx.currentTime + start + dur);
        };
        // Two-tone chime
        playTone(880, 0, 0.15);
        playTone(1174, 0.15, 0.25);
      } catch {}

      // Also show browser notification if permission granted
      if (Notification.permission === 'granted') {
        new Notification('KenyaPay — New Notification', {
          body: 'You have a new notification requiring attention.',
          icon: '/favicon.ico',
          tag: 'kenyapay-notif',
        });
      }
    }
    prevNotifCount.current = notifCount ?? 0;
  }, [notifCount]);

  // Request browser notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

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
        'h-14 flex items-center border-b border-gray-200/70 flex-shrink-0 transition-all duration-300',
        collapsed ? 'px-3 justify-center' : 'px-4 gap-3 justify-between'
      )}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-200">
            <Wallet className="w-4 h-4 text-white" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="font-bold text-sm text-gray-900 leading-tight">KenyaPay</p>
              <p className="text-gray-400 text-[11px] font-medium">Payment Platform</p>
            </div>
          )}
        </div>
        {/* Desktop collapse toggle */}
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="hidden lg:flex p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            title="Collapse sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Expand button when collapsed */}
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="hidden lg:flex mx-auto mt-3 p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          title="Expand sidebar"
        >
          <PanelLeftOpen className="w-4 h-4" />
        </button>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 space-y-0.5 sidebar-scroll">
        {navGroups.map(group => {
          const visibleItems = group.items.filter(isVisible);
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.group} className="px-2 mb-1">
              {/* Group label */}
              {!collapsed && (
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 py-2 mt-2">
                  {group.group}
                </p>
              )}
              {collapsed && <div className="my-2 border-t border-gray-100" />}

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
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                );

                const iconEl = <Icon className={cn('w-4 h-4 flex-shrink-0', isActive ? 'text-blue-600' : '')} />;

                return (
                  <div key={item.label}>
                    {collapsed ? (
                      // Collapsed → icon only with tooltip
                      <Tooltip label={item.label}>
                        {item.href ? (
                          <NavLink to={item.href} className={({ isActive: a }) => cn(
                            'relative flex items-center justify-center p-2.5 rounded-xl transition-all duration-150 w-full',
                            a ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                          )}>
                            {iconEl}
                            {!!item.badge && item.badge > 0 && (
                              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                            )}
                          </NavLink>
                        ) : (
                          <button onClick={() => { setCollapsed(false); toggleMenu(item.label); }} className={cn(baseBtn, 'relative')}>
                            {iconEl}
                            {isActive && <span className="absolute top-1 right-1 w-2 h-2 bg-blue-400 rounded-full" />}
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
                            'w-3.5 h-3.5 text-gray-400 transition-transform duration-200',
                            isExpanded && 'rotate-180'
                          )} />
                        </button>

                        {/* Animated submenu */}
                        <div className={cn(
                          'overflow-hidden transition-all duration-200 ease-in-out',
                          isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                        )}>
                          <div className="ml-4 mt-1 mb-1 border-l-2 border-blue-100 pl-3 space-y-0.5">
                            {item.children!.map(child => (
                              <NavLink
                                key={child.href}
                                to={child.href!}
                                end
                                className={({ isActive: a }) => cn(
                                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
                                  a
                                    ? 'text-blue-700 bg-blue-50'
                                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
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
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
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
        'border-t border-gray-200/70 p-3 flex-shrink-0',
        collapsed && 'flex justify-center'
      )} ref={profileRef}>
        {collapsed ? (
          <Tooltip label={`${user?.firstName} ${user?.lastName}`}>
            <NavLink to="/profile" className="block">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white text-xs font-bold shadow">
                {getInitials(user?.firstName, user?.lastName)}
              </div>
            </NavLink>
          </Tooltip>
        ) : (
          <div className="relative">
            <button
              onClick={() => setProfileOpen(v => !v)}
              className="w-full flex items-center gap-3 rounded-xl hover:bg-gray-50 px-2 py-2 transition-colors group"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                {getInitials(user?.firstName, user?.lastName)}
              </div>
              <div className="flex-1 text-left overflow-hidden">
                <p className="text-sm font-semibold text-gray-900 truncate">{user?.firstName} {user?.lastName}</p>
                <p className="text-xs text-gray-400 truncate">{user?.role?.replace(/_/g, ' ')}</p>
              </div>
              <ChevronDown className={cn('w-3.5 h-3.5 text-gray-400 transition-transform', profileOpen && 'rotate-180')} />
            </button>

            {/* Profile Popover */}
            {profileOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-900">{user?.firstName} {user?.lastName}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{user?.email}</p>
                </div>
                <NavLink
                  to="/profile"
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  onClick={() => setProfileOpen(false)}
                >
                  <User className="w-4 h-4 text-gray-400" /> My Profile
                </NavLink>
                <NavLink
                  to="/settings"
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  onClick={() => setProfileOpen(false)}
                >
                  <Settings className="w-4 h-4 text-gray-400" /> Settings
                </NavLink>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors border-t border-gray-100"
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
    <div className="flex h-screen bg-[#f0f2f5] overflow-hidden">
      <LoadingBar active={routeChanging} />

      {/* ── Mobile Overlay ── */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* ── Mobile Sidebar ── */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-gray-200 flex flex-col transform transition-transform duration-300 lg:hidden shadow-2xl',
        mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="absolute top-4 right-4">
          <button
            onClick={() => setMobileSidebarOpen(false)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <SidebarContent />
      </aside>

      {/* ── Desktop Sidebar ── */}
      <aside className={cn(
        'hidden lg:flex flex-col bg-white border-r border-gray-200 flex-shrink-0 transition-all duration-300 ease-in-out z-30',
        collapsed ? 'w-[68px]' : 'w-[260px]'
      )}>
        <SidebarContent />
      </aside>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top Bar */}
        <header className="h-14 bg-white/95 backdrop-blur-md border-b border-gray-200/70 flex items-center justify-between px-4 lg:px-6 flex-shrink-0 gap-4 z-20 shadow-sm">
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 text-gray-500"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Org name */}
            {user?.organization && (
              <div className="hidden md:flex items-center gap-2">
                <Building2 className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-semibold text-gray-700">
                  {user.organization.name}
                </span>
                <span className={cn(
                  'px-2 py-0.5 rounded-full text-xs font-semibold',
                  user.organization.status === 'ACTIVE'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                )}>
                  {user.organization.status}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Secure Session badge */}
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-green-50 rounded-lg border border-green-200">
              <Shield className="w-3.5 h-3.5 text-green-600" />
              <span className="text-xs font-medium text-green-700">Secure</span>
            </div>

            {/* Notifications bell */}
            <NavLink
              to="/profile"
              className="relative p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
            >
              <Bell className="w-5 h-5" />
              {!!notifCount && notifCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
              )}
            </NavLink>

            {/* Avatar chip */}
            <NavLink to="/profile" className="flex items-center gap-2.5 group px-2 py-1 rounded-xl hover:bg-gray-100 transition-colors">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow group-hover:shadow-md transition-shadow">
                {user ? getInitials(user.firstName, user.lastName) : '?'}
              </div>
              <div className="hidden md:block text-left">
                <p className="text-xs font-semibold text-gray-700 leading-tight">{user?.firstName}</p>
                <p className="text-[10px] text-gray-400 leading-tight">{user?.role?.replace(/_/g, ' ')}</p>
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

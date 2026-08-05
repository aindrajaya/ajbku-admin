import React, { useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Inbox,
  FileText,
  Calendar,
  MessageSquare,
  ShieldAlert,
  History,
  UserPlus,
  Bell,
  LogOut,
  ChevronDown,
  Building,
  Sun,
  Moon,
  DollarSign,
  Settings,
  BarChart3,
  RefreshCcw,
} from 'lucide-react';
import { api, type AppRole } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { canAccess, getPrimaryAdminRole } from '../auth/access';
import { normalizeChatThread, normalizeNotificationItem } from '../lib/communication';
import type { ChatThread, NotificationItem } from '../lib/communication';
import { useRealtimeStore } from '../store/realtime';
import { useSettingsStore } from '../store/settings';
import { queryKeys } from '../lib/queryKeys';
import BlockingLoader from './BlockingLoader';

type UpdaterState = Awaited<ReturnType<typeof window.electronAPI.app.getMeta>>['updater'];
type TenantBranding = { name?: string; logoUrl?: string | null };

function hasElectronApi() {
  return typeof window !== 'undefined' && typeof window.electronAPI !== 'undefined';
}

const navItems: Array<{
  key: 'dashboard' | 'queue' | 'matters' | 'schedules' | 'chat' | 'escrow' | 'moderation' | 'reports' | 'invitations' | 'audit' | 'settings';
  to: string;
  label: string;
  icon: React.ReactNode;
}> = [
  { key: 'dashboard', to: '/', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { key: 'queue', to: '/queue', label: 'Antrian Pengajuan', icon: <Inbox size={18} /> },
  { key: 'matters', to: '/matters', label: 'Perkara', icon: <FileText size={18} /> },
  { key: 'schedules', to: '/schedules', label: 'Agenda', icon: <Calendar size={18} /> },
  { key: 'chat', to: '/chat', label: 'Komunikasi', icon: <MessageSquare size={18} /> },
  { key: 'escrow', to: '/escrow', label: 'Escrow & Payout', icon: <DollarSign size={18} /> },
  { key: 'moderation', to: '/moderation', label: 'Moderasi Chat', icon: <ShieldAlert size={18} /> },
  { key: 'reports', to: '/reports/operational', label: 'Laporan', icon: <BarChart3 size={18} /> },
  { key: 'invitations', to: '/invitations', label: 'Undangan Klien', icon: <UserPlus size={18} /> },
  { key: 'audit', to: '/audit', label: 'Log Audit', icon: <History size={18} /> },
  { key: 'settings', to: '/settings', label: 'Pengaturan', icon: <Settings size={18} /> },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const queryClient = useQueryClient();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('ajbku-theme') as 'light' | 'dark') || 'light');
  const [updaterState, setUpdaterState] = useState<UpdaterState | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const tenantSettings = useSettingsStore((state) => state.getTenantSettings(user?.tenantId || 'tenant-id'));
  const realtimeStatus = useRealtimeStore((state) => state.status);
  const fallbackEnabled = useRealtimeStore((state) => state.fallbackEnabled);
  const fallbackIntervalMs = useRealtimeStore((state) => state.fallbackIntervalMs);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('ajbku-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!hasElectronApi()) {
      return undefined;
    }

    window.electronAPI.app.getMeta().then((meta) => setUpdaterState(meta.updater)).catch(() => {
      setUpdaterState(null);
    });
    const detach = window.electronAPI.app.onUpdaterState((state) => setUpdaterState(state));
    return () => detach?.();
  }, []);

  const tenantId = user?.tenantId;

  const officesQuery = useQuery({
    queryKey: ['offices', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      try {
        const res = await api.get<Array<{ id: string; name: string }>>(`/api/v1/tenants/${tenantId}/offices`);
        return Array.isArray(res.data) ? res.data : [];
      } catch {
        return [];
      }
    },
  });

  const tenantDetailsQuery = useQuery<TenantBranding>({
    queryKey: queryKeys.tenantDetails(tenantId || 'tenant-id'),
    enabled: !!tenantId,
    queryFn: async () => {
      const res = await api.get<TenantBranding>(`/api/v1/tenants/${tenantId}`);
      return res.data;
    },
  });

  const notificationsQuery = useQuery<NotificationItem[]>({
    queryKey: queryKeys.notificationsList(),
    enabled: !!tenantId,
    queryFn: async () => {
      try {
        const res = await api.get<Array<any>>('/api/v1/notifications');
        const rows = Array.isArray(res.data) ? res.data : [];
        return rows.map(normalizeNotificationItem);
      } catch {
        return [];
      }
    },
    refetchInterval: fallbackEnabled ? fallbackIntervalMs : false,
  });

  const chatThreadsQuery = useQuery<ChatThread[]>({
    queryKey: queryKeys.chatThreads(),
    enabled: !!tenantId && canAccess(user?.roles, 'chat'),
    queryFn: async () => {
      try {
        const res = await api.get<Array<any>>('/api/v1/chat/threads');
        const rows = Array.isArray(res.data) ? res.data : [];
        return rows.map(normalizeChatThread);
      } catch {
        return [];
      }
    },
    refetchInterval: fallbackEnabled ? fallbackIntervalMs : false,
  });

  const flaggedQuery = useQuery({
    queryKey: queryKeys.moderationFlaggedMessages(1, 25),
    enabled: !!tenantId && canAccess(user?.roles, 'moderation'),
    queryFn: async () => {
      try {
        const res = await api.get<Array<any>>('/api/v1/moderation/messages/flagged', { page: 1, perPage: 25 });
        return Array.isArray(res.data) ? res.data : [];
      } catch {
        return [];
      }
    },
    refetchInterval: fallbackEnabled ? fallbackIntervalMs : false,
  });

  const markNotificationRead = useMutation({
    mutationFn: async (notificationId: string) => api.patch(`/api/v1/notifications/${notificationId}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.notificationsList() }),
  });

  const unreadNotifications = (notificationsQuery.data || []).filter((item) => !item.isRead);
  const totalChatUnread = (chatThreadsQuery.data || []).reduce((sum, thread) => sum + (thread.unreadCount || 0), 0);
  const totalFlagged = (flaggedQuery.data || []).length;

  const visibleNav = useMemo(
    () => navItems.filter((item) => canAccess(user?.roles, item.key)),
    [user?.roles]
  );
  const primaryRole = getPrimaryAdminRole(user?.roles);

  const activeOfficeName =
    tenantDetailsQuery.data?.name ||
    tenantSettings.profile.officeName ||
    (officesQuery.data?.find((office) => office.id === user?.officeId)?.name ?? officesQuery.data?.[0]?.name ?? 'Kantor Aktif');
  const shellLogoUrl = tenantDetailsQuery.data?.logoUrl || tenantSettings.profile.logoPreview;

  const badgeFor = (key: string) => {
    if (key === 'chat') return totalChatUnread;
    if (key === 'moderation') return totalFlagged;
    return 0;
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      navigate({ to: '/login' });
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', backgroundColor: 'var(--bg-primary)' }}>
      {isLoggingOut ? (
        <BlockingLoader
          title="Mengakhiri Sesi Admin"
          message="Session sedang ditutup dengan aman dan data akses lokal sedang dibersihkan."
        />
      ) : null}
      <aside className="glass-panel" style={{ width: '260px', borderRadius: 0, borderTop: 'none', borderBottom: 'none', borderLeft: 'none', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '1.75rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid var(--border-glass)' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: shellLogoUrl ? `center / cover no-repeat url(${shellLogoUrl})` : 'linear-gradient(135deg, var(--color-emerald), var(--color-gold))', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 700 }}>
            {!shellLogoUrl ? 'A' : ''}
          </div>
          <div>
            <h1 style={{ fontSize: '1.15rem', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--text-primary)' }}>AJB<span style={{ color: 'var(--color-emerald)' }}>ku</span>.id</h1>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Portal Operasional</span>
          </div>
        </div>

        <nav style={{ flex: 1, padding: '1.5rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', overflowY: 'auto' }}>
          {visibleNav.map((item) => (
            <SidebarLink key={item.to} to={item.to} icon={item.icon} label={item.label} active={pathname === item.to || (item.to !== '/' && pathname.startsWith(item.to))} badgeCount={badgeFor(item.key)} />
          ))}
        </nav>

        {updaterState?.message && (
          <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--border-glass)', fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
              <span>{updaterState.message}</span>
              {updaterState.status === 'downloaded' ? (
                <button className="btn btn-primary" style={{ padding: '0.3rem 0.65rem', fontSize: '0.7rem' }} onClick={() => void window.electronAPI?.app.restartToUpdate()}>
                  Restart & Update
                </button>
              ) : updaterState.status === 'idle' ? (
                <button className="btn btn-secondary" style={{ padding: '0.3rem 0.65rem', fontSize: '0.7rem' }} onClick={() => void window.electronAPI?.app.checkForUpdates()}>
                  <RefreshCcw size={12} />
                </button>
              ) : null}
            </div>
          </div>
        )}
        <div style={{ padding: '0.55rem 1rem', borderTop: '1px solid var(--border-glass)', fontSize: '0.7rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)' }}>
          Sinkronisasi: {fallbackEnabled ? `polling ${Math.round(fallbackIntervalMs / 1000)} detik` : realtimeStatus}
        </div>
      </aside>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header className="glass-panel" style={{ height: '70px', borderRadius: 0, borderTop: 'none', borderRight: 'none', borderLeft: 'none', padding: '0 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 80, overflow: 'visible' }}>
          <div>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Beranda</span>
            <span style={{ margin: '0 0.5rem', color: 'var(--text-muted)' }}>/</span>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>{getBreadcrumbText(pathname)}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-input-field)', padding: '0.4rem 0.8rem', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
              <Building size={16} style={{ color: 'var(--color-emerald)' }} />
              <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{activeOfficeName}</span>
            </div>

            <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className="glass-panel-interactive" style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: '0.5rem', borderRadius: '50%', display: 'grid', placeItems: 'center' }}>
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>

            <div style={{ position: 'relative' }}>
              <button onClick={() => { setShowNotifications((value) => !value); setShowProfileMenu(false); }} className="glass-panel-interactive" style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: '0.5rem', borderRadius: '50%', display: 'grid', placeItems: 'center', position: 'relative' }}>
                <Bell size={20} />
                {unreadNotifications.length > 0 && <span style={{ position: 'absolute', top: '2px', right: '2px', backgroundColor: 'var(--color-crimson)', color: '#fff', fontSize: '0.65rem', fontWeight: 700, width: '18px', height: '18px', borderRadius: '50%', display: 'grid', placeItems: 'center' }}>{unreadNotifications.length}</span>}
              </button>

              {showNotifications && (
                <div className="glass-panel animate-fade-in" style={{ position: 'absolute', top: '100%', right: 0, marginTop: '0.75rem', width: '360px', maxHeight: '420px', overflow: 'hidden', zIndex: 120 }}>
                  <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-glass)', fontWeight: 600 }}>Notifikasi</div>
                  <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
                    {notificationsQuery.data?.length ? notificationsQuery.data.map((notification) => (
                      <button
                        key={notification.id}
                        type="button"
                        onClick={() => {
                          if (!notification.isRead) {
                            markNotificationRead.mutate(notification.id);
                          }
                          setShowNotifications(false);
                          if (notification.actionPath) {
                            navigate({ to: notification.actionPath as any });
                            return;
                          }
                          if (notification.matterId) {
                            navigate({ to: '/matters/$id', params: { id: notification.matterId } });
                          }
                        }}
                        style={{ width: '100%', textAlign: 'left', padding: '1rem', background: notification.isRead ? 'transparent' : 'rgba(16, 185, 129, 0.05)', border: 'none', borderBottom: '1px solid var(--border-glass)', color: 'var(--text-primary)', cursor: 'pointer' }}
                      >
                        <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{notification.title}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{notification.body}</div>
                      </button>
                    )) : <div style={{ padding: '1.25rem', color: 'var(--text-muted)' }}>Tidak ada notifikasi.</div>}
                  </div>
                </div>
              )}
            </div>

            <div style={{ position: 'relative' }}>
              <button onClick={() => { setShowProfileMenu((value) => !value); setShowNotifications(false); }} className="glass-panel-interactive" style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.8rem', borderRadius: '8px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--color-emerald-hover)', color: '#fff', fontWeight: 600, display: 'grid', placeItems: 'center' }}>
                  {user?.fullName?.slice(0, 2).toUpperCase() || 'AD'}
                </div>
                <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />
              </button>

              {showProfileMenu && (
                <div className="glass-panel animate-fade-in" style={{ position: 'absolute', top: '100%', right: 0, marginTop: '0.75rem', width: '220px', padding: '0.5rem', zIndex: 120 }}>
                  <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-glass)' }}>
                    <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>{user?.fullName}</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user?.email}</p>
                    <span className="badge badge-teal" style={{ marginTop: '0.4rem', fontSize: '0.65rem' }}>{primaryRole || 'NO_ADMIN_ROLE'}</span>
                  </div>
                  <button type="button" onClick={handleLogout} style={{ width: '100%', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'none', border: 'none', color: 'var(--color-crimson)', fontSize: '0.9rem', cursor: 'pointer' }}>
                    <LogOut size={16} />
                    Keluar Sesi
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main style={{ flex: 1, padding: '2rem', overflowY: 'auto', background: 'radial-gradient(ellipse at bottom, var(--bg-secondary) 0%, var(--bg-primary) 100%)', position: 'relative', zIndex: 1 }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function SidebarLink({
  to,
  icon,
  label,
  active,
  badgeCount,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  badgeCount?: number;
}) {
  return (
    <Link to={to} className={active ? '' : 'sidebar-link-hover'} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.8rem 1.2rem', borderRadius: '8px', color: active ? 'var(--sidebar-active-text)' : 'var(--text-secondary)', background: active ? 'var(--sidebar-active-bg)' : 'transparent', border: active ? '1px solid var(--sidebar-active-border)' : '1px solid transparent', textDecoration: 'none', fontWeight: active ? 600 : 500, fontSize: '0.95rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <span style={{ color: active ? 'var(--color-emerald)' : 'var(--text-muted)' }}>{icon}</span>
        <span>{label}</span>
      </div>
      {badgeCount ? <span style={{ backgroundColor: 'var(--color-emerald)', color: '#fff', fontSize: '0.7rem', fontWeight: 700, padding: '0.1rem 0.45rem', borderRadius: '10px' }}>{badgeCount}</span> : null}
      <style>{`.sidebar-link-hover:hover { background: var(--sidebar-hover-bg); color: var(--text-primary); border-color: var(--sidebar-hover-border); }`}</style>
    </Link>
  );
}

function getBreadcrumbText(pathname: string) {
  if (pathname === '/') return 'Dashboard';
  if (pathname.startsWith('/queue')) return 'Antrian Pengajuan';
  if (pathname.startsWith('/matters')) return 'Perkara';
  if (pathname.startsWith('/schedules')) return 'Agenda';
  if (pathname.startsWith('/chat')) return 'Komunikasi';
  if (pathname.startsWith('/moderation')) return 'Moderasi';
  if (pathname.startsWith('/audit')) return 'Log Audit';
  if (pathname.startsWith('/invitations')) return 'Undangan Klien';
  if (pathname.startsWith('/settings')) return 'Pengaturan';
  if (pathname.startsWith('/reports')) return 'Laporan';
  if (pathname.startsWith('/escrow')) return 'Escrow & Payout';
  return 'Halaman';
}

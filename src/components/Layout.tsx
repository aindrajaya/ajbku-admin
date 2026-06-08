import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
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
  Server,
  Sun,
  Moon
} from 'lucide-react';
import { api, getApiBaseUrl, setApiBaseUrl, tokenManager } from '../api/client';

// Guard: only run queries when a token is present
function hasToken() {
  return !!tokenManager.getSync('accessToken');
}

interface LayoutProps {
  onLogout: () => void;
}

export default function Layout({ onLogout }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showHostSettings, setShowHostSettings] = useState(false);
  const [apiHost, setApiHost] = useState(getApiBaseUrl());

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('ajbku-theme') as 'light' | 'dark') || 'light';
  });

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    localStorage.setItem('ajbku-theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  // State for user details
  const [userProfile, setUserProfile] = useState<{ fullName: string; roleCode: string; email: string } | null>(null);
  const [selectedOffice, setSelectedOffice] = useState<string>('off-1');

  // Load user profile
  useEffect(() => {
    async function loadUser() {
      if (!hasToken()) return; // Don't fire without a valid token
      try {
        const res = await api.get('/api/v1/auth/me');
        setUserProfile(res.data);
      } catch (err) {
        // Fallback jika /auth/me gagal
        setUserProfile({
          fullName: 'Admin Sari Wijaya',
          roleCode: 'PRINCIPAL',
          email: 'admin@notarissejahtera.com'
        });
      }
    }
    loadUser();
  }, []);

  const tenantId = tokenManager.getSync('tenantId') || 'tenant-id';

  // Fetch offices
  const { data: offices = [] } = useQuery({
    queryKey: ['offices', tenantId],
    enabled: hasToken() && tenantId !== 'tenant-id',
    queryFn: async () => {
      const res = await api.get(`/api/v1/tenants/${tenantId}/offices`);
      return Array.isArray(res.data) ? res.data : res.data?.data || [];
    }
  });

  const safeOffices = Array.isArray(offices) ? offices : [];

  // Fetch notifications
  const { data: notifications = [], refetch: refetchNotifs } = useQuery({
    queryKey: ['notifications'],
    enabled: hasToken(),
    queryFn: async () => {
      const res = await api.get('/api/v1/notifications');
      return Array.isArray(res.data) ? res.data : res.data?.data || [];
    },
    refetchInterval: 60000 // Poll every minute
  });

  const safeNotifications = Array.isArray(notifications) ? notifications : [];

  // Fetch chat threads to compute unread badges
  const { data: chatThreads = [] } = useQuery({
    queryKey: ['chat', 'threads'],
    enabled: hasToken(),
    queryFn: async () => {
      const res = await api.get('/api/v1/chat/threads');
      return Array.isArray(res.data) ? res.data : res.data?.data || [];
    },
    refetchInterval: 15000 // Refresh thread counts
  });

  const safeChatThreads = Array.isArray(chatThreads) ? chatThreads : [];

  const totalChatUnread = safeChatThreads.reduce((sum: number, t: any) => sum + (t?.unreadCount || 0), 0);
  const unreadNotifications = safeNotifications.filter((n: any) => n && !n.isRead);

  // Mutation to mark single notification read
  const readNotificationMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/api/v1/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  const handleLogout = async () => {
    try {
      await api.post('/api/v1/auth/logout');
    } catch (e) {
      // Ignore network errors on logout
    }
    await tokenManager.clearAll();
    onLogout();
    navigate('/login');
  };

  const saveBaseUrl = () => {
    setApiBaseUrl(apiHost);
    setShowHostSettings(false);
    alert('Host API berhasil diperbarui. Memuat ulang...');
    window.location.reload();
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', backgroundColor: 'var(--bg-primary)' }}>
      
      {/* Sidebar - Midnight Emerald Design */}
      <aside className="glass-panel" style={{
        width: '260px',
        height: '100%',
        borderRadius: '0',
        borderTop: 'none',
        borderBottom: 'none',
        borderLeft: 'none',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 10
      }}>
        {/* Brand Header */}
        <div style={{
          padding: '1.75rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          borderBottom: '1px solid var(--border-glass)'
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, var(--color-emerald), var(--color-gold))',
            boxShadow: 'var(--shadow-emerald-glow)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            fontSize: '1.1rem',
            color: '#fff'
          }}>A</div>
          <div>
            <h1 style={{ fontSize: '1.15rem', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--text-primary)' }}>
              AJB<span style={{ color: 'var(--color-emerald)' }}>ku</span>.id
            </h1>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Portal Operasional
            </span>
          </div>
        </div>

        {/* Sidebar Menu Links (Using updated Indonesian terminology) */}
        <nav style={{ flex: 1, padding: '1.5rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', overflowY: 'auto' }}>
          
          <SidebarLink to="/" icon={<LayoutDashboard size={18} />} label="Dashboard" active={location.pathname === '/'} />
          
          <SidebarLink to="/queue" icon={<Inbox size={18} />} label="Antrian Pengajuan" active={location.pathname === '/queue'} />
          
          <SidebarLink to="/matters" icon={<FileText size={18} />} label="Perkara" active={location.pathname.startsWith('/matters')} />
          
          <SidebarLink to="/schedules" icon={<Calendar size={18} />} label="Agenda" active={location.pathname === '/schedules'} />
          
          <SidebarLink to="/chat" icon={<MessageSquare size={18} />} label="Komunikasi" active={location.pathname === '/chat'} badgeCount={totalChatUnread} />
          
          <SidebarLink to="/moderation" icon={<ShieldAlert size={18} />} label="Moderasi" active={location.pathname === '/moderation'} />
          
          <SidebarLink to="/audit" icon={<History size={18} />} label="Log Audit" active={location.pathname === '/audit'} />
          
          <SidebarLink to="/invitations" icon={<UserPlus size={18} />} label="Undangan Staf" active={location.pathname === '/invitations'} />

        </nav>

        {/* Sidebar Footer – Backend Host Settings */}
        <div style={{
          padding: '1rem',
          borderTop: '1px solid var(--border-glass)',
          background: 'rgba(0, 0, 0, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem'
        }}>
          <button
            onClick={() => setShowHostSettings(!showHostSettings)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.75rem',
              padding: '0'
            }}
          >
            <Server size={13} />
            <span style={{ textDecoration: 'underline' }}>
              {showHostSettings ? 'Tutup Pengaturan' : getApiBaseUrl()}
            </span>
          </button>

          {showHostSettings && (
            <div className="glass-panel" style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <input
                type="text"
                value={apiHost}
                onChange={(e) => setApiHost(e.target.value)}
                className="input-field"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
              />
              <button onClick={saveBaseUrl} className="btn btn-primary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderRadius: '4px' }}>
                Simpan & Reload
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        
        {/* Topbar */}
        <header className="glass-panel" style={{
          height: '70px',
          borderRadius: '0',
          borderTop: 'none',
          borderRight: 'none',
          borderLeft: 'none',
          padding: '0 2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 9
        }}>
          {/* Breadcrumbs / Page Title */}
          <div>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Beranda</span>
            <span style={{ margin: '0 0.5rem', color: 'var(--text-muted)' }}>/</span>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {getBreadcrumbText(location.pathname)}
            </span>
          </div>

          {/* User Controls Panel */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            
            {/* Active Office Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-input-field)', padding: '0.4rem 0.8rem', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
              <Building size={16} style={{ color: 'var(--color-emerald)' }} />
              <select 
                value={selectedOffice} 
                onChange={(e) => setSelectedOffice(e.target.value)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                {safeOffices.length > 0 ? (
                  safeOffices.map((o: any) => (
                    <option key={o.id} value={o.id} style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                      {o.name}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="off-1" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>Notaris Sejahtera Madiun</option>
                    <option value="off-2" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>PPAT Sukses Surabaya</option>
                  </>
                )}
              </select>
            </div>

            {/* Theme Toggle Button */}
            <button 
              onClick={toggleTheme}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                padding: '0.5rem',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'var(--transition-smooth)'
              }}
              className="glass-panel-interactive"
              title={theme === 'light' ? 'Aktifkan Mode Gelap' : 'Aktifkan Mode Terang'}
            >
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>

            {/* Notification Bell with Badge */}
            <div style={{ position: 'relative' }}>
              <button 
                onClick={() => { setShowNotifications(!showNotifications); setShowProfileMenu(false); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  padding: '0.5rem',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'var(--transition-smooth)'
                }}
                className="glass-panel-interactive"
              >
                <Bell size={20} />
                {unreadNotifications.length > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '2px',
                    right: '2px',
                    backgroundColor: 'var(--color-crimson)',
                    color: '#fff',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 5px rgba(239, 68, 68, 0.5)'
                  }}>
                    {unreadNotifications.length}
                  </span>
                )}
              </button>

              {/* Glassy Notification Panel Dropdown */}
              {showNotifications && (
                <div className="glass-panel animate-fade-in" style={{
                  position: 'absolute',
                  top: '100%',
                  right: '0',
                  marginTop: '0.75rem',
                  width: '350px',
                  maxHeight: '400px',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  zIndex: 20
                }}>
                  <div style={{
                    padding: '1rem',
                    borderBottom: '1px solid var(--border-glass)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'rgba(0,0,0,0.1)'
                  }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Notifikasi</h3>
                    <button 
                      onClick={async () => {
                        // Tandai semua notifikasi sebagai dibaca
                        for (const n of unreadNotifications) {
                          await readNotificationMutation.mutateAsync(n.id);
                        }
                      }}
                      style={{ background: 'none', border: 'none', color: 'var(--color-emerald)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 500 }}
                    >
                      Tandai Semua Dibaca
                    </button>
                  </div>
                  <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column' }}>
                    {safeNotifications.length === 0 ? (
                      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        Tidak ada notifikasi baru
                      </div>
                    ) : (
                      safeNotifications.map((n: any) => (
                        <div 
                          key={n.id} 
                          onClick={() => {
                            if (!n.isRead) readNotificationMutation.mutate(n.id);
                            setShowNotifications(false);
                            if (n.matterId) navigate(`/matters/${n.matterId}`);
                          }}
                          style={{
                            padding: '1rem',
                            borderBottom: '1px solid var(--border-glass)',
                            cursor: 'pointer',
                            backgroundColor: n.isRead ? 'transparent' : 'rgba(16, 185, 129, 0.05)',
                            transition: 'var(--transition-smooth)',
                            display: 'flex',
                            gap: '0.75rem'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = n.isRead ? 'transparent' : 'rgba(16, 185, 129, 0.05)'}
                        >
                          <div style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: n.isRead ? 'transparent' : 'var(--color-emerald)',
                            marginTop: '4px',
                            flexShrink: 0
                          }} />
                          <div>
                            <h4 style={{ fontSize: '0.85rem', fontWeight: n.isRead ? 500 : 600, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                              {n.title}
                            </h4>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.25' }}>
                              {n.body}
                            </p>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.4rem', display: 'block' }}>
                              {new Date(n.createdAt).toLocaleDateString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Dropdown */}
            <div style={{ position: 'relative' }}>
              <button 
                onClick={() => { setShowProfileMenu(!showProfileMenu); setShowNotifications(false); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.4rem 0.8rem',
                  borderRadius: '8px'
                }}
                className="glass-panel-interactive"
              >
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: 'var(--color-emerald-hover)',
                  color: '#fff',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.9rem'
                }}>
                  {userProfile?.fullName.slice(0, 2).toUpperCase() || 'AD'}
                </div>
                <div style={{ textAlign: 'left', display: 'none', flexDirection: 'column' } /* shown on larger displays */}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{userProfile?.fullName}</span>
                </div>
                <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />
              </button>

              {showProfileMenu && (
                <div className="glass-panel animate-fade-in" style={{
                  position: 'absolute',
                  top: '100%',
                  right: '0',
                  marginTop: '0.75rem',
                  width: '220px',
                  padding: '0.5rem',
                  zIndex: 20
                }}>
                  <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-glass)' }}>
                    <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{userProfile?.fullName}</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{userProfile?.email}</p>
                    <span className="badge badge-teal" style={{ marginTop: '0.4rem', fontSize: '0.65rem' }}>{userProfile?.roleCode}</span>
                  </div>
                  
                  <button 
                    onClick={handleLogout}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-crimson)',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                      borderRadius: '6px',
                      marginTop: '0.25rem',
                      transition: 'var(--transition-smooth)'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.08)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <LogOut size={16} />
                    Keluar Sesi
                  </button>
                </div>
              )}
            </div>

          </div>
        </header>

        {/* Content Outlet */}
        <main style={{ flex: 1, padding: '2rem', overflowY: 'auto', background: 'radial-gradient(ellipse at bottom, var(--bg-secondary) 0%, var(--bg-primary) 100%)' }}>
          <Outlet />
        </main>
      </div>

    </div>
  );
}

// SidebarLink helper component
interface SidebarLinkProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  badgeCount?: number;
}

function SidebarLink({ to, icon, label, active, badgeCount }: SidebarLinkProps) {
  return (
    <Link 
      to={to} 
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.8rem 1.2rem',
        borderRadius: '8px',
        color: active ? 'var(--sidebar-active-text)' : 'var(--text-secondary)',
        background: active ? 'var(--sidebar-active-bg)' : 'transparent',
        border: active ? '1px solid var(--sidebar-active-border)' : '1px solid transparent',
        textDecoration: 'none',
        fontWeight: active ? 600 : 500,
        fontFamily: 'var(--font-sans)',
        fontSize: '0.95rem',
        transition: 'var(--transition-smooth)'
      }}
      className={active ? '' : 'sidebar-link-hover'}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <span style={{ color: active ? 'var(--color-emerald)' : 'var(--text-muted)' }}>{icon}</span>
        <span>{label}</span>
      </div>
      
      {badgeCount !== undefined && badgeCount > 0 && (
        <span style={{
          backgroundColor: 'var(--color-emerald)',
          color: '#fff',
          fontSize: '0.7rem',
          fontWeight: 700,
          padding: '0.1rem 0.45rem',
          borderRadius: '10px',
          boxShadow: 'var(--shadow-emerald-glow)'
        }}>
          {badgeCount}
        </span>
      )}
      
      {/* Inject custom hover style tag directly in body if not done */}
      <style>{`
        .sidebar-link-hover:hover {
          background: var(--sidebar-hover-bg);
          color: var(--text-primary);
          border-color: var(--sidebar-hover-border);
        }
      `}</style>
    </Link>
  );
}

// Mapper to get breadcrumb text from path
function getBreadcrumbText(pathname: string): string {
  if (pathname === '/') return 'Dashboard';
  if (pathname === '/queue') return 'Antrian Pengajuan';
  if (pathname === '/matters') return 'Perkara';
  if (pathname.startsWith('/matters/')) return 'Detail Perkara';
  if (pathname === '/schedules') return 'Agenda';
  if (pathname === '/chat') return 'Komunikasi';
  if (pathname === '/moderation') return 'Moderasi';
  if (pathname === '/audit') return 'Log Audit';
  if (pathname === '/invitations') return 'Undangan Staf';
  return 'Halaman';
}

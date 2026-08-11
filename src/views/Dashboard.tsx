import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { getPrimaryAdminRole } from '../auth/access';
import { buildMatterListParams, extractMatterList } from '../lib/matters';
import { listNotaryPartners, listNotaryPayouts } from '../lib/notaryPartners';
import { queryKeys } from '../lib/queryKeys';
import { 
  FileText, 
  Clock, 
  ShieldAlert, 
  DollarSign, 
  ArrowRight,
  TrendingUp,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';

const SELF_SERVICE_INTAKE_SOURCES = new Set(['client_self_service', 'client_mandiri', 'mandiri', 'pwa_client']);

function readMatterSource(matter: any) {
  return String(
    matter?.source ||
    matter?.origin ||
    matter?.intakeSource ||
    matter?.intake_source ||
    matter?.matterSource ||
    matter?.matter_source ||
    ''
  ).trim().toLowerCase();
}

function isMatterIntakeMandiri(matter: any) {
  return matter?.workflowStatus === 'intake_submitted' && SELF_SERVICE_INTAKE_SOURCES.has(readMatterSource(matter));
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { status } = useAuth();
  const [role, setRole] = React.useState('PRINCIPAL');
  const hasToken = status === 'authenticated';

  React.useEffect(() => {
    async function loadUser() {
      try {
        const res = await api.get('/api/v1/auth/me');
        const primaryRole = getPrimaryAdminRole(res.data?.roles);
        if (primaryRole) {
          setRole(primaryRole);
        }
      } catch (err) {
        // Fallback
      }
    }
    loadUser();
  }, []);
  
  // Fetch matters
  const { data: matters = [], isLoading: isLoadingMatters } = useQuery({
    queryKey: ['matters'],
      enabled: hasToken,
    queryFn: async () => {
      const res = await api.get('/api/v1/matters', buildMatterListParams());
      return extractMatterList(res.data);
    }
  });

  // Fetch flagged messages
  const { data: flaggedMessages = [] } = useQuery({
    queryKey: queryKeys.moderationFlaggedMessages(1, 10),
    enabled: hasToken,
    queryFn: async () => {
      const res = await api.get('/api/v1/moderation/messages/flagged', { page: 1, perPage: 10 });
      return Array.isArray(res.data) ? res.data : res.data?.data || [];
    }
  });

  const { data: pendingNotaryPartners = [] } = useQuery({
    queryKey: queryKeys.notaryPartners({ status: 'pending_approval' }),
    enabled: hasToken,
    queryFn: () => listNotaryPartners({ status: 'pending_approval' }),
  });

  const { data: pendingNotaryPayouts = [] } = useQuery({
    queryKey: queryKeys.notaryPayouts({ status: 'pending' }),
    enabled: hasToken,
    queryFn: () => listNotaryPayouts({ status: 'pending' }),
  });

  // Ensure we are working with arrays to prevent crashes on non-200 responses or invalid payloads
  const safeMatters = Array.isArray(matters) ? matters : [];
  const safeFlaggedMessages = Array.isArray(flaggedMessages) ? flaggedMessages : [];
  const safePendingNotaryPartners = Array.isArray(pendingNotaryPartners) ? pendingNotaryPartners : [];
  const safePendingNotaryPayouts = Array.isArray(pendingNotaryPayouts) ? pendingNotaryPayouts : [];

  // Calculate metrics
  const activeMatters = safeMatters.filter((m: any) => m && m.workflowStatus !== 'closed' && m.workflowStatus !== 'cancelled');
  const pendingVerifications = safeMatters.filter((m: any) => m && m.workflowStatus === 'documents_under_review');
  const intakeMandiriMatters = safeMatters.filter(isMatterIntakeMandiri);
  const hasIntakeMandiriMarker = safeMatters.some((m: any) => readMatterSource(m));

  const renderIntakeMandiriMetric = () => hasIntakeMandiriMarker ? (
    <MetricCard icon={<FileText size={24} style={{ color: 'var(--color-blue)' }} />} title="Intake Mandiri" value={intakeMandiriMatters.length} subtitle="Client self-service" link="/queue" />
  ) : null;

  const renderMetrics = () => {
    if (role === 'ADMIN_INTAKE' || role === 'ADMIN_OFFICE') {
      const intakeNew = safeMatters.filter((m: any) => m && (m.workflowStatus === 'draft' || m.workflowStatus === 'intake_submitted')).length;
      const needRevision = safeMatters.filter((m: any) => m && m.workflowStatus === 'manual_review').length;
      const waitingAsgn = safeMatters.filter((m: any) => m && (m.workflowStatus === 'documents_verified' || m.workflowStatus === 'assignment_pending')).length;
      const finishedToday = safeMatters.filter((m: any) => m && m.workflowStatus === 'closed').length;

      return (
        <>
          <MetricCard icon={<FileText size={24} style={{ color: 'var(--color-blue)' }} />} title="Intake Baru" value={intakeNew} subtitle="Menunggu verifikasi" link="/queue" />
          {renderIntakeMandiriMetric()}
          <MetricCard icon={<AlertCircle size={24} style={{ color: 'var(--color-crimson)' }} />} title="Perlu Revisi" value={needRevision} subtitle="Review manual" link="/queue" />
          <MetricCard icon={<Clock size={24} style={{ color: 'var(--color-gold)' }} />} title="Menunggu Asgn" value={waitingAsgn} subtitle="Penugasan notaris" link="/matters" />
          <MetricCard icon={<CheckCircle2 size={24} style={{ color: 'var(--color-emerald)' }} />} title="Selesai" value={finishedToday} subtitle="Telah di-close" link="/matters" />
        </>
      );
    }

    if (role === 'FINANCE_ADMIN') {
      return (
        <>
          <MetricCard icon={<DollarSign size={24} style={{ color: 'var(--color-emerald)' }} />} title="Dana di Escrow" value="Rp 39,5jt" subtitle="Saldo tersimpan" link="/escrow" />
          <MetricCard icon={<Clock size={24} style={{ color: 'var(--color-gold)' }} />} title="Payout Notaris" value={safePendingNotaryPayouts.length} subtitle="Vendor payout pending" link="/notary-payouts" />
          <MetricCard icon={<CheckCircle2 size={24} style={{ color: 'var(--color-emerald)' }} />} title="Payout Hari Ini" value="1" subtitle="Telah diproses" link="/escrow" />
          <MetricCard icon={<AlertCircle size={24} style={{ color: 'var(--color-crimson)' }} />} title="Mismatch" value="0" subtitle="Rekonsiliasi aman" link="/escrow" />
        </>
      );
    }

    if (role === 'MODERATION_OFFICER') {
      return (
        <>
          <MetricCard icon={<ShieldAlert size={24} style={{ color: 'var(--color-crimson)' }} />} title="Flagged Hari Ini" value={safeFlaggedMessages.length} subtitle="Perlu moderasi" link="/moderation" />
          <MetricCard icon={<Clock size={24} style={{ color: 'var(--color-gold)' }} />} title="Total Flagged" value={safeFlaggedMessages.length} subtitle="Semua periode" link="/moderation" />
          <MetricCard icon={<CheckCircle2 size={24} style={{ color: 'var(--color-emerald)' }} />} title="False Positive" value="95%" subtitle="Rate akurasi AI" link="/moderation" />
        </>
      );
    }

    // Principal / Default summary dashboard
    return (
      <>
        <MetricCard icon={<FileText size={24} style={{ color: 'var(--color-blue)' }} />} title="Perkara Aktif" value={activeMatters.length} subtitle="Sedang berjalan" link="/matters" />
        <MetricCard icon={<Clock size={24} style={{ color: 'var(--color-gold)' }} />} title="Verifikasi Dokumen" value={pendingVerifications.length} subtitle="Menunggu review" link="/queue" />
        <MetricCard icon={<ShieldAlert size={24} style={{ color: 'var(--color-crimson)' }} />} title="Notaris Pending" value={safePendingNotaryPartners.length} subtitle="Menunggu approval" link="/notary-partners" />
        <MetricCard icon={<DollarSign size={24} style={{ color: 'var(--color-emerald)' }} />} title="Payout Notaris" value={safePendingNotaryPayouts.length} subtitle="Vendor payout pending" link="/notary-payouts" />
        {renderIntakeMandiriMetric()}
      </>
    );
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Welcome Banner */}
      <div className="glass-panel" style={{
        padding: '2rem',
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(17, 24, 39, 0.6) 100%)',
        border: '1px solid rgba(16, 185, 129, 0.15)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            Selamat Datang di AJBku Admin Dashboard
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Semua aktivitas sertifikasi tanah, akta notaris, dan pelepasan dana escrow termonitor dalam satu platform terenkripsi.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(16, 185, 129, 0.1)', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
          <TrendingUp size={18} style={{ color: 'var(--color-emerald)' }} />
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-emerald)' }}>Sistem Terhubung</span>
        </div>
      </div>

      {/* Grid Statistics Metrics */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '1.5rem'
      }}>
        {renderMetrics()}
      </div>

      {/* Two Columns: Recent Matters & Quick Actions */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr',
        gap: '1.5rem'
      }}>
        
        {/* Recent Matters List */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Perkara Terbaru</h3>
            <Link to="/matters" style={{ color: 'var(--color-emerald)', fontSize: '0.85rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600 }}>
              Lihat Semua <ArrowRight size={14} />
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
            {isLoadingMatters ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Memuat perkara...</div>
            ) : safeMatters.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Belum ada perkara terdaftar</div>
            ) : (
              safeMatters.slice(0, 4).map((m: any) => (
                <div 
                  key={m.id} 
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '1rem',
                    backgroundColor: 'rgba(0,0,0,0.15)',
                    borderRadius: '8px',
                    border: '1px solid var(--border-glass)'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--color-emerald)', fontFamily: 'monospace', fontWeight: 600 }}>{m.caseNumber || m.matterNumber}</span>
                      <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{m.title}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <span>Nilai: Rp {m.transactionValue ? m.transactionValue.toLocaleString('id-ID') : '0'}</span>
                      <span>•</span>
                      <span>Wilayah: Kota/Kab {m.landCityCode}</span>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span className={`badge ${getStatusBadgeClass(m.workflowStatus)}`} style={{ fontSize: '0.65rem' }}>
                      {m.workflowStatus ? m.workflowStatus.replace(/_/g, ' ') : ''}
                    </span>
                    <Link to="/matters/$id" params={{ id: m.id }} className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}>
                      Buka
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pending Actions Panel */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1.5rem' }}>Antrian Tindakan</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {pendingVerifications.map((m: any) => (
              <div 
                key={m.id} 
                className="glass-panel-interactive" 
                style={{
                  padding: '1rem',
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                  backgroundColor: 'rgba(59, 130, 246, 0.03)',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
                onClick={() => navigate({ to: '/matters/$id', params: { id: m.id } })}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <AlertCircle size={16} style={{ color: 'var(--color-blue)' }} />
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-blue)' }}>Verifikasi Berkas</span>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{m.title}</p>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{m.caseNumber || m.matterNumber}</span>
              </div>
            ))}

            {safeFlaggedMessages.slice(0, 2).map((msg: any) => (
              <div 
                key={msg.id} 
                className="glass-panel-interactive" 
                style={{
                  padding: '1rem',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  backgroundColor: 'rgba(239, 68, 68, 0.03)',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
                onClick={() => navigate({ to: '/moderation' })}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <ShieldAlert size={16} style={{ color: 'var(--color-crimson)' }} />
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-crimson)' }}>Pesan Flagged</span>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                  "{typeof msg.bodyText === 'string' ? msg.bodyText : msg.bodyText?.text || 'Payload object'}"
                </p>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Pengirim: {msg.senderName}</span>
              </div>
            ))}

            {pendingVerifications.length === 0 && safeFlaggedMessages.length === 0 && (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Semua pekerjaan selesai! Tidak ada antrian tindakan darurat.
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}

// MetricCard helper component
interface MetricCardProps {
  icon: React.ReactNode;
  title: string;
  value: string | number;
  subtitle: string;
  link: string;
}

function MetricCard({ icon, title, value, subtitle, link }: MetricCardProps) {
  return (
    <Link to={link} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div className="glass-panel glass-panel-interactive" style={{
        padding: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '1.25rem',
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '12px',
          background: 'rgba(255,255,255,0.03)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid var(--border-glass)'
        }}>{icon}</div>
        <div>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.2rem' }}>
            {title}
          </span>
          <span style={{ fontSize: '1.75rem', fontWeight: 700, display: 'block', lineHeight: '1', marginBottom: '0.2rem' }}>
            {value}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {subtitle}
          </span>
        </div>
      </div>
    </Link>
  );
}

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'draft': return 'badge-gray';
    case 'documents_under_review': return 'badge-blue';
    case 'documents_verified': return 'badge-teal';
    case 'payment_pending': return 'badge-orange';
    case 'payment_verified': return 'badge-green';
    case 'closed': return 'badge-green';
    case 'cancelled': return 'badge-red';
    default: return 'badge-purple';
  }
}

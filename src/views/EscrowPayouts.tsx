import React from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { notifyError, notifySuccess } from '../store/ui';
import { AlertCircle, Landmark } from 'lucide-react';
import { buildMatterListParams, extractMatterList } from '../lib/matters';

function normalizeStatus(status: string) {
  switch (String(status || '').toLowerCase()) {
    case 'pending':
      return 'pending_checker';
    case 'processed':
      return 'released';
    case 'draft':
      return 'requested';
    default:
      return String(status || '').toLowerCase();
  }
}

export default function EscrowPayouts() {
  const { user } = useAuth();
  const mattersQuery = useQuery({
    queryKey: ['matters-escrow-list'],
    queryFn: async () => {
      const res = await api.get('/api/v1/matters', buildMatterListParams());
      return extractMatterList(res.data);
    },
  });

  const queueQuery = useQuery({
    queryKey: ['escrow-payout-queue', mattersQuery.data?.length || 0],
    enabled: Array.isArray(mattersQuery.data),
    queryFn: async () => {
      const matters = Array.isArray(mattersQuery.data) ? mattersQuery.data : [];
      const releases = await Promise.all(matters.map(async (matter: any) => {
        try {
          const [escrowRes, releasesRes] = await Promise.all([
            api.get(`/api/v1/matters/${matter.id}/escrow`),
            api.get(`/api/v1/matters/${matter.id}/escrow/releases`),
          ]);
          const rows = Array.isArray(releasesRes.data) ? releasesRes.data : releasesRes.data?.data || [];
          return rows.map((row: any) => ({
            ...row,
            matterId: matter.id,
            matterCaseNumber: matter.caseNumber || matter.matterNumber,
            matterTitle: matter.title,
            reconciliationMismatch: Boolean(row.reconciliationMismatch || (escrowRes.data as any)?.reconciliationMismatch),
            uiStatus: normalizeStatus(row.status),
          }));
        } catch {
          return [];
        }
      }));
      return releases.flat();
    },
  });

  const refreshQueue = async () => {
    await queueQuery.refetch();
    await mattersQuery.refetch();
  };

  const approveMutation = useMutation({
    mutationFn: async (releaseId: string) => api.post(`/api/v1/escrow/releases/${releaseId}/approve`),
    onSuccess: async () => {
      notifySuccess('Payout disetujui checker.');
      await refreshQueue();
    },
    onError: (error: any) => notifyError(error?.response?.data?.message || 'Gagal menyetujui payout.'),
  });

  const processMutation = useMutation({
    mutationFn: async (releaseId: string) => api.post(`/api/v1/escrow/releases/${releaseId}/process`),
    onSuccess: async () => {
      notifySuccess('Payout sedang diproses ke gateway transfer.');
      await refreshQueue();
    },
    onError: async (error: any) => {
      notifyError(error?.response?.data?.message || 'Gagal memproses payout.');
      await refreshQueue();
    },
  });

  const releases = Array.isArray(queueQuery.data) ? queueQuery.data : [];
  const pendingReleases = releases.filter((release: any) => ['requested', 'pending_checker', 'approved', 'processing'].includes(release.uiStatus));
  const history = releases.filter((release: any) => ['released', 'failed'].includes(release.uiStatus));
  const mismatchCount = pendingReleases.filter((release: any) => release.reconciliationMismatch).length;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <Landmark size={28} style={{ color: 'var(--color-emerald)' }} />
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Payout Queue</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Antrian checker, processing, dan hasil disbursement global.
          </p>
        </div>
      </div>

      {mismatchCount > 0 ? (
        <div style={{ padding: '1rem 1.15rem', borderRadius: '10px', border: '1px solid rgba(217,119,6,0.3)', background: 'rgba(217,119,6,0.08)', color: 'var(--color-gold)', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <AlertCircle size={18} />
          <span>Ada {mismatchCount} payout dengan mismatch rekonsiliasi. Aksi checker diblokir sampai mismatch diselesaikan.</span>
        </div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1.5rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Antrian Checker & Processing</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {pendingReleases.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Tidak ada payout pending.</div>
            ) : pendingReleases.map((release: any) => {
              const isMaker = release.createdByUserId && user?.id && release.createdByUserId === user.id;
              const isBlocked = isMaker || release.reconciliationMismatch;
              const actionLabel = release.uiStatus === 'approved' ? 'Disburse Transfer' : 'Setujui (Checker)';
              const canProcess = release.uiStatus === 'approved';
              return (
                <div key={release.id} style={{ padding: '1rem', background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border-glass)', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{release.matterTitle}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{release.matterCaseNumber}</div>
                    </div>
                    <strong>Rp {(release.amount || 0).toLocaleString('id-ID')}</strong>
                  </div>
                  <div style={{ marginTop: '0.35rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                    Maker: {release.createdByName || '-'} • Status: {release.uiStatus.toUpperCase()}
                  </div>
                  {isBlocked ? (
                    <div style={{ marginTop: '0.35rem', color: release.reconciliationMismatch ? 'var(--color-gold)' : '#fca5a5', fontSize: '0.75rem' }}>
                      {release.reconciliationMismatch ? 'Mismatch rekonsiliasi harus diselesaikan sebelum payout diproses.' : 'Anda tidak bisa menyetujui payout yang Anda buat sendiri.'}
                    </div>
                  ) : null}
                  <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      disabled={isBlocked || approveMutation.isPending || processMutation.isPending}
                      className={canProcess ? 'btn btn-accent-gold' : 'btn btn-primary'}
                      onClick={() => canProcess ? processMutation.mutate(release.id) : approveMutation.mutate(release.id)}
                    >
                      {actionLabel}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Riwayat Disbursement</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {history.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Belum ada riwayat disbursement.</div>
            ) : history.map((release: any) => (
              <div key={release.id} style={{ padding: '0.85rem 1rem', background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border-glass)', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                  <strong>Rp {(release.amount || 0).toLocaleString('id-ID')}</strong>
                  <span className={`badge ${release.uiStatus === 'released' ? 'badge-green' : 'badge-red'}`}>{release.uiStatus.toUpperCase()}</span>
                </div>
                <div style={{ marginTop: '0.35rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                  {release.matterTitle}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

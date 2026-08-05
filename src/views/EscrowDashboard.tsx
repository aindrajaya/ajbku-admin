import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { buildMatterListParams, extractMatterList } from '../lib/matters';
import { DollarSign, ShieldCheck, CreditCard, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';

export default function EscrowDashboard() {
  const { user } = useAuth();
  const [aggregatedStats, setAggregatedStats] = useState({ total: 0, locked: 0, released: 0 });
  const [pendingReleases, setPendingReleases] = useState<any[]>([]);
  const [historyReleases, setHistoryReleases] = useState<any[]>([]);
  const [isLoadingAll, setIsLoadingAll] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<'success' | 'error'>('success');

  const mattersQuery = useQuery({
    queryKey: ['matters-escrow-list'],
    queryFn: async () => {
      const res = await api.get<any[]>('/api/v1/matters', buildMatterListParams());
      return extractMatterList(res.data);
    },
  });

  const loadEscrowDetails = async () => {
    const matters = mattersQuery.data || [];
    if (matters.length === 0) {
      setAggregatedStats({ total: 0, locked: 0, released: 0 });
      setPendingReleases([]);
      setHistoryReleases([]);
      setIsLoadingAll(false);
      return;
    }

    setIsLoadingAll(true);
    let total = 0;
    let locked = 0;
    let released = 0;
    const nextPending: any[] = [];
    const nextHistory: any[] = [];

    await Promise.all(matters.map(async (matter) => {
      try {
        const [escrowRes, releasesRes] = await Promise.all([
          api.get<any>(`/api/v1/matters/${matter.id}/escrow`),
          api.get<any[]>(`/api/v1/matters/${matter.id}/escrow/releases`),
        ]);

        const escrow = escrowRes.data || {};
        const releases = Array.isArray(releasesRes.data) ? releasesRes.data : [];
        total += Number(escrow.totalAmount) || 0;
        locked += Number(escrow.pendingAmount) || 0;
        released += Number(escrow.releasedAmount) || 0;

        releases.forEach((release) => {
          const enriched = {
            ...release,
            matterId: matter.id,
            matterCaseNumber: matter.caseNumber || matter.matterNumber,
            matterTitle: matter.title,
            reconciliationMismatch: Boolean(release.reconciliationMismatch || escrow.reconciliationMismatch),
          };

          if (['pending', 'approved'].includes(release.status)) {
            nextPending.push(enriched);
          } else {
            nextHistory.push(enriched);
          }
        });
      } catch (error) {
        console.warn('Failed to load escrow details', matter.id, error);
      }
    }));

    setAggregatedStats({ total, locked, released });
    setPendingReleases(nextPending);
    setHistoryReleases(nextHistory);
    setIsLoadingAll(false);
  };

  useEffect(() => {
    void loadEscrowDetails();
  }, [mattersQuery.data]);

  const approveReleaseMutation = useMutation({
    mutationFn: async (releaseId: string) => api.post(`/api/v1/escrow/releases/${releaseId}/approve`),
    onSuccess: async () => {
      setFeedbackTone('success');
      setFeedback('Payout disetujui oleh checker dan ledger akan disegarkan.');
      await loadEscrowDetails();
    },
    onError: async (err: any) => {
      setFeedbackTone('error');
      setFeedback(err?.response?.data?.message || 'Gagal menyetujui payout.');
    },
  });

  const processReleaseMutation = useMutation({
    mutationFn: async (releaseId: string) => api.post(`/api/v1/escrow/releases/${releaseId}/process`),
    onSuccess: async () => {
      setFeedbackTone('success');
      setFeedback('Disbursement diproses dan ledger pelepasan dana telah diperbarui.');
      await loadEscrowDetails();
    },
    onError: async (err: any) => {
      setFeedbackTone('error');
      setFeedback(err?.response?.data?.message || 'Gagal memproses payout transfer.');
      await loadEscrowDetails();
    },
  });

  const mismatchCount = useMemo(
    () => pendingReleases.filter((release) => release.reconciliationMismatch).length,
    [pendingReleases]
  );

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <DollarSign size={28} style={{ color: 'var(--color-emerald)' }} />
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Pusat Escrow & Payout</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Maker-checker approval, status disbursement, dan ledger pelepasan escrow.
          </p>
        </div>
      </div>

      {feedback ? (
        <div style={{ padding: '0.9rem 1rem', borderRadius: '10px', border: `1px solid ${feedbackTone === 'success' ? 'rgba(16, 185, 129, 0.28)' : 'rgba(239, 68, 68, 0.24)'}`, background: feedbackTone === 'success' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)', color: feedbackTone === 'success' ? 'var(--color-emerald)' : '#f87171' }}>
          {feedback}
        </div>
      ) : null}

      {mismatchCount > 0 ? (
        <div style={{ padding: '1rem 1.15rem', borderRadius: '10px', border: '1px solid rgba(217,119,6,0.3)', background: 'rgba(217,119,6,0.08)', color: 'var(--color-gold)', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <AlertCircle size={18} />
          <span>Ada {mismatchCount} payout dengan mismatch rekonsiliasi. Aksi checker untuk item tersebut diblokir sampai mismatch selesai.</span>
        </div>
      ) : null}

      {isLoadingAll ? (
        <div style={{ textAlign: 'center', padding: '5rem', color: 'var(--text-muted)' }}>Mengagregasi dana escrow seluruh perkara aktif...</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
            <SummaryCard icon={<CreditCard size={24} style={{ color: 'var(--color-blue)' }} />} title="Total Masuk Escrow" value={aggregatedStats.total} tone="default" />
            <SummaryCard icon={<Clock size={24} style={{ color: 'var(--color-gold)' }} />} title="Dana Masih Tertahan" value={aggregatedStats.locked} tone="warning" />
            <SummaryCard icon={<CheckCircle2 size={24} style={{ color: 'var(--color-emerald)' }} />} title="Dana Dirilis" value={aggregatedStats.released} tone="success" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1.5rem' }}>
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '1.25rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem' }}>
                Antrian Persetujuan Payout
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {pendingReleases.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    <ShieldCheck size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.3 }} />
                    Tidak ada antrian pencairan dana pending.
                  </div>
                ) : pendingReleases.map((release) => {
                  const isMaker = release.createdByUserId && user?.id && release.createdByUserId === user.id;
                  const isBlocked = isMaker || release.reconciliationMismatch;
                  const buttonLabel = release.status === 'pending' ? 'Setujui (Checker)' : 'Disburse Transfer';
                  const disabledReason = release.reconciliationMismatch
                    ? 'Mismatch rekonsiliasi harus diselesaikan sebelum payout diproses.'
                    : isMaker
                      ? 'Anda tidak bisa menyetujui payout yang Anda buat sendiri.'
                      : '';

                  return (
                    <div key={release.id} style={{ padding: '1.25rem', backgroundColor: 'rgba(0,0,0,0.15)', border: '1px solid var(--border-glass)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-emerald)', fontFamily: 'monospace', fontWeight: 700 }}>{release.matterCaseNumber}</span>
                          <h4 style={{ fontSize: '0.95rem', fontWeight: 600 }}>{release.matterTitle}</h4>
                        </div>
                        <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-gold)' }}>Rp {(release.amount || 0).toLocaleString('id-ID')}</span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-glass)', paddingTop: '0.5rem' }}>
                        <span>Diajukan oleh: <strong>{release.createdByName || 'Finance Staff'}</strong></span>
                        <span>Status: <strong style={{ color: release.status === 'approved' ? 'var(--color-emerald)' : 'var(--color-gold)' }}>{String(release.status).toUpperCase()}</strong></span>
                      </div>

                      {disabledReason ? (
                        <div style={{ fontSize: '0.75rem', color: isMaker ? '#fca5a5' : 'var(--color-gold)' }}>{disabledReason}</div>
                      ) : null}

                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                        <button
                          disabled={isBlocked || approveReleaseMutation.isPending || processReleaseMutation.isPending}
                          title={disabledReason}
                          onClick={() => {
                            if (release.status === 'pending') {
                              approveReleaseMutation.mutate(release.id);
                            } else {
                              processReleaseMutation.mutate(release.id);
                            }
                          }}
                          className={release.status === 'pending' ? 'btn btn-primary' : 'btn btn-accent-gold'}
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                        >
                          {buttonLabel}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '1.5rem', maxHeight: '500px', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '1.25rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem' }}>
                Ledger & Riwayat
              </h3>

              <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {historyReleases.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Belum ada riwayat transfer disetujui.</div>
                ) : historyReleases.map((release) => (
                  <div key={release.id} style={{ padding: '0.75rem 1rem', backgroundColor: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)', borderRadius: '6px', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: 600 }}>Rp {(release.amount || 0).toLocaleString('id-ID')}</span>
                      <span className={`badge ${release.status === 'failed' ? 'badge-red' : 'badge-green'}`} style={{ fontSize: '0.6rem' }}>
                        {String(release.status || 'released').toUpperCase()}
                      </span>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', margin: 0 }}>Perkara: {release.matterTitle}</p>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      Checker: {release.approvedByName || '-'} • {release.updatedAt ? new Date(release.updatedAt).toLocaleDateString('id-ID') : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({ icon, title, value, tone }: { icon: React.ReactNode; title: string; value: number; tone: 'default' | 'warning' | 'success' }) {
  const color = tone === 'warning' ? 'var(--color-gold)' : tone === 'success' ? 'var(--color-emerald)' : 'var(--text-primary)';

  return (
    <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(255,255,255,0.04)', display: 'grid', placeItems: 'center' }}>
        {icon}
      </div>
      <div>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{title}</span>
        <strong style={{ fontSize: '1.4rem', fontWeight: 700, display: 'block', color }}>
          Rp {value.toLocaleString('id-ID')}
        </strong>
      </div>
    </div>
  );
}

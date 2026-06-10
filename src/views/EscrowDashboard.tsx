import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, tokenManager } from '../api/client';
import { DollarSign, ShieldCheck, CreditCard, Clock, CheckCircle2, User, AlertCircle, FileText } from 'lucide-react';

export default function EscrowDashboard() {
  const queryClient = useQueryClient();

  const [aggregatedStats, setAggregatedStats] = useState({
    total: 0,
    locked: 0,
    released: 0
  });

  const [pendingReleases, setPendingReleases] = useState<any[]>([]);
  const [completedReleases, setCompletedReleases] = useState<any[]>([]);
  const [isLoadingAll, setIsLoadingAll] = useState(true);

  // Load matters list
  const { data: matters = [] } = useQuery({
    queryKey: ['matters-escrow-list'],
    queryFn: async () => {
      const res = await api.get('/api/v1/matters');
      return Array.isArray(res.data) ? res.data : res.data?.data || [];
    }
  });

  const loadEscrowDetails = async () => {
    if (matters.length === 0) {
      setIsLoadingAll(false);
      return;
    }
    
    setIsLoadingAll(true);
    let totalAmt = 0;
    let lockedAmt = 0;
    let releasedAmt = 0;
    const pendingList: any[] = [];
    const completedList: any[] = [];

    try {
      // Aggregate details per matter concurrently
      await Promise.all(
        matters.map(async (m: any) => {
          try {
            // Get Escrow position
            const escRes = await api.get(`/api/v1/matters/${m.id}/escrow`);
            const esc = escRes.data?.data || escRes.data || {};
            
            totalAmt += Number(esc.totalAmount) || 0;
            lockedAmt += Number(esc.pendingAmount) || 0;
            releasedAmt += Number(esc.releasedAmount) || 0;

            // Get Releases list
            const relRes = await api.get(`/api/v1/matters/${m.id}/escrow/releases`);
            const relList = Array.isArray(relRes.data) ? relRes.data : relRes.data?.data || [];

            relList.forEach((r: any) => {
              const enrichedRelease = {
                ...r,
                matterId: m.id,
                matterCaseNumber: m.caseNumber || m.matterNumber,
                matterTitle: m.title
              };
              if (r.status === 'pending' || r.status === 'approved') {
                pendingList.push(enrichedRelease);
              } else {
                completedList.push(enrichedRelease);
              }
            });
          } catch (e) {
            console.warn(`Failed to load escrow details for matter ${m.id}`, e);
          }
        })
      );

      setAggregatedStats({ total: totalAmt, locked: lockedAmt, released: releasedAmt });
      setPendingReleases(pendingList);
      setCompletedReleases(completedList);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingAll(false);
    }
  };

  useEffect(() => {
    if (matters.length > 0) {
      loadEscrowDetails();
    } else {
      setIsLoadingAll(false);
    }
  }, [matters]);

  // Mutations
  const approveReleaseMutation = useMutation({
    mutationFn: async (releaseId: string) => {
      await api.post(`/api/v1/escrow/releases/${releaseId}/approve`);
    },
    onSuccess: () => {
      loadEscrowDetails();
      alert('Pencairan dana disetujui (Checker).');
    },
    onError: (err: any) => {
      if (err.message.includes('SAME_USER')) {
        alert('BATASAN ROLE: Anda tidak boleh menjadi Maker sekaligus Checker untuk satu transaksi payout!');
      } else {
        alert('Gagal menyetujui payout.');
      }
    }
  });

  const processReleaseMutation = useMutation({
    mutationFn: async (releaseId: string) => {
      await api.post(`/api/v1/escrow/releases/${releaseId}/process`);
    },
    onSuccess: () => {
      loadEscrowDetails();
      alert('Dana disalurkan (Disbursed) ke rekening tujuan.');
    },
    onError: () => {
      alert('Gagal memproses payout transfer.');
    }
  });

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <DollarSign size={28} style={{ color: 'var(--color-emerald)' }} />
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Pusat Escrow & Payout (Checker)</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Maker-Checker Hub: Verifikasi persetujuan pengeluaran dana escrow pertanahan.
          </p>
        </div>
      </div>

      {isLoadingAll ? (
        <div style={{ textAlign: 'center', padding: '5rem', color: 'var(--text-muted)' }}>
          Mengagregasi dana escrow seluruh perkara aktif...
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '1.5rem'
          }}>
            <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CreditCard size={24} style={{ color: 'var(--color-blue)' }} />
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total Masuk Escrow</span>
                <strong style={{ fontSize: '1.4rem', fontWeight: 700, display: 'block' }}>
                  Rp {aggregatedStats.total.toLocaleString('id-ID')}
                </strong>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(217,119,6,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Clock size={24} style={{ color: 'var(--color-gold)' }} />
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Dana Masih Tertahan (Locked)</span>
                <strong style={{ fontSize: '1.4rem', fontWeight: 700, display: 'block', color: 'var(--color-gold)' }}>
                  Rp {aggregatedStats.locked.toLocaleString('id-ID')}
                </strong>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle2 size={24} style={{ color: 'var(--color-emerald)' }} />
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Dana Sukses Disalurkan</span>
                <strong style={{ fontSize: '1.4rem', fontWeight: 700, display: 'block', color: 'var(--color-emerald)' }}>
                  Rp {aggregatedStats.released.toLocaleString('id-ID')}
                </strong>
              </div>
            </div>
          </div>

          {/* Maker-Checker Approvals Queue */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1.5rem' }}>
            
            {/* Left Column: Approvals list */}
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '1.25rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem' }}>
                Antrian Persetujuan Payout (Checker)
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {pendingReleases.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    <ShieldCheck size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.3 }} />
                    Tidak ada antrian pencairan dana pending.
                  </div>
                ) : (
                  pendingReleases.map((r: any) => (
                    <div 
                      key={r.id}
                      style={{
                        padding: '1.25rem',
                        backgroundColor: 'rgba(0,0,0,0.15)',
                        border: '1px solid var(--border-glass)',
                        borderRadius: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-emerald)', fontFamily: 'monospace', fontWeight: 700 }}>
                            {r.matterCaseNumber}
                          </span>
                          <h4 style={{ fontSize: '0.95rem', fontWeight: 600 }}>{r.matterTitle}</h4>
                        </div>
                        <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-gold)' }}>
                          Rp {(r.amount || 0).toLocaleString('id-ID')}
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-glass)', paddingTop: '0.5rem' }}>
                        <span>Diajukan oleh (Maker): <strong>{r.createdByName || 'Finance Staff'}</strong></span>
                        <span>Status: <strong style={{ color: 'var(--color-gold)' }}>{r.status.toUpperCase()}</strong></span>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                        {r.status === 'pending' ? (
                          <button 
                            onClick={() => approveReleaseMutation.mutate(r.id)}
                            className="btn btn-primary" 
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                          >
                            Setujui (Checker)
                          </button>
                        ) : (
                          <button 
                            onClick={() => processReleaseMutation.mutate(r.id)}
                            className="btn btn-accent-gold" 
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                          >
                            Disburse Transfer
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right Column: Ledger history */}
            <div className="glass-panel" style={{ padding: '1.5rem', maxHeight: '500px', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '1.25rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem' }}>
                Riwayat Ledger Pencairan (Disbursed)
              </h3>

              <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {completedReleases.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    Belum ada riwayat transfer disetujui.
                  </div>
                ) : (
                  completedReleases.map((r: any) => (
                    <div 
                      key={r.id}
                      style={{
                        padding: '0.75rem 1rem',
                        backgroundColor: 'rgba(255,255,255,0.01)',
                        border: '1px solid var(--border-glass)',
                        borderRadius: '6px',
                        fontSize: '0.8rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                        <span style={{ fontWeight: 600 }}>Rp {(r.amount || 0).toLocaleString('id-ID')}</span>
                        <span className="badge badge-green" style={{ fontSize: '0.6rem' }}>SUCCESS</span>
                      </div>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', margin: 0 }}>
                        Perkara: {r.matterTitle}
                      </p>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        Checker: {r.approvedByName || 'Principal'} • {r.updatedAt ? new Date(r.updatedAt).toLocaleDateString('id-ID') : ''}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </>
      )}

    </div>
  );
}

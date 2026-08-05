import React, { useMemo, useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, DollarSign } from 'lucide-react';
import { api } from '../api/client';
import { notifyError, notifySuccess } from '../store/ui';

function normalizeReleaseStatus(status: string) {
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

export default function MatterEscrow() {
  const { id: matterId } = useParams({ strict: false }) as { id: string };
  const queryClient = useQueryClient();
  const [releaseAmount, setReleaseAmount] = useState('');
  const [selectedMilestone, setSelectedMilestone] = useState('');

  const escrowQuery = useQuery({
    queryKey: ['matters', matterId, 'escrow'],
    queryFn: async () => (await api.get(`/api/v1/matters/${matterId}/escrow`)).data,
  });

  const releasesQuery = useQuery({
    queryKey: ['matters', matterId, 'escrow', 'releases'],
    queryFn: async () => {
      const res = await api.get(`/api/v1/matters/${matterId}/escrow/releases`);
      const rows = Array.isArray(res.data) ? res.data : res.data?.data || [];
      return rows.map((row: any) => ({ ...row, uiStatus: normalizeReleaseStatus(row.status) }));
    },
  });

  const safeEscrow = (escrowQuery.data as any) || {};
  const milestones = Array.isArray(safeEscrow.milestones) ? safeEscrow.milestones : [];
  const releases = Array.isArray(releasesQuery.data) ? releasesQuery.data : [];
  const hasMismatch = releases.some((release: any) => release.reconciliationMismatch);

  const createReleaseMutation = useMutation({
    mutationFn: async () => api.post(`/api/v1/matters/${matterId}/escrow/releases`, {
      amount: Number(releaseAmount),
      milestoneId: selectedMilestone,
    }),
    onSuccess: async () => {
      setReleaseAmount('');
      setSelectedMilestone('');
      await releasesQuery.refetch();
      notifySuccess('Permintaan payout maker berhasil diajukan.');
    },
    onError: () => notifyError('Gagal membuat payout request.'),
  });

  const ledgerRows = useMemo(() => releases.filter((release: any) => ['released', 'failed'].includes(release.uiStatus)), [releases]);

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <DollarSign size={28} style={{ color: 'var(--color-emerald)' }} />
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Escrow Per Matter</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Ledger, milestone, dan maker request untuk payout matter ini.</p>
        </div>
      </div>

      {hasMismatch ? (
        <div style={{ padding: '1rem 1.15rem', borderRadius: '10px', border: '1px solid rgba(217,119,6,0.3)', background: 'rgba(217,119,6,0.08)', color: 'var(--color-gold)', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <AlertCircle size={18} />
          <span>Ada mismatch rekonsiliasi. Payout checker akan diblokir sampai mismatch diselesaikan.</span>
        </div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
        <SummaryCard title="Total Dana Escrow" value={safeEscrow.totalAmount || 0} tone="default" />
        <SummaryCard title="Dana Terkunci" value={safeEscrow.pendingAmount || 0} tone="warning" />
        <SummaryCard title="Dana Dirilis" value={safeEscrow.releasedAmount || 0} tone="success" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Milestone Escrow</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {milestones.map((milestone: any) => (
              <div key={milestone.id} style={{ padding: '1rem', background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border-glass)', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                  <strong>{milestone.name}</strong>
                  <span className={`badge ${milestone.status === 'approved' ? 'badge-green' : milestone.status === 'eligible' ? 'badge-yellow' : 'badge-gray'}`}>
                    {String(milestone.status).toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Maker Request</h3>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">Milestone Approved</label>
            <select value={selectedMilestone} onChange={(e) => setSelectedMilestone(e.target.value)} className="input-field select-field">
              <option value="">Pilih milestone</option>
              {milestones.filter((milestone: any) => milestone.status === 'approved').map((milestone: any) => (
                <option key={milestone.id} value={milestone.id}>{milestone.name}</option>
              ))}
            </select>
          </div>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">Nominal Transfer (Rp)</label>
            <input type="number" value={releaseAmount} onChange={(e) => setReleaseAmount(e.target.value)} className="input-field" />
          </div>
          <button disabled={!selectedMilestone || !releaseAmount || hasMismatch || createReleaseMutation.isPending} onClick={() => createReleaseMutation.mutate()} className="btn btn-accent-gold">
            Ajukan Transfer
          </button>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Ledger Matter</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {ledgerRows.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Belum ada ledger release/failure untuk matter ini.</div>
          ) : ledgerRows.map((row: any) => (
            <div key={row.id} style={{ padding: '0.9rem 1rem', background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border-glass)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                <strong>Rp {(row.amount || 0).toLocaleString('id-ID')}</strong>
                <span className={`badge ${row.uiStatus === 'released' ? 'badge-green' : 'badge-red'}`}>{row.uiStatus.toUpperCase()}</span>
              </div>
              <div style={{ marginTop: '0.25rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                Maker: {row.createdByName || '-'} • Checker: {row.approvedByName || '-'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ title, value, tone }: { title: string; value: number; tone: 'default' | 'warning' | 'success' }) {
  const color = tone === 'warning' ? 'var(--color-gold)' : tone === 'success' ? 'var(--color-emerald)' : 'var(--text-primary)';
  return (
    <div className="glass-panel" style={{ padding: '1.25rem' }}>
      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{title}</span>
      <strong style={{ fontSize: '1.4rem', color, display: 'block' }}>Rp {Number(value || 0).toLocaleString('id-ID')}</strong>
    </div>
  );
}

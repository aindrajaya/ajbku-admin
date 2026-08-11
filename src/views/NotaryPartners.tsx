import React, { useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Filter, RotateCcw, Search, UserCheck, XCircle } from 'lucide-react';
import {
  canAssignNotaryPartner,
  formatCoverageAreas,
  getNotaryPartnerStatusMeta,
  getSlaLabel,
  getWorkloadLabel,
  listNotaryPartners,
  type NotaryPartner,
  type NotaryPartnerApprovalStatus,
  type NotaryPartnerStatus,
  updateNotaryPartnerStatus,
} from '../lib/notaryPartners';
import { queryKeys } from '../lib/queryKeys';
import { notifyError, notifySuccess } from '../store/ui';

type StatusFilter = 'all' | 'pending_approval' | 'approved' | 'rejected';

const statusFilters: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'Semua Status' },
  { value: 'pending_approval', label: 'Pending Approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

export default function NotaryPartners() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [rejectTarget, setRejectTarget] = useState<NotaryPartner | null>(null);

  const partnerParams = useMemo(
    () => (statusFilter === 'all' ? {} : { status: statusFilter as NotaryPartnerStatus }),
    [statusFilter]
  );

  const partnersQuery = useQuery({
    queryKey: queryKeys.notaryPartners(partnerParams),
    queryFn: () => listNotaryPartners(partnerParams),
  });

  const partners = Array.isArray(partnersQuery.data) ? partnersQuery.data : [];
  const normalizedSearch = search.trim().toLowerCase();

  const filteredPartners = useMemo(() => {
    if (!normalizedSearch) return partners;
    return partners.filter((partner) => {
      const haystack = [
        partner.fullName,
        partner.licenseNumber,
        partner.jurisdictionCity,
        partner.jurisdictionProvince,
        formatCoverageAreas(partner.coverageAreas),
      ].join(' ').toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [normalizedSearch, partners]);

  const metrics = useMemo(() => ({
    pending: partners.filter((partner) => partner.status === 'pending_approval').length,
    approved: partners.filter((partner) => partner.status === 'approved').length,
    rejectedOrSuspended: partners.filter((partner) => partner.status === 'rejected' || partner.status === 'suspended').length,
  }), [partners]);

  const statusMutation = useMutation({
    mutationFn: ({ notaryProfileId, status }: { notaryProfileId: string; status: NotaryPartnerApprovalStatus }) =>
      updateNotaryPartnerStatus(notaryProfileId, status),
    onSuccess: async (_, variables) => {
      setRejectTarget(null);
      await queryClient.invalidateQueries({
        predicate: (query) => Array.isArray(query.queryKey) && query.queryKey[0] === 'notary-partners',
      });
      notifySuccess(
        variables.status === 'approved'
          ? 'Notaris mitra berhasil di-approve.'
          : 'Notaris mitra berhasil di-reject.'
      );
    },
    onError: (error: any) => notifyError(error?.response?.data?.message || error?.message || 'Gagal memperbarui status notaris mitra.'),
  });

  const resetFilters = () => {
    setStatusFilter('all');
    setSearch('');
  };

  const requestStatusChange = (partner: NotaryPartner, status: NotaryPartnerApprovalStatus) => {
    statusMutation.mutate({ notaryProfileId: partner.notaryProfileId, status });
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <UserCheck size={28} style={{ color: 'var(--color-emerald)' }} />
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Notaris Mitra</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Review dan kelola approval notaris mitra PT sebelum digunakan dalam matching internal.
            </p>
          </div>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => void partnersQuery.refetch()} disabled={partnersQuery.isFetching}>
          <RotateCcw size={16} />
          {partnersQuery.isFetching ? 'Memuat...' : 'Refresh'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <MetricCard title="Pending Approval" value={metrics.pending} tone="warning" />
        <MetricCard title="Approved" value={metrics.approved} tone="success" />
        <MetricCard title="Rejected / Suspended" value={metrics.rejectedOrSuspended} tone="danger" />
      </div>

      <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem' }}>
          <Filter size={16} style={{ color: 'var(--color-gold)' }} />
          <span style={{ fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Filter Notaris Mitra</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '220px minmax(260px, 1fr) auto', gap: '1rem', alignItems: 'end' }}>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label" style={{ fontSize: '0.75rem' }}>Status</label>
            <select
              className="input-field select-field"
              style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            >
              {statusFilters.map((item) => (
                <option key={item.value} value={item.value} style={{ background: 'var(--bg-secondary)' }}>{item.label}</option>
              ))}
            </select>
          </div>

          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label" style={{ fontSize: '0.75rem' }}>Cari</label>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="input-field"
                style={{ padding: '0.5rem 1rem 0.5rem 2rem', fontSize: '0.85rem' }}
                placeholder="Cari nama, lisensi, kota, atau coverage"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>

          <button type="button" className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', justifyContent: 'center' }} onClick={resetFilters}>
            <RotateCcw size={14} />
            Reset
          </button>
        </div>
      </div>

      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem', fontFamily: 'var(--font-sans)' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-glass)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '1rem 1.25rem', fontWeight: 600 }}>Notaris</th>
              <th style={{ padding: '1rem 1.25rem', fontWeight: 600 }}>Lisensi & Kontak</th>
              <th style={{ padding: '1rem 1.25rem', fontWeight: 600 }}>Jurisdiksi</th>
              <th style={{ padding: '1rem 1.25rem', fontWeight: 600 }}>Coverage</th>
              <th style={{ padding: '1rem 1.25rem', fontWeight: 600 }}>Workload / SLA</th>
              <th style={{ padding: '1rem 1.25rem', fontWeight: 600 }}>Status</th>
              <th style={{ padding: '1rem 1.25rem', fontWeight: 600 }}>Assignment</th>
              <th style={{ padding: '1rem 1.25rem', fontWeight: 600, textAlign: 'right' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {partnersQuery.isLoading ? (
              <tr>
                <td colSpan={8} style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Memuat notaris mitra...
                </td>
              </tr>
            ) : filteredPartners.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  {partners.length === 0 ? 'Belum ada notaris mitra pada status ini.' : 'Tidak ada notaris mitra yang cocok dengan pencarian.'}
                </td>
              </tr>
            ) : (
              filteredPartners.map((partner) => {
                const statusMeta = getNotaryPartnerStatusMeta(partner.status);
                const canAssign = canAssignNotaryPartner(partner);
                const isMutatingThisPartner = statusMutation.isPending && statusMutation.variables?.notaryProfileId === partner.notaryProfileId;

                return (
                  <tr key={partner.notaryProfileId} style={{ borderBottom: '1px solid var(--border-glass)' }}>
                    <td style={{ padding: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>{partner.fullName}</td>
                    <td style={{ padding: '1.25rem', color: 'var(--text-secondary)' }}>
                      <div style={{ fontFamily: 'monospace', color: 'var(--color-emerald)', fontWeight: 700 }}>{partner.licenseNumber}</div>
                      <div style={{ marginTop: '0.35rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{partner.email} • {partner.phone}</div>
                    </td>
                    <td style={{ padding: '1.25rem', color: 'var(--text-secondary)' }}>
                      {[partner.jurisdictionCity, partner.jurisdictionProvince].filter(Boolean).join(', ') || '-'}
                    </td>
                    <td style={{ padding: '1.25rem', color: 'var(--text-secondary)', maxWidth: '260px' }}>
                      {formatCoverageAreas(partner.coverageAreas)}
                    </td>
                    <td style={{ padding: '1.25rem', color: 'var(--text-secondary)' }}>
                      <div>{getWorkloadLabel(partner.activeMattersCount)}</div>
                      <div style={{ marginTop: '0.3rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{getSlaLabel(partner.slaPerformanceScore)}</div>
                    </td>
                    <td style={{ padding: '1.25rem' }}>
                      <span className={`badge ${statusMeta.className}`}>{statusMeta.label}</span>
                    </td>
                    <td style={{ padding: '1.25rem' }}>
                      <span className={`badge ${canAssign ? 'badge-green' : 'badge-gray'}`}>
                        {canAssign ? 'Siap Assignment' : 'Tidak Aktif'}
                      </span>
                    </td>
                    <td style={{ padding: '1.25rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                        <Link
                          to="/notary-partners/$id"
                          params={{ id: partner.notaryProfileId }}
                          className="btn btn-secondary"
                          style={{ padding: '0.35rem 0.7rem', fontSize: '0.78rem' }}
                        >
                          Buka Detail
                        </Link>
                        {partner.status !== 'approved' ? (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            disabled={isMutatingThisPartner}
                            onClick={() => requestStatusChange(partner, 'approved')}
                            style={{ padding: '0.35rem 0.7rem', fontSize: '0.78rem' }}
                          >
                            <CheckCircle2 size={14} />
                            Approve
                          </button>
                        ) : null}
                        {partner.status !== 'rejected' ? (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            disabled={isMutatingThisPartner}
                            onClick={() => setRejectTarget(partner)}
                            style={{ padding: '0.35rem 0.7rem', fontSize: '0.78rem', border: '1px solid rgba(239,68,68,0.35)', color: '#fca5a5' }}
                          >
                            <XCircle size={14} />
                            Reject
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {rejectTarget ? (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', display: 'grid', placeItems: 'center', zIndex: 140 }}>
          <div className="glass-panel animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="reject-notary-title" style={{ width: '420px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 id="reject-notary-title" style={{ fontSize: '1rem', fontWeight: 700 }}>Reject Notaris Mitra</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5 }}>
              Status <strong>{rejectTarget.fullName}</strong> akan diubah menjadi rejected. Backend saat ini belum menerima alasan rejection.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setRejectTarget(null)} disabled={statusMutation.isPending}>
                Batal
              </button>
              <button type="button" className="btn btn-primary" onClick={() => requestStatusChange(rejectTarget, 'rejected')} disabled={statusMutation.isPending}>
                {statusMutation.isPending ? 'Menyimpan...' : 'Konfirmasi Reject'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MetricCard({ title, value, tone }: { title: string; value: number; tone: 'warning' | 'success' | 'danger' }) {
  const palette = {
    warning: { border: 'rgba(217,119,6,0.25)', color: 'var(--color-gold)', bg: 'rgba(217,119,6,0.06)' },
    success: { border: 'rgba(16,185,129,0.25)', color: 'var(--color-emerald)', bg: 'rgba(16,185,129,0.06)' },
    danger: { border: 'rgba(239,68,68,0.25)', color: '#fca5a5', bg: 'rgba(239,68,68,0.06)' },
  }[tone];

  return (
    <div className="glass-panel" style={{ padding: '1.25rem', border: `1px solid ${palette.border}`, background: palette.bg }}>
      <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '0.35rem' }}>{title}</div>
      <div style={{ color: palette.color, fontSize: '1.8rem', fontWeight: 800, lineHeight: 1 }}>{value}</div>
    </div>
  );
}

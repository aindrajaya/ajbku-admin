import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BadgeDollarSign, Filter, RotateCcw, Search } from 'lucide-react';
import {
  formatCurrencyIdr,
  getNotaryPayoutStatusMeta,
  listNotaryPayouts,
  type NotaryPayoutStatus,
} from '../lib/notaryPartners';
import { queryKeys } from '../lib/queryKeys';

type StatusFilter = 'all' | NotaryPayoutStatus;

const statusFilters: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'Semua Status' },
  { value: 'pending', label: 'Pending' },
  { value: 'paid', label: 'Paid' },
  { value: 'cancelled', label: 'Cancelled' },
];

function formatDate(value: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export default function NotaryPayouts() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');

  const payoutParams = useMemo(
    () => (statusFilter === 'all' ? {} : { status: statusFilter }),
    [statusFilter]
  );

  const payoutsQuery = useQuery({
    queryKey: queryKeys.notaryPayouts(payoutParams),
    queryFn: () => listNotaryPayouts(payoutParams),
  });

  const payouts = Array.isArray(payoutsQuery.data) ? payoutsQuery.data : [];
  const normalizedSearch = search.trim().toLowerCase();

  const filteredPayouts = useMemo(() => {
    if (!normalizedSearch) return payouts;
    return payouts.filter((payout) => {
      const statusMeta = getNotaryPayoutStatusMeta(payout.status);
      const haystack = [
        payout.matterId,
        payout.matterTitle,
        payout.notaryProfileId,
        payout.notaryName,
        String(payout.amount),
        formatCurrencyIdr(payout.amount),
        statusMeta.label,
      ].join(' ').toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [normalizedSearch, payouts]);

  const metrics = useMemo(() => ({
    pending: payouts.filter((payout) => payout.status === 'pending').length,
    paid: payouts.filter((payout) => payout.status === 'paid').length,
    cancelled: payouts.filter((payout) => payout.status === 'cancelled').length,
  }), [payouts]);

  const resetFilters = () => {
    setStatusFilter('all');
    setSearch('');
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <BadgeDollarSign size={28} style={{ color: 'var(--color-emerald)' }} />
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Notary Payouts</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Monitoring payout internal AJBKu ke notaris mitra, terpisah dari escrow release client.
            </p>
          </div>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => void payoutsQuery.refetch()} disabled={payoutsQuery.isFetching}>
          <RotateCcw size={16} />
          {payoutsQuery.isFetching ? 'Memuat...' : 'Refresh'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <MetricCard title="Pending" value={metrics.pending} tone="warning" />
        <MetricCard title="Paid" value={metrics.paid} tone="success" />
        <MetricCard title="Cancelled" value={metrics.cancelled} tone="muted" />
      </div>

      <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem' }}>
          <Filter size={16} style={{ color: 'var(--color-gold)' }} />
          <span style={{ fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Filter Notary Payout</span>
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
                placeholder="Cari matter, notaris, amount, atau status"
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
              <th style={{ padding: '1rem 1.25rem', fontWeight: 600 }}>Matter</th>
              <th style={{ padding: '1rem 1.25rem', fontWeight: 600 }}>Notaris</th>
              <th style={{ padding: '1rem 1.25rem', fontWeight: 600 }}>Amount</th>
              <th style={{ padding: '1rem 1.25rem', fontWeight: 600 }}>Status</th>
              <th style={{ padding: '1rem 1.25rem', fontWeight: 600 }}>Created</th>
              <th style={{ padding: '1rem 1.25rem', fontWeight: 600 }}>Paid</th>
            </tr>
          </thead>
          <tbody>
            {payoutsQuery.isLoading ? (
              <tr>
                <td colSpan={6} style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Memuat notary payouts...
                </td>
              </tr>
            ) : filteredPayouts.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  {payouts.length === 0 ? 'Belum ada notary payout pada status ini.' : 'Tidak ada notary payout yang cocok dengan pencarian.'}
                </td>
              </tr>
            ) : (
              filteredPayouts.map((payout) => {
                const statusMeta = getNotaryPayoutStatusMeta(payout.status);
                return (
                  <tr key={payout.id || `${payout.matterId}-${payout.notaryProfileId}`} style={{ borderBottom: '1px solid var(--border-glass)' }}>
                    <td style={{ padding: '1.25rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                      <div>{payout.matterTitle}</div>
                      <div style={{ marginTop: '0.35rem', fontFamily: 'monospace', color: 'var(--text-muted)', fontSize: '0.78rem' }}>{payout.matterId}</div>
                    </td>
                    <td style={{ padding: '1.25rem', color: 'var(--text-secondary)' }}>
                      <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{payout.notaryName}</div>
                      <div style={{ marginTop: '0.35rem', fontFamily: 'monospace', color: 'var(--text-muted)', fontSize: '0.78rem' }}>{payout.notaryProfileId}</div>
                    </td>
                    <td style={{ padding: '1.25rem', color: 'var(--color-emerald)', fontWeight: 800 }}>{formatCurrencyIdr(payout.amount)}</td>
                    <td style={{ padding: '1.25rem' }}>
                      <span className={`badge ${statusMeta.className}`}>{statusMeta.label}</span>
                    </td>
                    <td style={{ padding: '1.25rem', color: 'var(--text-secondary)' }}>{formatDate(payout.createdAt)}</td>
                    <td style={{ padding: '1.25rem', color: 'var(--text-secondary)' }}>{formatDate(payout.paidAt)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MetricCard({ title, value, tone }: { title: string; value: number; tone: 'warning' | 'success' | 'muted' }) {
  const palette = {
    warning: { border: 'rgba(217,119,6,0.25)', color: 'var(--color-gold)', bg: 'rgba(217,119,6,0.06)' },
    success: { border: 'rgba(16,185,129,0.25)', color: 'var(--color-emerald)', bg: 'rgba(16,185,129,0.06)' },
    muted: { border: 'rgba(148,163,184,0.24)', color: 'var(--text-secondary)', bg: 'rgba(148,163,184,0.06)' },
  }[tone];

  return (
    <div className="glass-panel" style={{ padding: '1.25rem', border: `1px solid ${palette.border}`, background: palette.bg }}>
      <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '0.35rem' }}>{title}</div>
      <div style={{ color: palette.color, fontSize: '1.8rem', fontWeight: 800, lineHeight: 1 }}>{value}</div>
    </div>
  );
}

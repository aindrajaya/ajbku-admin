import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { History, Search, Filter } from 'lucide-react';

export default function AuditTrail() {
  const [aggregateType, setAggregateType] = useState('all');
  const [actorUserId, setActorUserId] = useState('');
  const [aggregateId, setAggregateId] = useState('');

  // Fetch audit events
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['audit-events', { aggregateType, actorUserId, aggregateId }],
    queryFn: async () => {
      const res = await api.get('/api/v1/audit-events', {
        aggregateType: aggregateType !== 'all' ? aggregateType : undefined,
        actorUserId: actorUserId || undefined,
        aggregateId: aggregateId || undefined
      });
      return Array.isArray(res.data) ? res.data : res.data?.data || [];
    }
  });

  const safeEvents = Array.isArray(events) ? events : [];

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <History size={28} style={{ color: 'var(--color-emerald)' }} />
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Log Audit Sistem</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Rekaman aktivitas log security-audit atas seluruh aksi mutasi berkas, penugasan Notaris, dan escrow disbursement.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="glass-panel" style={{ padding: '1.25rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'end' }}>
        
        <div className="input-group" style={{ marginBottom: 0 }}>
          <label className="input-label" style={{ fontSize: '0.75rem' }}>Tipe Entity</label>
          <select 
            value={aggregateType} 
            onChange={(e) => setAggregateType(e.target.value)}
            className="input-field select-field"
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
          >
            <option value="all">Semua Tipe</option>
            <option value="matter" style={{ background: 'var(--bg-secondary)' }}>Matter (Perkara)</option>
            <option value="document" style={{ background: 'var(--bg-secondary)' }}>Document (Berkas)</option>
            <option value="escrow" style={{ background: 'var(--bg-secondary)' }}>Escrow (Dana)</option>
            <option value="tenant" style={{ background: 'var(--bg-secondary)' }}>Tenant (Kantor)</option>
          </select>
        </div>

        <div className="input-group" style={{ marginBottom: 0 }}>
          <label className="input-label" style={{ fontSize: '0.75rem' }}>ID Perkara / Dokumen</label>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              value={aggregateId}
              onChange={(e) => setAggregateId(e.target.value)}
              className="input-field" 
              placeholder="UUID / Code ID" 
              style={{ padding: '0.5rem 1rem 0.5rem 2rem', fontSize: '0.85rem' }}
            />
          </div>
        </div>

        <div className="input-group" style={{ marginBottom: 0 }}>
          <label className="input-label" style={{ fontSize: '0.75rem' }}>Actor User ID</label>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              value={actorUserId}
              onChange={(e) => setActorUserId(e.target.value)}
              className="input-field" 
              placeholder="UUID User" 
              style={{ padding: '0.5rem 1rem 0.5rem 2rem', fontSize: '0.85rem' }}
            />
          </div>
        </div>

      </div>

      {/* Events Log Table */}
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-glass)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>Waktu</th>
              <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>Tipe Entity</th>
              <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>Aksi</th>
              <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>Detail Riwayat</th>
              <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>Pelaksana</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Memuat riwayat log...</td>
              </tr>
            ) : safeEvents.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Tidak ada catatan log audit yang cocok.</td>
              </tr>
            ) : (
              safeEvents.map((evt: any) => (
                <tr 
                  key={evt.id} 
                  style={{ borderBottom: '1px solid var(--border-glass)' }}
                >
                  <td style={{ padding: '1rem 1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {new Date(evt.createdAt).toLocaleString('id-ID')}
                  </td>
                  <td style={{ padding: '1rem 1.5rem' }}>
                    <span className="badge badge-gray" style={{ fontSize: '0.65rem' }}>{evt.aggregateType}</span>
                  </td>
                  <td style={{ padding: '1rem 1.5rem', fontWeight: 600, color: 'var(--color-gold)' }}>
                    {evt.action}
                  </td>
                  <td style={{ padding: '1rem 1.5rem', color: 'var(--text-primary)' }}>
                    {evt.details}
                  </td>
                  <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', fontWeight: 600 }}>
                    {evt.actorName}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}

import React, { useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { MapPinned } from 'lucide-react';
import { api } from '../api/client';
import { notifyError, notifySuccess } from '../store/ui';

export default function MatterBpn() {
  const { id: matterId } = useParams({ strict: false }) as { id: string };
  const [bpnTitle, setBpnTitle] = useState('');
  const [bpnNotes, setBpnNotes] = useState('');
  const [bpnRef, setBpnRef] = useState('');
  const [bpnStep, setBpnStep] = useState<'submitted' | 'received' | 'juridical_review' | 'bookkeeping' | 'completed'>('submitted');

  const logsQuery = useQuery({
    queryKey: ['matters', matterId, 'bpn'],
    queryFn: async () => {
      const res = await api.get(`/api/v1/matters/${matterId}/bpn-steps`);
      return Array.isArray(res.data) ? res.data : (res.data as any)?.data || [];
    },
  });

  const addStepMutation = useMutation({
    mutationFn: async () => api.post(`/api/v1/matters/${matterId}/bpn-steps`, {
      stepCode: bpnStep,
      title: bpnTitle || undefined,
      notes: bpnNotes || undefined,
      bpnReferenceNumber: bpnRef || undefined,
    }),
    onSuccess: async () => {
      setBpnTitle('');
      setBpnNotes('');
      setBpnRef('');
      await logsQuery.refetch();
      notifySuccess('Tahapan BPN berhasil ditambahkan ke berkas log.');
    },
    onError: () => notifyError('Gagal menambahkan tahapan BPN.'),
  });

  const logs = Array.isArray(logsQuery.data) ? logsQuery.data : [];

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <MapPinned size={28} style={{ color: 'var(--color-emerald)' }} />
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>BPN Tracking</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Catatan operasional BPN per matter dengan SLA tracking.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Log Pengurusan BPN</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {logs.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Belum ada log BPN untuk matter ini.</div>
            ) : logs.map((log: any) => (
              <div key={log.id} style={{ padding: '1rem', borderLeft: `3px solid ${log.slaStatus === 'danger' ? 'var(--color-crimson)' : log.slaStatus === 'warning' ? 'var(--color-gold)' : 'var(--color-emerald)'}`, background: 'rgba(0,0,0,0.15)', borderRadius: '0 8px 8px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                  <strong>{log.title || log.stepCode}</strong>
                  <span className={`badge ${log.slaStatus === 'danger' ? 'badge-red' : log.slaStatus === 'warning' ? 'badge-yellow' : 'badge-green'}`}>
                    {log.slaStatus === 'danger' ? 'DELAY' : 'ON TIME'}
                  </span>
                </div>
                {log.referenceNumber ? <div style={{ marginTop: '0.25rem', color: 'var(--color-gold)', fontFamily: 'monospace', fontSize: '0.75rem' }}>Ref: {log.referenceNumber}</div> : null}
                {log.notes ? <div style={{ marginTop: '0.25rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{log.notes}</div> : null}
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Tambah Catatan BPN</h3>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">Tahap BPN</label>
            <select
              value={bpnStep}
              onChange={(e) => setBpnStep(e.target.value as typeof bpnStep)}
              className="input-field select-field"
            >
              <option value="submitted">Diserahkan ke BPN</option>
              <option value="received">Diterima Loket BPN</option>
              <option value="juridical_review">Telaah Yuridis</option>
              <option value="bookkeeping">Pembukuan Sertifikat</option>
              <option value="completed">Selesai Terbit</option>
            </select>
          </div>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">Judul Aktivitas</label>
            <input value={bpnTitle} onChange={(e) => setBpnTitle(e.target.value)} className="input-field" />
          </div>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">Nomor Resi / Referensi BPN</label>
            <input value={bpnRef} onChange={(e) => setBpnRef(e.target.value)} className="input-field" />
          </div>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">Catatan Tambahan</label>
            <textarea value={bpnNotes} onChange={(e) => setBpnNotes(e.target.value)} className="input-field" rows={4} />
          </div>
          <button onClick={() => addStepMutation.mutate()} className="btn btn-primary" disabled={addStepMutation.isPending}>
            Tambah ke Log
          </button>
        </div>
      </div>
    </div>
  );
}

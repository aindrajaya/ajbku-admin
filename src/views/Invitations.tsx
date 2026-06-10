import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { UserPlus, Mail, RotateCcw, ShieldAlert, CheckCircle2, Trash, Send } from 'lucide-react';

export default function Invitations() {
  const queryClient = useQueryClient();

  const [selectedMatterId, setSelectedMatterId] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch matters
  const { data: matters = [] } = useQuery({
    queryKey: ['matters-for-invitations'],
    queryFn: async () => {
      const res = await api.get('/api/v1/matters');
      return Array.isArray(res.data) ? res.data : res.data?.data || [];
    }
  });

  const safeMatters = Array.isArray(matters) ? matters : [];

  // Set default selected matter
  useEffect(() => {
    if (safeMatters.length > 0 && !selectedMatterId) {
      setSelectedMatterId(safeMatters[0].id);
    }
  }, [safeMatters, selectedMatterId]);

  // Fetch invitations for the selected matter
  const { data: invitations = [], refetch: refetchInvitations, isLoading: isLoadingInvitations } = useQuery({
    queryKey: ['matter-invitations', selectedMatterId],
    enabled: !!selectedMatterId,
    queryFn: async () => {
      const res = await api.get(`/api/v1/matters/${selectedMatterId}/invitations`);
      return Array.isArray(res.data) ? res.data : res.data?.data || [];
    }
  });

  const safeInvitations = Array.isArray(invitations) ? invitations : [];

  // Mutations
  const inviteMutation = useMutation({
    mutationFn: async (email: string) => {
      return await api.post(`/api/v1/matters/${selectedMatterId}/invitations`, { email });
    },
    onSuccess: () => {
      setClientEmail('');
      setSuccess(true);
      setError(null);
      refetchInvitations();
      setTimeout(() => setSuccess(false), 3000);
      alert('Undangan Klien berhasil dikirim via Email!');
    },
    onError: () => {
      setError('Gagal mengirim undangan. Pastikan format email benar.');
    }
  });

  const resendMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      await api.patch(`/api/v1/matters/${selectedMatterId}/invitations/${invitationId}/resend`);
    },
    onSuccess: () => {
      refetchInvitations();
      alert('Undangan berhasil dikirim ulang.');
    }
  });

  const revokeMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      await api.patch(`/api/v1/matters/${selectedMatterId}/invitations/${invitationId}/revoke`);
    },
    onSuccess: () => {
      refetchInvitations();
      alert('Undangan berhasil dibatalkan (Revoked).');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientEmail || !selectedMatterId) {
      setError('Harap pilih perkara dan isi email klien.');
      return;
    }
    inviteMutation.mutate(clientEmail);
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '850px', margin: '0 auto' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <UserPlus size={28} style={{ color: 'var(--color-emerald)' }} />
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Undangan Klien (Onboarding)</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Undang klien Anda agar dapat mengisi data objek tanah dan memantau draf akta dari PWA mobile.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2.5rem' }}>
        
        {/* Left Column: Invitations list */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div className="input-group">
            <label className="input-label">Pilih Perkara Aktif</label>
            <select
              value={selectedMatterId}
              onChange={(e) => setSelectedMatterId(e.target.value)}
              className="input-field select-field"
            >
              {safeMatters.map((m: any) => (
                <option key={m.id} value={m.id} style={{ background: 'var(--bg-secondary)' }}>
                  {m.title} ({m.caseNumber || m.matterNumber})
                </option>
              ))}
            </select>
          </div>

          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem', margin: '1.5rem 0 1rem' }}>
            Undangan Dikirim per Perkara
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {isLoadingInvitations ? (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem' }}>
                Memuat undangan...
              </div>
            ) : safeInvitations.length === 0 ? (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem' }}>
                Belum ada undangan klien untuk perkara ini.
              </div>
            ) : (
              safeInvitations.map((inv: any) => (
                <div 
                  key={inv.id}
                  style={{
                    padding: '1rem',
                    backgroundColor: 'rgba(0,0,0,0.15)',
                    border: '1px solid var(--border-glass)',
                    borderRadius: '8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.85rem'
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 600, display: 'block' }}>{inv.email}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                      Status: <strong style={{ color: inv.status === 'active' ? 'var(--color-emerald)' : 'var(--color-gold)' }}>{inv.status.toUpperCase()}</strong>
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {inv.status !== 'revoked' && (
                      <>
                        <button 
                          onClick={() => resendMutation.mutate(inv.id)}
                          className="btn btn-secondary" 
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                        >
                          Kirim Ulang
                        </button>
                        <button 
                          onClick={() => revokeMutation.mutate(inv.id)}
                          className="btn btn-secondary" 
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#f87171' }}
                        >
                          Revoke
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Invite Client Form */}
        <div className="glass-panel" style={{ padding: '1.5rem', height: 'fit-content' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem', marginBottom: '1.25rem' }}>
            Kirim Undangan Baru
          </h3>

          {success && (
            <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.25)', color: '#34d399', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '1rem' }}>
              Undangan berhasil dikirim!
            </div>
          )}

          {error && (
            <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#f87171', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '1rem' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">Email Klien *</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="email" 
                  className="input-field" 
                  style={{ paddingLeft: '2.75rem' }}
                  placeholder="email.klien@gmail.com"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <button type="submit" disabled={inviteMutation.isPending} className="btn btn-primary" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
              <Send size={14} />
              {inviteMutation.isPending ? 'Mengirim...' : 'Kirim Undangan Klien'}
            </button>
          </form>
        </div>

      </div>

    </div>
  );
}

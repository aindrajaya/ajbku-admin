import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { normalizeBodyText } from '../lib/communication';
import { useRealtimeStore } from '../store/realtime';
import { notifyError, notifySuccess } from '../store/ui';
import { ShieldAlert, Check, X, AlertTriangle } from 'lucide-react';
import { queryKeys } from '../lib/queryKeys';

export default function Moderation() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const perPage = 10;
  const fallbackEnabled = useRealtimeStore((state) => state.fallbackEnabled);
  const fallbackIntervalMs = useRealtimeStore((state) => state.fallbackIntervalMs);

  // Fetch flagged messages
  const { data: flagged = [], isLoading, refetch } = useQuery({
    queryKey: queryKeys.moderationFlaggedMessages(page, perPage),
    queryFn: async () => {
      const res = await api.get('/api/v1/moderation/messages/flagged', {
        page,
        perPage
      });
      return Array.isArray(res.data) ? res.data : res.data?.data || [];
    },
    refetchInterval: fallbackEnabled ? fallbackIntervalMs : false
  });

  const safeFlagged = Array.isArray(flagged) ? flagged : [];

  // Resolve false positive mutation
  const resolveMutation = useMutation({
    mutationFn: async (messageId: string) => {
      await api.patch(`/api/v1/moderation/messages/${messageId}/false-positive`);
    },
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: queryKeys.chatThreads() });
      notifySuccess('Pesan ditandai aman dan thread terkait telah disegarkan.');
    },
    onError: () => notifyError('Gagal menandai pesan sebagai false positive.'),
  });

  // Confirm violation mutation
  const blockMutation = useMutation({
    mutationFn: async (messageId: string) => {
      await api.patch(`/api/v1/moderation/messages/${messageId}/confirm-violation`);
    },
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: queryKeys.chatThreads() });
      notifySuccess('Pelanggaran dikonfirmasi. Queue moderasi dan thread terkait telah diperbarui.');
    },
    onError: () => notifyError('Gagal mengonfirmasi pelanggaran pesan.'),
  });

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <ShieldAlert size={28} style={{ color: 'var(--color-emerald)' }} />
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Moderasi Komunikasi</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Review pesan obrolan yang ditandai otomatis oleh filter sistem DLM (Data Leak Prevention) karena melanggar aturan operasional.
          </p>
        </div>
      </div>

      {/* Moderation List */}
      <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.75rem', marginBottom: '0.5rem' }}>
          Daftar Antrian Moderasi
        </h3>

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Memuat antrian moderasi...</div>
        ) : safeFlagged.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '3rem',
            textAlign: 'center',
            backgroundColor: 'rgba(16, 185, 129, 0.03)',
            borderRadius: '8px',
            border: '1px dashed var(--border-glass)'
          }}>
            <ShieldAlert size={36} style={{ color: 'var(--color-emerald)', marginBottom: '0.75rem' }} />
            <h5 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Antrian Bersih</h5>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Tidak ada pesan flagged yang menanti moderasi saat ini.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {safeFlagged.map((m: any) => {
              const messageText = normalizeBodyText(m.bodyText);
              
              return (
                <div 
                  key={m.id}
                  style={{
                    padding: '1.25rem',
                    backgroundColor: 'rgba(239, 68, 68, 0.02)',
                    border: '1px solid rgba(239, 68, 68, 0.15)',
                    borderRadius: '8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '2rem'
                  }}
                >
                  <div style={{ display: 'flex', gap: '1rem', flex: 1 }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <AlertTriangle size={18} style={{ color: 'var(--color-crimson)' }} />
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                        <span>Pengirim: <strong>{m.senderName} ({m.senderRole})</strong></span>
                        <span>•</span>
                        <span>Dibuat: {new Date(m.createdAt).toLocaleDateString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div style={{
                        padding: '0.65rem 1rem',
                        backgroundColor: 'rgba(0,0,0,0.2)',
                        border: '1px solid var(--border-glass)',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        color: '#fca5a5',
                        lineHeight: '1.4',
                        fontFamily: 'var(--font-sans)'
                      }}>
                        {messageText}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', flexShrink: 0 }}>
                    <button 
                      onClick={() => resolveMutation.mutate(m.id)}
                      disabled={resolveMutation.isPending}
                      className="btn btn-secondary" 
                      style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', display: 'flex', gap: '0.35rem', fontWeight: 600 }}
                    >
                      <Check size={14} style={{ color: 'var(--color-emerald)' }} />
                      Aman (Abaikan)
                    </button>
                    
                    <button 
                      onClick={() => blockMutation.mutate(m.id)}
                      disabled={blockMutation.isPending}
                      className="btn btn-danger" 
                      style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', display: 'flex', gap: '0.35rem', fontWeight: 600 }}
                    >
                      <X size={14} />
                      Sensor Pesan
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}

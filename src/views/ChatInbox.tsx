import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { normalizeChatMessage, normalizeChatThread } from '../lib/communication';
import type { ChatMessage, ChatThread } from '../lib/communication';
import { useRealtimeStore } from '../store/realtime';
import { MessageSquare, Send } from 'lucide-react';
import { queryKeys } from '../lib/queryKeys';

export default function ChatInbox() {
  const queryClient = useQueryClient();
  const [activeThread, setActiveThread] = useState<ChatThread | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const fallbackEnabled = useRealtimeStore((state) => state.fallbackEnabled);
  const fallbackIntervalMs = useRealtimeStore((state) => state.fallbackIntervalMs);

  // Fetch threads
  const { data: threads = [], isLoading: isLoadingThreads } = useQuery<ChatThread[]>({
    queryKey: queryKeys.chatThreads(),
    queryFn: async () => {
      const res = await api.get('/api/v1/chat/threads');
      const rows = Array.isArray(res.data) ? res.data : [];
      return rows.map(normalizeChatThread);
    },
    refetchInterval: fallbackEnabled ? fallbackIntervalMs : false
  });

  const safeThreads = Array.isArray(threads) ? threads : [];

  // Fetch active thread's messages
  const { data: messages = [], refetch: refetchMessages } = useQuery<ChatMessage[]>({
    queryKey: queryKeys.chatThread(activeThread?.threadId || activeThread?.matterId || 'inactive'),
    queryFn: async () => {
      if (!activeThread) return [];
      const res = await api.get(`/api/v1/matters/${activeThread.matterId}/chat/messages`);
      const rows = Array.isArray(res.data) ? res.data : [];
      return rows.map(normalizeChatMessage);
    },
    enabled: !!activeThread,
    refetchInterval: fallbackEnabled ? fallbackIntervalMs : false
  });

  const safeMessages = Array.isArray(messages) ? messages : [];

  // Mark active thread read when changed
  useEffect(() => {
    async function triggerMarkRead() {
      if (!activeThread) return;
      try {
        await api.post(`/api/v1/chat/threads/${activeThread.threadId}/read`);
        queryClient.invalidateQueries({ queryKey: queryKeys.chatThreads() });
      } catch (err) {
        console.error('Failed to mark thread as read:', err);
      }
    }
    triggerMarkRead();
  }, [activeThread?.threadId]);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (payload: { matterId: string; bodyText: string }) => {
      await api.post(`/api/v1/matters/${payload.matterId}/chat/messages`, {
        messageType: 'text',
        bodyText: payload.bodyText
      });
    },
    onSuccess: () => {
      setMessageInput('');
      refetchMessages();
      // Crucial requirements invalidations (AC-ADMIN-CHAT-04)
      queryClient.invalidateQueries({ queryKey: queryKeys.chatThread(activeThread?.threadId || activeThread?.matterId || 'inactive') });
      queryClient.invalidateQueries({ queryKey: queryKeys.chatThreads() });
    }
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !activeThread) return;
    sendMessageMutation.mutate({
      matterId: activeThread.matterId,
      bodyText: messageInput
    });
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: 'calc(100vh - 150px)' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <MessageSquare size={28} style={{ color: 'var(--color-emerald)' }} />
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Komunikasi Perkara</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Konsolidasi pesan masuk dan keluar per perkara antara staf kantor Notaris dengan para pihak.
          </p>
        </div>
      </div>

      {/* Two-Column Shell */}
      <div className="glass-panel" style={{ flex: 1, display: 'grid', gridTemplateColumns: '320px 1fr', overflow: 'hidden' }}>
        
        {/* Left Column: Threads list */}
        <div style={{ borderRight: '1px solid var(--border-glass)', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-glass)', background: 'rgba(0,0,0,0.1)' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
              Pesan Masuk (Inbox)
            </span>
          </div>

          <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column' }}>
            {isLoadingThreads ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Memuat inbox...</div>
            ) : safeThreads.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Tidak ada percakapan aktif</div>
            ) : (
              safeThreads.map((t: any) => {
                const isActive = activeThread?.threadId === t.threadId;
                return (
                  <div 
                    key={t.threadId}
                    onClick={() => setActiveThread(t)}
                    style={{
                      padding: '1rem',
                      borderBottom: '1px solid var(--border-glass)',
                      cursor: 'pointer',
                      backgroundColor: isActive ? 'rgba(16, 185, 129, 0.08)' : 'transparent',
                      borderLeft: isActive ? '3px solid var(--color-emerald)' : '3px solid transparent',
                      transition: 'var(--transition-smooth)'
                    }}
                    onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.01)'; }}
                    onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-emerald)', fontFamily: 'monospace', fontWeight: 600 }}>
                        {t.matterCaseNumber}
                      </span>
                      {t.unreadCount > 0 && (
                        <span className="badge badge-green" style={{ fontSize: '0.6rem', padding: '0.1rem 0.35rem' }}>
                          {t.unreadCount} BARU
                        </span>
                      )}
                    </div>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: t.unreadCount > 0 ? 700 : 600, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                      {t.counterpartyName}
                    </h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.lastMessage || 'Belum ada pesan.'}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Active Conversation */}
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'rgba(0,0,0,0.1)' }}>
          {activeThread ? (
            <>
              {/* Header Info */}
              <div style={{
                padding: '1rem 1.5rem',
                borderBottom: '1px solid var(--border-glass)',
                backgroundColor: 'rgba(0,0,0,0.15)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>{activeThread.counterpartyName}</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Perkara: {activeThread.matterCaseNumber} • Role: {activeThread.counterpartyRole}
                  </span>
                </div>
              </div>

              {/* Messages Area */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {safeMessages.length === 0 ? (
                  <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    Belum ada percakapan. Kirim pesan pertama untuk memulai obrolan.
                  </div>
                ) : (
                  safeMessages.map((m: any) => {
                    const isMe = m.senderRole === 'ADMIN';
                    
                    return (
                      <div 
                        key={m.id}
                        style={{
                          alignSelf: isMe ? 'flex-end' : 'flex-start',
                          maxWidth: '70%',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: isMe ? 'flex-end' : 'flex-start'
                        }}
                      >
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.15rem' }}>
                          {m.senderName} ({m.senderRole})
                        </span>
                        
                        <div style={{
                          padding: '0.65rem 1rem',
                          borderRadius: '12px',
                          backgroundColor: isMe ? 'var(--color-emerald-glow)' : 'rgba(255, 255, 255, 0.03)',
                          border: isMe ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid var(--border-glass)',
                          color: 'var(--text-primary)',
                          fontSize: '0.85rem',
                          lineHeight: '1.4'
                        }}>
                          {m.bodyText}
                        </div>

                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                          {new Date(m.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Input Area */}
              <form onSubmit={handleSend} style={{
                padding: '1rem 1.5rem',
                borderTop: '1px solid var(--border-glass)',
                backgroundColor: 'rgba(0,0,0,0.15)',
                display: 'flex',
                gap: '0.75rem'
              }}>
                <input 
                  type="text" 
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  className="input-field" 
                  placeholder="Tulis pesan... (Ctrl+Enter untuk kirim)" 
                  style={{ marginBottom: 0 }}
                  required
                />
                <button type="submit" disabled={sendMessageMutation.isPending} className="btn btn-primary" style={{ padding: '0.75rem 1.5rem' }}>
                  <Send size={16} />
                  Kirim
                </button>
              </form>
            </>
          ) : (
            <div style={{ margin: 'auto', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', color: 'var(--text-muted)' }}>
              <MessageSquare size={48} style={{ color: 'var(--border-glass-active)', strokeWidth: 1.5 }} />
              <h4 style={{ fontSize: '1rem', fontWeight: 600 }}>Pilih Percakapan</h4>
              <p style={{ fontSize: '0.85rem', maxWidth: '300px' }}>
                Silakan pilih salah satu thread di kolom kiri untuk membalas komunikasi klien atau notaris terkait akta.
              </p>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}

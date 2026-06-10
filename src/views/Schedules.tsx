import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { Calendar, Clock, MapPin, CheckCircle, AlertCircle } from 'lucide-react';

export default function Schedules() {
  const queryClient = useQueryClient();

  // Fetch all agendas
  const { data: schedules = [], isLoading, refetch } = useQuery({
    queryKey: ['schedules'],
    queryFn: async () => {
      const res = await api.get('/api/v1/schedules');
      return Array.isArray(res.data) ? res.data : res.data?.data || [];
    }
  });

  // ScheduleListResponseDto wraps in { items: [] }
  const safeSchedules = Array.isArray(schedules)
    ? schedules
    : Array.isArray((schedules as any)?.items)
      ? (schedules as any).items
      : Array.isArray((schedules as any)?.data)
        ? (schedules as any).data
        : [];

  // Fetch matters to display Case Number labels
  const { data: matters = [] } = useQuery({
    queryKey: ['matters'],
    queryFn: async () => {
      const res = await api.get('/api/v1/matters');
      return Array.isArray(res.data) ? res.data : res.data?.data || [];
    }
  });

  const safeMatters = Array.isArray(matters) ? matters : [];

  const getMatterTitle = (matterId: string) => {
    const match = safeMatters.find((m: any) => m.id === matterId);
    return match ? `${match.caseNumber || match.matterNumber || ''} - ${match.title}` : 'Detail Perkara';
  };

  const confirmAttendanceMutation = useMutation({
    mutationFn: async (scheduleId: string) => {
      await api.post(`/api/v1/schedules/${scheduleId}/confirm-attendance`);
    },
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ['matters'] });
      alert('Kehadiran para pihak dikonfirmasi. Status perkara dipindahkan ke Penandatanganan Selesai.');
    }
  });

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <Calendar size={28} style={{ color: 'var(--color-emerald)' }} />
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Agenda Pertemuan</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Penjadwalan janji temu penandatanganan Minuta Akta (AJB/Hibah/APHT) langsung di hadapan Notaris PPAT.
          </p>
        </div>
      </div>

      {/* Main List */}
      <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.75rem', marginBottom: '0.5rem' }}>
          Daftar Rencana Pertemuan
        </h3>

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Memuat agenda...</div>
        ) : safeSchedules.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Belum ada rencana pertemuan terjadwal saat ini. Penjadwalan rapat dilakukan melalui lembar Detail Perkara.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {safeSchedules.map((s: any) => {
              const isConfirmed = s.status === 'confirmed';
              // ScheduleItemDto status enum: scheduled | confirmed | rescheduled | completed | cancelled
              const isCompleted = s.status === 'completed';
              
              return (
                <div 
                  key={s.id}
                  style={{
                    padding: '1.25rem',
                    backgroundColor: 'rgba(255,255,255,0.01)',
                    border: '1px solid var(--border-glass)',
                    borderRadius: '10px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'var(--transition-smooth)'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--border-glass-active)'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-glass)'}
                >
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(217, 119, 6, 0.08)',
                      border: '1px solid rgba(217, 119, 6, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <Clock size={20} style={{ color: 'var(--color-gold)' }} />
                    </div>

                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-emerald)', fontWeight: 600, display: 'block', fontFamily: 'monospace' }}>
                        {getMatterTitle(s.matterId)}
                      </span>
                      <h4 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0.15rem 0 0.35rem', color: 'var(--text-primary)' }}>
                        {new Date(s.scheduledAt).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })} WIB
                      </h4>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <MapPin size={14} style={{ color: 'var(--text-muted)' }} />
                          {s.location || s.locationDetail || 'Kantor Notaris Terpilih'}
                        </span>
                        {s.notes && <span>Catatan Rapat: "{s.notes}"</span>}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span className={`badge ${isCompleted ? 'badge-green' : isConfirmed ? 'badge-purple' : 'badge-yellow'}`} style={{ fontSize: '0.65rem' }}>
                      {isCompleted ? 'SELESAI HADIR' : isConfirmed ? 'TERKONFIRMASI' : 'PENDING'}
                    </span>

                    {isConfirmed && (
                      <button 
                        onClick={() => confirmAttendanceMutation.mutate(s.id)}
                        disabled={confirmAttendanceMutation.isPending}
                        className="btn btn-primary"
                        style={{ padding: '0.45rem 1rem', fontSize: '0.8rem', fontWeight: 600 }}
                      >
                        <CheckCircle size={14} />
                        Konfirmasi Kehadiran
                      </button>
                    )}
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

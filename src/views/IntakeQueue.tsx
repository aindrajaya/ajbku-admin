import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, Link } from '@tanstack/react-router';
import { api } from '../api/client';
import { buildMatterListParams, extractMatterList } from '../lib/matters';
import { Inbox, FileText, CheckSquare, ArrowRight, Plus } from 'lucide-react';

export default function IntakeQueue() {
  const navigate = useNavigate();

  // Fetch matters
  const { data: matters = [], isLoading } = useQuery({
    queryKey: ['matters-intake-queue'],
    queryFn: async () => {
      const res = await api.get('/api/v1/matters', buildMatterListParams());
      return extractMatterList(res.data);
    }
  });

  const safeMatters = Array.isArray(matters) ? matters : [];

  // Filter only matters in intake or documents review stages (PRD 6.2)
  const intakeMatters = safeMatters.filter((m: any) => 
    m && (m.workflowStatus === 'intake_submitted' || m.workflowStatus === 'documents_under_review' || m.workflowStatus === 'draft')
  );

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Inbox size={28} style={{ color: 'var(--color-emerald)' }} />
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Antrian Pengajuan (Intake Queue)</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Daftar perkara baru masuk yang memerlukan tinjauan berkas persyaratan utama.
            </p>
          </div>
        </div>

        <Link to="/intake/new" className="btn btn-primary">
          <Plus size={16} />
          Daftarkan Perkara
        </Link>
      </div>

      {/* Table Card */}
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          textAlign: 'left',
          fontSize: '0.9rem',
          fontFamily: 'var(--font-sans)'
        }}>
          <thead>
            <tr style={{
              background: 'rgba(255,255,255,0.03)',
              borderBottom: '1px solid var(--border-glass)',
              color: 'var(--text-secondary)'
            }}>
              <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>No Perkara</th>
              <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>Nama Perkara</th>
              <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>Klien Utama</th>
              <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>Status Workflow</th>
              <th style={{ padding: '1rem 1.5rem', fontWeight: 600, textAlign: 'right' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Memuat antrian perkara masuk...
                </td>
              </tr>
            ) : intakeMatters.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Tidak ada perkara pending dalam antrian verifikasi.
                </td>
              </tr>
            ) : (
              intakeMatters.map((m: any) => {
                return (
                  <tr 
                    key={m.id} 
                    style={{
                      borderBottom: '1px solid var(--border-glass)',
                      transition: 'var(--transition-smooth)',
                      cursor: 'pointer'
                    }}
                    onClick={() => navigate({ to: '/matters/$id', params: { id: m.id } })}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.01)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <td style={{ padding: '1.25rem 1.5rem', fontFamily: 'monospace', fontWeight: 600, color: 'var(--color-emerald)' }}>
                      {m.caseNumber || m.matterNumber}
                    </td>
                    <td style={{ padding: '1.25rem 1.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {m.title}
                    </td>
                    <td style={{ padding: '1.25rem 1.5rem', color: 'var(--text-secondary)' }}>
                      {m.clientName || m.clientProfileName || m.clientFullName || `Profil: ${m.clientProfileId || '-'}`}
                    </td>
                    <td style={{ padding: '1.25rem 1.5rem' }}>
                      <span className="badge badge-blue">
                        {m.workflowStatus ? m.workflowStatus.replace(/_/g, ' ') : 'PENDING'}
                      </span>
                    </td>
                    <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                      <button 
                        onClick={() => navigate({ to: '/matters/$id/verify', params: { id: m.id } })}
                        className="btn btn-primary" 
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', fontWeight: 600, display: 'inline-flex', gap: '0.25rem' }}
                      >
                        <CheckSquare size={13} />
                        Verifikasi
                      </button>
                    </td>
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

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { api } from '../api/client';
import { buildMatterListParams, extractMatterList } from '../lib/matters';
import { getServiceCategoryName, useServiceCategories } from '../lib/serviceCategories';
import { FileText, Plus, Filter, Search, RotateCcw } from 'lucide-react';

// Status badge mappings matching PRD Section 4.1
export const MATTER_WORKFLOW_STATUS: Record<string, { label: string; className: string }> = {
  draft:                    { label: 'Draft',                className: 'badge-gray' },
  intake_submitted:         { label: 'Pengajuan Masuk',      className: 'badge-blue' },
  documents_under_review:   { label: 'Verifikasi Dokumen',   className: 'badge-blue' },
  documents_verified:       { label: 'Dokumen Tervalidasi',  className: 'badge-teal' },
  assignment_pending:       { label: 'Menunggu Notaris',     className: 'badge-yellow' },
  notary_assigned:          { label: 'Notaris Ditugaskan',   className: 'badge-teal' },
  payment_pending:          { label: 'Menunggu Pembayaran',  className: 'badge-orange' },
  payment_verified:         { label: 'Pembayaran Terverifikasi', className: 'badge-green' },
  draft_preparation:        { label: 'Persiapan Draf',       className: 'badge-purple' },
  draft_review:             { label: 'Review Draf',          className: 'badge-purple' },
  schedule_pending:         { label: 'Agenda Pending',       className: 'badge-yellow' },
  signing_scheduled:        { label: 'Agenda Terjadwal',     className: 'badge-purple' },
  signing_completed:        { label: 'Penandatanganan Selesai', className: 'badge-green' },
  post_signing:             { label: 'Pasca Tanda Tangan',   className: 'badge-teal' },
  bpn_submitted:            { label: 'Diserahkan ke BPN',    className: 'badge-blue' },
  bpn_completed:            { label: 'BPN Selesai',          className: 'badge-green' },
  closed:                   { label: 'Selesai',              className: 'badge-green' },
  cancelled:                { label: 'Dibatalkan',           className: 'badge-red' },
  manual_review:            { label: 'Review Manual',        className: 'badge-red' },
};

export const MATTER_ASSIGNMENT_STATUS: Record<string, { label: string; className: string }> = {
  unassigned:              { label: 'Belum Ditugaskan',       className: 'badge-gray' },
  recommendation_generated:{ label: 'Rekomendasi Dibuat',    className: 'badge-blue' },
  assigned:                { label: 'Sudah Ditugaskan',       className: 'badge-teal' },
  accepted:                { label: 'Diterima Notaris',       className: 'badge-green' },
  rejected:                { label: 'Ditolak Notaris',        className: 'badge-red' },
  reassignment_pending:    { label: 'Perlu Reassign',         className: 'badge-yellow' },
  manual_hold:             { label: 'Hold Manual',            className: 'badge-orange' },
};

export const MATTER_PAYMENT_STATUS: Record<string, { label: string; className: string }> = {
  unpaid:   { label: 'Belum Bayar',         className: 'badge-gray' },
  pending:  { label: 'Menunggu',             className: 'badge-yellow' },
  verified: { label: 'Terverifikasi',        className: 'badge-green' },
  failed:   { label: 'Gagal',               className: 'badge-red' },
  refunded: { label: 'Dikembalikan',         className: 'badge-orange' },
  disputed: { label: 'Dipersengketakan',     className: 'badge-red' },
};

export default function Matters() {
  const navigate = useNavigate();

  // Filters State
  const [workflowStatus, setWorkflowStatus] = useState('all');
  const [assignmentStatus, setAssignmentStatus] = useState('all');
  const [paymentStatus, setPaymentStatus] = useState('all');
  const [serviceCategoryId, setServiceCategoryId] = useState('all');
  const [landCityCode, setLandCityCode] = useState('');

  // Fetch matters based on filters
  const { data: matters = [], isLoading, refetch } = useQuery({
    queryKey: ['matters', { workflowStatus, assignmentStatus, paymentStatus, serviceCategoryId, landCityCode }],
    queryFn: async () => {
      const res = await api.get('/api/v1/matters', buildMatterListParams({
        workflowStatus: workflowStatus !== 'all' ? workflowStatus : undefined,
        assignmentStatus: assignmentStatus !== 'all' ? assignmentStatus : undefined,
        paymentStatus: paymentStatus !== 'all' ? paymentStatus : undefined,
        serviceCategoryId: serviceCategoryId !== 'all' ? serviceCategoryId : undefined,
        landCityCode: landCityCode || undefined,
      }));
      return extractMatterList(res.data);
    }
  });

  const safeMatters = Array.isArray(matters) ? matters : [];
  const { data: categories = [] } = useServiceCategories();

  const resetFilters = () => {
    setWorkflowStatus('all');
    setAssignmentStatus('all');
    setPaymentStatus('all');
    setServiceCategoryId('all');
    setLandCityCode('');
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <FileText size={28} style={{ color: 'var(--color-emerald)' }} />
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Daftar Perkara</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Manajemen dan pantau seluruh status minuta akta, validasi BPN, dan pemenuhan milestone pembayaran.
            </p>
          </div>
        </div>

        <Link to="/intake/new" className="btn btn-primary">
          <Plus size={16} />
          Pengajuan Baru
        </Link>
      </div>

      {/* Multi-Dimensional Filter Bar */}
      <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem' }}>
          <Filter size={16} style={{ color: 'var(--color-gold)' }} />
          <span style={{ fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Filter Dimensi Perkara</span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem',
          alignItems: 'end'
        }}>
          {/* Workflow Status Dropdown */}
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label" style={{ fontSize: '0.75rem' }}>Workflow Status</label>
            <select 
              className="input-field select-field" 
              style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
              value={workflowStatus}
              onChange={(e) => setWorkflowStatus(e.target.value)}
            >
              <option value="all">Semua Status</option>
              {Object.entries(MATTER_WORKFLOW_STATUS).map(([key, value]) => (
                <option key={key} value={key} style={{ background: 'var(--bg-secondary)' }}>{value.label}</option>
              ))}
            </select>
          </div>

          {/* Assignment Status Dropdown */}
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label" style={{ fontSize: '0.75rem' }}>Status Penugasan</label>
            <select 
              className="input-field select-field" 
              style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
              value={assignmentStatus}
              onChange={(e) => setAssignmentStatus(e.target.value)}
            >
              <option value="all">Semua Penugasan</option>
              {Object.entries(MATTER_ASSIGNMENT_STATUS).map(([key, value]) => (
                <option key={key} value={key} style={{ background: 'var(--bg-secondary)' }}>{value.label}</option>
              ))}
            </select>
          </div>

          {/* Payment Status Dropdown */}
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label" style={{ fontSize: '0.75rem' }}>Status Pembayaran</label>
            <select 
              className="input-field select-field" 
              style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
              value={paymentStatus}
              onChange={(e) => setPaymentStatus(e.target.value)}
            >
              <option value="all">Semua Pembayaran</option>
              {Object.entries(MATTER_PAYMENT_STATUS).map(([key, value]) => (
                <option key={key} value={key} style={{ background: 'var(--bg-secondary)' }}>{value.label}</option>
              ))}
            </select>
          </div>

          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label" style={{ fontSize: '0.75rem' }}>Kategori Layanan</label>
            <select
              className="input-field select-field"
              style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
              value={serviceCategoryId}
              onChange={(e) => setServiceCategoryId(e.target.value)}
              data-testid="service-category-filter"
            >
              <option value="all">Semua Layanan</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id} style={{ background: 'var(--bg-secondary)' }}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          {/* Land City Code Text Search */}
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label" style={{ fontSize: '0.75rem' }}>Kode Kota/Kab</label>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type="text" 
                className="input-field" 
                style={{ padding: '0.5rem 1rem 0.5rem 2rem', fontSize: '0.85rem' }}
                placeholder="Cari Kode Kota (e.g. 3519)"
                value={landCityCode}
                onChange={(e) => setLandCityCode(e.target.value)}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <button 
            type="button" 
            className="btn btn-secondary" 
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', display: 'flex', gap: '0.5rem', alignSelf: 'stretch', justifyContent: 'center' }}
            onClick={resetFilters}
          >
            <RotateCcw size={14} />
            Reset
          </button>

        </div>
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
              <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>Kategori</th>
              <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>Status Workflow</th>
              <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>Penugasan</th>
              <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>Pembayaran</th>
              <th style={{ padding: '1rem 1.5rem', fontWeight: 600, textAlign: 'right' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Memuat data perkara...
                </td>
              </tr>
            ) : safeMatters.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Tidak ada perkara yang cocok dengan filter yang dipilih
                </td>
              </tr>
            ) : (
              safeMatters.map((m: any) => {
                const wStatus = MATTER_WORKFLOW_STATUS[m.workflowStatus] || { label: m.workflowStatus, className: 'badge-gray' };
                const aStatus = MATTER_ASSIGNMENT_STATUS[m.assignmentStatus] || { label: m.assignmentStatus, className: 'badge-gray' };
                const pStatus = MATTER_PAYMENT_STATUS[m.paymentStatus] || { label: m.paymentStatus, className: 'badge-gray' };

                return (
                  <tr 
                    key={m.id} 
                    style={{
                      borderBottom: '1px solid var(--border-glass)',
                      transition: 'var(--transition-smooth)'
                    }}
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
                      {getServiceCategoryName(m, categories)}
                    </td>
                    <td style={{ padding: '1.25rem 1.5rem' }}>
                      <span className={`badge ${wStatus.className}`}>
                        {wStatus.label}
                      </span>
                    </td>
                    <td style={{ padding: '1.25rem 1.5rem' }}>
                      <span className={`badge ${aStatus.className}`}>
                        {aStatus.label}
                      </span>
                    </td>
                    <td style={{ padding: '1.25rem 1.5rem' }}>
                      <span className={`badge ${pStatus.className}`}>
                        {pStatus.label}
                      </span>
                    </td>
                    <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right' }}>
                      <button 
                        onClick={() => navigate({ to: '/matters/$id', params: { id: m.id } })}
                        className="btn btn-secondary" 
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', fontWeight: 600 }}
                      >
                        Buka
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

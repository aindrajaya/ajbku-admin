import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import axios from 'axios';
import { 
  MATTER_WORKFLOW_STATUS, 
  MATTER_ASSIGNMENT_STATUS, 
  MATTER_PAYMENT_STATUS 
} from './Matters';
import { 
  FileText, 
  History, 
  Upload, 
  UserCheck, 
  DollarSign, 
  Map, 
  Calendar, 
  MessageSquare,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Download,
  Shield,
  Plus,
  Send,
  X,
  FileCheck,
  CreditCard
} from 'lucide-react';
import { normalizeBodyText } from '../views/ChatInbox'; // Re-use normalization

export default function MatterDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // Tab State
  const [activeTab, setActiveTab] = useState<'docs' | 'assign' | 'payments' | 'escrow' | 'bpn' | 'agenda' | 'chat'>('docs');
  
  // Matter workflow status edit state
  const [editingStatus, setEditingStatus] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('');

  // Fetch Matter details
  const { data: matter, isLoading: isLoadingMatter } = useQuery({
    queryKey: ['matters', id],
    queryFn: async () => {
      const res = await api.get(`/api/v1/matters/${id}`);
      return res.data;
    }
  });

  // Fetch timeline events
  const { data: timeline = [], refetch: refetchTimeline } = useQuery({
    queryKey: ['matters', id, 'timeline'],
    queryFn: async () => {
      const res = await api.get(`/api/v1/matters/${id}/timeline`);
      return Array.isArray(res.data) ? res.data : res.data?.data || [];
    },
    enabled: !!id
  });

  const safeTimeline = Array.isArray(timeline) ? timeline : [];

  // Mutate workflow status
  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      // UpdateStatusDto: { status: WorkflowStatus, description?: string }
      await api.patch(`/api/v1/matters/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matters'] });
      setEditingStatus(false);
      refetchTimeline();
      alert('Status perkara berhasil diperbarui!');
    }
  });

  // Extract and normalize the matter data defensively
  const rawMatter = matter;
  const actualMatter = (rawMatter && typeof rawMatter === 'object' && 'data' in rawMatter && !('error' in rawMatter))
    ? (rawMatter as any).data
    : rawMatter;

  if (isLoadingMatter || !matter || !actualMatter) {
    return <div style={{ textAlign: 'center', padding: '5rem', color: 'var(--text-muted)' }}>Memuat berkas perkara...</div>;
  }

  const safeMatter = actualMatter || {};
  const wStatus = MATTER_WORKFLOW_STATUS[safeMatter.workflowStatus || ''] || { label: safeMatter.workflowStatus || 'DRAFT', className: 'badge-gray' };
  const aStatus = MATTER_ASSIGNMENT_STATUS[safeMatter.assignmentStatus || ''] || { label: safeMatter.assignmentStatus || 'UNASSIGNED', className: 'badge-gray' };
  const pStatus = MATTER_PAYMENT_STATUS[safeMatter.paymentStatus || ''] || { label: safeMatter.paymentStatus || 'UNPAID', className: 'badge-gray' };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Detail Header Banner */}
      <div className="glass-panel" style={{
        padding: '1.5rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderLeft: '4px solid var(--color-emerald)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--color-emerald)', fontFamily: 'monospace', fontWeight: 700 }}>
              {safeMatter.caseNumber || safeMatter.matterNumber || '-'}
            </span>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>{safeMatter.title || '-'}</h2>
          </div>
          <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <span>Klien: <strong>{safeMatter.clientName || safeMatter.clientProfileName || safeMatter.clientFullName || '-'}</strong></span>
            <span>•</span>
            <span>Wilayah: <strong>Kota/Kab {safeMatter.landCityCode || '-'}</strong></span>
            <span>•</span>
            <span>Nilai Kontrak: <strong>Rp {(safeMatter.transactionValue || 0).toLocaleString('id-ID')}</strong></span>
          </div>
        </div>

        {/* Workflow State editor */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {editingStatus ? (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <select 
                value={selectedStatus || safeMatter.workflowStatus || ''} 
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="input-field select-field" 
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', width: '200px' }}
              >
                {Object.entries(MATTER_WORKFLOW_STATUS).map(([key, value]) => (
                  <option key={key} value={key} style={{ background: 'var(--bg-secondary)' }}>{value.label}</option>
                ))}
              </select>
              <button 
                onClick={() => updateStatusMutation.mutate(selectedStatus || safeMatter.workflowStatus || '')}
                className="btn btn-primary" 
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
              >
                Simpan
              </button>
              <button 
                onClick={() => setEditingStatus(false)}
                className="btn btn-secondary" 
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
              >
                Batal
              </button>
            </div>
          ) : (
            <>
              <span className={`badge ${wStatus.className}`} style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem' }}>
                Workflow: {wStatus.label}
              </span>
              <button 
                onClick={() => { setEditingStatus(true); setSelectedStatus(safeMatter.workflowStatus || ''); }}
                className="btn btn-secondary" 
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
              >
                Ubah Status
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Layout Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '280px 1fr',
        gap: '1.5rem',
        alignItems: 'start'
      }}>
        
        {/* Left Column: Metadata & Timeline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Metadata Card */}
          <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem' }}>Detail Perkara</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Jenis Layanan</span>
                <span style={{ fontWeight: 600 }}>{safeMatter.serviceName || safeMatter.serviceCategoryName || '-'}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Kantor Notaris</span>
                <span style={{ fontWeight: 600 }}>{safeMatter.officeName || '-'}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>No Sertifikat</span>
                <span style={{ fontWeight: 600 }}>{safeMatter.landCertificateNumber || '-'}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Status Penugasan Notaris</span>
                <span className={`badge ${aStatus.className}`} style={{ marginTop: '0.2rem', fontSize: '0.7rem' }}>{aStatus.label}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Status Pembayaran</span>
                <span className={`badge ${pStatus.className}`} style={{ marginTop: '0.2rem', fontSize: '0.7rem' }}>{pStatus.label}</span>
              </div>
            </div>
          </div>

          {/* Timeline History log */}
          <div className="glass-panel" style={{ padding: '1.25rem', maxHeight: '350px', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>Log Perkara</h3>
            
            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {safeTimeline.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem' }}>
                  Belum ada log audit untuk perkara ini
                </div>
              ) : (
                safeTimeline.map((evt: any) => (
                  <div key={evt.id} style={{ display: 'flex', gap: '0.5rem', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <Activity size={14} style={{ color: 'var(--color-emerald)', flexShrink: 0 }} />
                      <div style={{ width: '1px', flex: 1, backgroundColor: 'var(--border-glass)', margin: '0.25rem 0' }} />
                    </div>
                    <div>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{evt?.action ? evt.action.replace(/_/g, ' ') : ''}</span>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', margin: '0.1rem 0' }}>{evt?.details}</p>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {evt?.createdAt ? new Date(evt.createdAt).toLocaleDateString('id-ID', { hour: '2-digit', minute: '2-digit' }) : ''} • {evt?.actorName}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* Right Column: Workspaces Tabs Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Tab Navigation header */}
          <div className="glass-panel" style={{ padding: '0.25rem', display: 'flex', gap: '0.25rem' }}>
            <TabButton active={activeTab === 'docs'} onClick={() => setActiveTab('docs')} icon={<FileText size={16} />} label="Dokumen" />
            <TabButton active={activeTab === 'assign'} onClick={() => setActiveTab('assign')} icon={<UserCheck size={16} />} label="Penugasan" />
            <TabButton active={activeTab === 'payments'} onClick={() => setActiveTab('payments')} icon={<CreditCard size={16} />} label="Pembayaran" />
            <TabButton active={activeTab === 'escrow'} onClick={() => setActiveTab('escrow')} icon={<DollarSign size={16} />} label="Milestone Escrow" />
            <TabButton active={activeTab === 'bpn'} onClick={() => setActiveTab('bpn')} icon={<Map size={16} />} label="Log BPN" />
            <TabButton active={activeTab === 'agenda'} onClick={() => setActiveTab('agenda')} icon={<Calendar size={16} />} label="Agenda Rapat" />
            <TabButton active={activeTab === 'chat'} onClick={() => setActiveTab('chat')} icon={<MessageSquare size={16} />} label="Chat Perkara" />
          </div>

          {/* Tab Content Panels */}
          <div className="glass-panel animate-fade-in" style={{ padding: '2rem', minHeight: '400px' }}>
            {activeTab === 'docs' && <DocsTab matterId={safeMatter.id || ''} documents={safeMatter.documents || []} />}
            {activeTab === 'assign' && <AssignTab matterId={safeMatter.id || ''} />}
            {activeTab === 'payments' && <PaymentsTab matterId={safeMatter.id || ''} />}
            {activeTab === 'escrow' && <EscrowTab matterId={safeMatter.id || ''} />}
            {activeTab === 'bpn' && <BpnTab matterId={safeMatter.id || ''} />}
            {activeTab === 'agenda' && <AgendaTab matterId={safeMatter.id || ''} />}
            {activeTab === 'chat' && <ChatTab matterId={safeMatter.id || ''} />}
          </div>

        </div>

      </div>

    </div>
  );
}

// Helper Tab Button
interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

function TabButton({ active, onClick, icon, label }: TabButtonProps) {
  return (
    <button 
      onClick={onClick}
      style={{
        flex: 1,
        padding: '0.65rem 1rem',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        background: active ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
        border: 'none',
        borderRadius: '8px',
        color: active ? '#fff' : 'var(--text-secondary)',
        fontFamily: 'var(--font-sans)',
        fontSize: '0.85rem',
        fontWeight: active ? 600 : 500,
        cursor: 'pointer',
        transition: 'var(--transition-smooth)',
        borderBottom: active ? '2px solid var(--color-emerald)' : 'none'
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

// ======================== TABS IMPLEMENTATION ========================

// 1. DOCUMENTS TAB
const VALID_DOC_TYPES = [
  { value: 'ktp', label: 'KTP' },
  { value: 'kk', label: 'Kartu Keluarga (KK)' },
  { value: 'npwp', label: 'NPWP' },
  { value: 'pbb', label: 'PBB' },
  { value: 'sertifikat', label: 'Sertifikat Tanah' },
  { value: 'surat_nikah', label: 'Surat Nikah' },
  { value: 'surat_cerai', label: 'Surat Cerai' },
  { value: 'akta_kelahiran', label: 'Akta Kelahiran' },
  { value: 'akta_draft', label: 'Draft Akta' },
  { value: 'akta_final', label: 'Akta Final' },
  { value: 'sk_ahli_waris', label: 'SK Ahli Waris' },
  { value: 'sppht', label: 'SPPHT' },
  { value: 'bphtb', label: 'BPHTB' },
  { value: 'pph', label: 'PPh' },
  { value: 'lainnya', label: 'Lainnya' },
];

function DocsTab({ matterId, documents = [] }: { matterId: string; documents?: any[] }) {
  const queryClient = useQueryClient();
  
  // States for verification modal
  const [verifyingDoc, setVerifyingDoc] = useState<any | null>(null);
  const [extractedDataText, setExtractedDataText] = useState('');
  const [verifyStatus, setVerifyStatus] = useState<'verified' | 'rejected'>('verified');

  // Selected document type for upload
  const [selectedDocType, setSelectedDocType] = useState('ktp');

  // Upload progress state
  const [uploadProgress, setUploadProgress] = useState(0);

  // In-flight upload filename to display in the UI during upload progress
  const [uploadingFileName, setUploadingFileName] = useState('');

  const safeDocuments = Array.isArray(documents) ? documents : [];

  // Uploader action conforming to 2-step presigned URL uploads
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadProgress(5);
      setUploadingFileName(file.name);

      // Step 1: Request presign
      const presignRes = await api.post(`/api/v1/matters/${matterId}/documents/presign`, {
        fileName: file.name,
        mimeType: file.type,
        docType: selectedDocType,
        fileSize: file.size
      });

      const { documentId, upload } = presignRes.data as {
        documentId: string;
        upload: {
          bucket: string;
          key: string;
          method: string;
          url: string;
          token?: string;
          expiresIn: number;
        };
      };

      if (!upload?.url) {
        throw new Error('Gagal mendapatkan URL upload dari server.');
      }

      setUploadProgress(15);

      // Step 2: Actual upload to S3/Supabase storage with progress tracking
      // Use raw axios to prevent Authorization header insertion (avoid S3/Supabase signature conflict)
      await axios.put(upload.url, file, {
        headers: {
          'Content-Type': file.type
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || file.size));
          // Map to 15% - 90% progress range
          setUploadProgress(15 + Math.round(percentCompleted * 0.75));
        }
      });

      setUploadProgress(92);

      // Step 3: Complete upload in backend database
      await api.post(`/api/v1/matters/${matterId}/documents/${documentId}/complete`, {
        storageKey: upload.key,
        originalFilename: file.name,
        mimeType: file.type,
        fileSizeBytes: file.size
      });
      
      setUploadProgress(100);

      // Invalidate matters queries to reload matter details and update document list
      await queryClient.invalidateQueries({ queryKey: ['matters', matterId] });

      setTimeout(() => {
        setUploadProgress(0);
        setUploadingFileName('');
      }, 1500);

      alert('Dokumen berhasil diunggah!');
    } catch (err: any) {
      console.error(err);
      const errMsg = err?.response?.data?.message || err?.message || 'Gagal mengunggah berkas.';
      alert(`Gagal mengunggah berkas: ${errMsg}`);
      setUploadProgress(0);
      setUploadingFileName('');
    }
  };

  // Verify Document Mutation
  const verifyMutation = useMutation({
    mutationFn: async (payload: { docId: string; status: 'verified' | 'rejected'; data: any }) => {
      // Map UI 'verified'/'rejected' to backend enum: 'validated'/'rejected'
      const verificationStatus = payload.status === 'verified' ? 'validated' : 'rejected';
      await api.post(`/api/v1/documents/${payload.docId}/verify`, {
        verificationStatus,
        extractedData: payload.data
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matters'] });
      setVerifyingDoc(null);
      alert('Review verifikasi berkas disimpan.');
    }
  });

  const triggerDownload = async (docId: string, fileName: string) => {
    try {
      // GET download URL in NestJS v1.1
      const res = await api.get(`/api/v1/documents/${docId}/download-url`);
      const signedUrl = res.data.url;
      // Open in browser or show alert
      window.open(signedUrl, '_blank');
      alert(`Membuka URL Unduhan Aman untuk ${fileName}`);
    } catch (err) {
      alert('Gagal mengambil url unduhan.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4 style={{ fontSize: '1.05rem', fontWeight: 600 }}>Berkas Persyaratan Perkara</h4>
        
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {/* Document Type Dropdown */}
          <select
            value={selectedDocType}
            onChange={(e) => setSelectedDocType(e.target.value)}
            className="input-field select-field"
            style={{
              padding: '0.4rem 0.8rem',
              fontSize: '0.85rem',
              width: '180px',
              margin: 0
            }}
            disabled={uploadProgress > 0}
          >
            {VALID_DOC_TYPES.map(type => (
              <option key={type.value} value={type.value} style={{ background: 'var(--bg-secondary)' }}>
                {type.label}
              </option>
            ))}
          </select>

          {/* Upload Button */}
          <div style={{ position: 'relative' }}>
            <input 
              type="file" 
              id="file-upload" 
              style={{ display: 'none' }} 
              onChange={handleFileUpload} 
              disabled={uploadProgress > 0}
            />
            <label htmlFor="file-upload" className="btn btn-secondary" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0 }}>
              <Upload size={16} />
              Unggah Berkas
            </label>
          </div>
        </div>
      </div>

      {/* Progress Bar indicator */}
      {uploadProgress > 0 && (
        <div style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.4rem' }}>
            <span>Mengunggah {uploadingFileName}...</span>
            <span>{uploadProgress}%</span>
          </div>
          <div style={{ width: '100%', height: '6px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ width: `${uploadProgress}%`, height: '100%', backgroundColor: 'var(--color-emerald)', transition: 'width 0.2s' }} />
          </div>
        </div>
      )}

      {/* Documents list table */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {safeDocuments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Belum ada berkas pendukung terunggah. Silakan pilih kategori dan unggah dokumen.
          </div>
        ) : (
          safeDocuments.map((d: any) => {
            const docTypeLabel = VALID_DOC_TYPES.find(t => t.value === d.documentType)?.label || d.documentType?.toUpperCase() || 'DOKUMEN';
            const statusLabels: Record<string, { label: string, className: string }> = {
              missing: { label: 'BELUM UNGGAH', className: 'badge-gray' },
              uploaded: { label: 'MENUNGGU VERIFIKASI', className: 'badge-blue' },
              under_review: { label: 'SEDANG DIREVIEW', className: 'badge-yellow' },
              revision_required: { label: 'BUTUH REVISI', className: 'badge-red' },
              verified: { label: 'TERVERIFIKASI', className: 'badge-green' },
              rejected: { label: 'DITOLAK', className: 'badge-red' }
            };
            const currentStatus = statusLabels[d.verificationStatus || 'missing'] || { label: (d.verificationStatus || '').toUpperCase(), className: 'badge-gray' };
            const docName = `${docTypeLabel} - Perkara`;
            
            return (
              <div 
                key={d.id} 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1rem',
                  backgroundColor: 'rgba(0,0,0,0.15)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-glass)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <FileText size={20} style={{ color: 'var(--color-emerald)' }} />
                  <div>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, display: 'block' }}>{docName}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Tipe: {docTypeLabel}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span className={`badge ${currentStatus.className}`} style={{ fontSize: '0.65rem' }}>
                    {currentStatus.label}
                  </span>
                  
                  {d.verificationStatus !== 'missing' && (
                    <button 
                      onClick={() => triggerDownload(d.id, docName)}
                      className="btn btn-secondary" 
                      style={{ padding: '0.35rem 0.6rem' }} 
                      title="Unduh Berkas"
                    >
                      <Download size={14} />
                    </button>
                  )}

                  {d.verificationStatus === 'uploaded' && (
                    <button 
                      onClick={() => {
                        setVerifyingDoc(d);
                        setExtractedDataText(JSON.stringify({ nik: '3519028271890001', nama: 'Budi Santoso' }, null, 2));
                      }}
                      className="btn btn-primary" 
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                    >
                      Verifikasi
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Verification modal sheet */}
      {verifyingDoc && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100
        }}>
          <div className="glass-panel animate-fade-in" style={{ width: '450px', padding: '2rem', border: '1px solid var(--border-glass-active)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Review Verifikasi Berkas</h3>
              <button onClick={() => setVerifyingDoc(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Berkas: <strong>{(VALID_DOC_TYPES.find(t => t.value === verifyingDoc.documentType)?.label || verifyingDoc.documentType || '').toUpperCase()}</strong>
            </p>

            <div className="input-group">
              <label className="input-label">Hasil Verifikasi</label>
              <select 
                value={verifyStatus} 
                onChange={(e) => setVerifyStatus(e.target.value as any)}
                className="input-field select-field"
              >
                <option value="verified" style={{ background: 'var(--bg-secondary)' }}>Terima & Validasi Dokumen</option>
                <option value="rejected" style={{ background: 'var(--bg-secondary)' }}>Tolak Dokumen</option>
              </select>
            </div>

            <div className="input-group">
              <label className="input-label">Hasil Ekstraksi OCR Data (JSON)</label>
              <textarea 
                value={extractedDataText}
                onChange={(e) => setExtractedDataText(e.target.value)}
                className="input-field" 
                rows={5} 
                style={{ fontFamily: 'monospace', fontSize: '0.85rem', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button onClick={() => setVerifyingDoc(null)} className="btn btn-secondary">
                Batal
              </button>
              <button 
                onClick={() => {
                  try {
                    const parsed = JSON.parse(extractedDataText);
                    verifyMutation.mutate({
                      docId: verifyingDoc.id,
                      status: verifyStatus,
                      data: parsed
                    });
                  } catch (e) {
                    alert('Format JSON data hasil ekstraksi tidak valid.');
                  }
                }} 
                className="btn btn-primary"
              >
                Simpan Review
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// 2. ASSIGNMENT TAB
function AssignTab({ matterId }: { matterId: string }) {
  const queryClient = useQueryClient();
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [selectedNotaryId, setSelectedNotaryId] = useState<string | null>(null);
  const [uiState, setUiState] = useState<'idle' | 'loading' | 'showing' | 'deciding' | 'done'>('idle');

  // Fetch current assignment recommendation status
  const { data: matter } = useQuery({
    queryKey: ['matters', matterId],
    queryFn: async () => {
      const res = await api.get(`/api/v1/matters/${matterId}`);
      return res.data;
    }
  });

  const generateRecommendations = async () => {
    setUiState('loading');
    try {
      const res = await api.post(`/api/v1/matters/${matterId}/assignment/recommendations`);
      const data = Array.isArray(res.data) ? res.data : res.data?.data || [];
      setRecommendations(data);
      setUiState('showing');
    } catch (e) {
      alert('Gagal menghasilkan rekomendasi.');
      setUiState('idle');
    }
  };

  const confirmAssignment = async () => {
    if (!selectedNotaryId) return;
    setUiState('deciding');
    try {
      await api.post(`/api/v1/matters/${matterId}/assignment/decide`, {
        // DecideAssignmentDto: { notaryId: string }
        notaryId: selectedNotaryId
      });
      queryClient.invalidateQueries({ queryKey: ['matters'] });
      setUiState('done');
      alert('Notaris berhasil ditugaskan untuk perkara ini.');
    } catch (e) {
      alert('Gagal menetapkan penugasan.');
      setUiState('showing');
    }
  };

  const rejectAssignment = async () => {
    const reason = prompt('Masukkan alasan penolakan rekomendasi:');
    if (!reason) return;
    try {
      await api.post(`/api/v1/matters/${matterId}/assignment/reject`, { reason });
      queryClient.invalidateQueries({ queryKey: ['matters'] });
      setUiState('idle');
      setRecommendations([]);
      alert('Rekomendasi berhasil ditolak.');
    } catch (e) {
      alert('Gagal menolak rekomendasi.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <h4 style={{ fontSize: '1.05rem', fontWeight: 600 }}>Penugasan Notaris PPAT</h4>

      {matter?.assignmentStatus === 'assigned' || matter?.assignmentStatus === 'accepted' ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '3rem',
          textAlign: 'center',
          backgroundColor: 'rgba(16, 185, 129, 0.05)',
          border: '1px dashed var(--color-emerald)',
          borderRadius: '12px'
        }}>
          <CheckCircle2 size={48} style={{ color: 'var(--color-emerald)', marginBottom: '1rem' }} />
          <h5 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.25rem' }}>Notaris Telah Ditugaskan</h5>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Notaris sedang menyusun minuta draf akta dan menjadwalkan agenda penandatanganan rapat.
          </p>
        </div>
      ) : uiState === 'idle' ? (
        <div style={{
          padding: '2.5rem',
          textAlign: 'center',
          backgroundColor: 'rgba(0,0,0,0.15)',
          borderRadius: '10px',
          border: '1px dashed var(--border-glass)'
        }}>
          <AlertTriangle size={32} style={{ color: 'var(--color-gold)', margin: '0 auto 1rem' }} />
          <h5 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Rekomendasi Belum Dibuat</h5>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            Sebelum menetapkan penugasan Notaris, hasilkan rekomendasi kandidat berdasarkan jarak geografis dan beban kerja.
          </p>
          <button onClick={generateRecommendations} className="btn btn-primary">
            Dapatkan Rekomendasi Notaris
          </button>
        </div>
      ) : uiState === 'loading' ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          Menganalisis matriks ketersediaan Notaris terdekat...
        </div>
      ) : (
        /* Candidates Selection View */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Daftar kandidat yang dipertimbangkan sistem saat ini:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {(Array.isArray(recommendations) ? recommendations : []).map((r: any) => {
              const profileId = r.notary_profile_id || r.notaryProfileId || r.id;
              const profileRelation = r.notary_profiles || r.notaryProfile;
              const userRelation = profileRelation?.users || profileRelation?.user;
              
              const finalName = r.fullName || userRelation?.full_name || userRelation?.fullName || 'Raka Pratama, SH., M.Kn.';
              const finalSla = r.slaPerformanceScore || r.performance_score || 80;
              const finalReason = r.scoreReason || (r.coverage_score ? `Berdasarkan skor cakupan BPN (${r.coverage_score}%)` : 'Sesuai dengan kriteria wilayah');
              
              return (
                <div 
                  key={profileId} 
                  onClick={() => setSelectedNotaryId(profileId)}
                  style={{
                    padding: '1.25rem',
                    borderRadius: '10px',
                    border: selectedNotaryId === profileId ? '1px solid var(--color-emerald)' : '1px solid var(--border-glass)',
                    backgroundColor: selectedNotaryId === profileId ? 'rgba(16, 185, 129, 0.05)' : 'rgba(0,0,0,0.15)',
                    cursor: 'pointer',
                    transition: 'var(--transition-smooth)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{finalName}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-emerald)', fontWeight: 600 }}>SLA Score: {finalSla}%</span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.3' }}>{finalReason}</p>
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                    <span>Jarak: {r.distanceKm || 2.5} Km</span>
                    <span>•</span>
                    <span>Beban Kasus Aktif: {r.activeMattersCount || 1} berkas</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button onClick={rejectAssignment} className="btn btn-secondary" style={{ border: '1px solid rgba(239, 68, 68, 0.25)', color: '#f87171' }}>
              Tolak Rekomendasi
            </button>
            <button onClick={confirmAssignment} disabled={!selectedNotaryId} className="btn btn-primary">
              Konfirmasi Penugasan Notaris
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// 3. ESCROW TAB
function EscrowTab({ matterId }: { matterId: string }) {
  const queryClient = useQueryClient();
  const [releaseAmount, setReleaseAmount] = useState('');
  const [selectedMilestone, setSelectedMilestone] = useState('');

  // Fetch escrow state
  const { data: escrow } = useQuery({
    queryKey: ['matters', matterId, 'escrow'],
    queryFn: async () => {
      const res = await api.get(`/api/v1/matters/${matterId}/escrow`);
      return res.data;
    }
  });

  const rawEscrow = escrow;
  const actualEscrow = (rawEscrow && typeof rawEscrow === 'object' && 'data' in rawEscrow && !('error' in rawEscrow))
    ? (rawEscrow as any).data
    : rawEscrow;

  const safeEscrow = actualEscrow || {};
  const safeMilestones = Array.isArray(safeEscrow?.milestones) ? safeEscrow.milestones : [];

  // Fetch releases
  const { data: releases = [], refetch: refetchReleases } = useQuery({
    queryKey: ['matters', matterId, 'escrow', 'releases'],
    queryFn: async () => {
      const res = await api.get(`/api/v1/matters/${matterId}/escrow/releases`);
      return Array.isArray(res.data) ? res.data : res.data?.data || [];
    }
  });

  const safeReleases = Array.isArray(releases) ? releases : [];

  // Mutations
  const markEligibleMutation = useMutation({
    mutationFn: async (milestoneId: string) => {
      await api.post(`/api/v1/matters/${matterId}/escrow/milestones/eligible`, { milestoneId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matters', matterId, 'escrow'] });
      alert('Milestone ditandai Eligible.');
    }
  });

  const approveMilestoneMutation = useMutation({
    mutationFn: async (milestoneId: string) => {
      await api.post(`/api/v1/matters/${matterId}/escrow/milestones/${milestoneId}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matters', matterId, 'escrow'] });
      alert('Milestone berhasil disetujui.');
    }
  });

  const createReleaseMutation = useMutation({
    mutationFn: async (payload: any) => {
      // Maker request
      await api.post(`/api/v1/matters/${matterId}/escrow/releases`, payload);
    },
    onSuccess: () => {
      setReleaseAmount('');
      setSelectedMilestone('');
      refetchReleases();
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      alert('Permintaan pencairan dana escrow (Maker) berhasil diajukan.');
    }
  });

  const approveReleaseMutation = useMutation({
    mutationFn: async (releaseId: string) => {
      // Checker approve
      await api.post(`/api/v1/escrow/releases/${releaseId}/approve`);
    },
    onSuccess: () => {
      refetchReleases();
      queryClient.invalidateQueries({ queryKey: ['matters', matterId, 'escrow'] });
      alert('Disetujui Checker. Dana siap didebet dari escrow.');
    },
    onError: (err: any) => {
      if (err.message.includes('SAME_USER')) {
        alert('ROLE CONSTRAINT: Pembuat release (Maker) tidak diperbolehkan menyetujui request miliknya sendiri (Checker)!');
      } else {
        alert('Gagal menyetujui pelepasan dana.');
      }
    }
  });

  const processReleaseMutation = useMutation({
    mutationFn: async (releaseId: string) => {
      await api.post(`/api/v1/escrow/releases/${releaseId}/process`);
    },
    onSuccess: () => {
      refetchReleases();
      queryClient.invalidateQueries({ queryKey: ['matters', matterId, 'escrow'] });
      alert('Pencairan dana escrow diproses transfer.');
    }
  });

  if (!escrow || !actualEscrow) return <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Memuat catatan escrow...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Escrow ledger summary */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '1rem',
        padding: '1.25rem',
        backgroundColor: 'rgba(0,0,0,0.15)',
        borderRadius: '10px',
        border: '1px solid var(--border-glass)'
      }}>
        <div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Dana Escrow</span>
          <span style={{ fontSize: '1.2rem', fontWeight: 700, display: 'block', color: 'var(--text-primary)' }}>
            Rp {(safeEscrow.totalAmount || 0).toLocaleString('id-ID')}
          </span>
        </div>
        <div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Dana Terkunci</span>
          <span style={{ fontSize: '1.2rem', fontWeight: 700, display: 'block', color: 'var(--color-gold)' }}>
            Rp {(safeEscrow.pendingAmount || 0).toLocaleString('id-ID')}
          </span>
        </div>
        <div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Dana Terbayar</span>
          <span style={{ fontSize: '1.2rem', fontWeight: 700, display: 'block', color: 'var(--color-emerald)' }}>
            Rp {(safeEscrow.releasedAmount || 0).toLocaleString('id-ID')}
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2.5rem' }}>
        
        {/* Left: Milestones linear list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h5 style={{ fontWeight: 600, fontSize: '0.95rem' }}>Milestone Rencana Pencairan</h5>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {safeMilestones.map((m: any) => (
              <div 
                key={m.id} 
                style={{
                  padding: '1rem',
                  backgroundColor: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block' }}>{m.name}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Status: <strong style={{ color: m.status === 'approved' ? 'var(--color-emerald)' : m.status === 'eligible' ? 'var(--color-gold)' : 'var(--text-muted)' }}>{m.status.toUpperCase()}</strong>
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {m.status === 'pending' && (
                    <button 
                      onClick={() => markEligibleMutation.mutate(m.id)}
                      className="btn btn-secondary" 
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', color: 'var(--color-gold)' }}
                    >
                      Eligible
                    </button>
                  )}
                  {m.status === 'eligible' && (
                    <button 
                      onClick={() => approveMilestoneMutation.mutate(m.id)}
                      className="btn btn-primary" 
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                    >
                      Approve
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Maker Checker Payout creator */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h5 style={{ fontWeight: 600, fontSize: '0.95rem' }}>Pencairan Escrow (Maker-Checker)</h5>

          {/* Form */}
          <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">Milestone Terpilih</label>
              <select 
                value={selectedMilestone} 
                onChange={(e) => setSelectedMilestone(e.target.value)}
                className="input-field select-field"
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
              >
                <option value="">Pilih Milestone Approved</option>
                {safeMilestones.filter((m: any) => m.status === 'approved').map((m: any) => (
                  <option key={m.id} value={m.id} style={{ background: 'var(--bg-secondary)' }}>{m.name}</option>
                ))}
              </select>
            </div>

            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">Nominal Transfer (Rp)</label>
              <input 
                type="number" 
                value={releaseAmount}
                onChange={(e) => setReleaseAmount(e.target.value)}
                className="input-field" 
                placeholder="Jumlah pencairan" 
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
              />
            </div>

            <button 
              disabled={!selectedMilestone || !releaseAmount}
              onClick={() => createReleaseMutation.mutate({
                amount: Number(releaseAmount),
                milestoneId: selectedMilestone
              })}
              className="btn btn-accent-gold" 
              style={{ padding: '0.5rem', fontSize: '0.85rem' }}
            >
              Ajukan Transfer (Maker)
            </button>
          </div>
        </div>

      </div>

      {/* Disbursal releases tracker logs */}
      <div style={{ marginTop: '1rem' }}>
        <h5 style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.75rem' }}>Daftar Pengajuan Pencairan</h5>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {safeReleases.length === 0 ? (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>Belum ada pengajuan pencairan</div>
          ) : (
            safeReleases.map((r: any) => (
              <div 
                key={r.id}
                style={{
                  padding: '0.75rem 1rem',
                  backgroundColor: 'rgba(0,0,0,0.15)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: '6px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.85rem'
                }}
              >
                <div>
                  <span style={{ fontWeight: 600 }}>Rp {(r.amount || 0).toLocaleString('id-ID')}</span>
                  <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem', fontSize: '0.75rem' }}>
                    Maker: {r.createdByName} • Status: <strong style={{ color: r.status === 'processed' ? 'var(--color-emerald)' : r.status === 'approved' ? 'var(--color-gold)' : 'var(--text-muted)' }}>{r.status.toUpperCase()}</strong>
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {r.status === 'pending' && (
                    <button 
                      onClick={() => approveReleaseMutation.mutate(r.id)}
                      className="btn btn-primary" 
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                    >
                      Setujui (Checker)
                    </button>
                  )}
                  {r.status === 'approved' && (
                    <button 
                      onClick={() => processReleaseMutation.mutate(r.id)}
                      className="btn btn-accent-gold" 
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                    >
                      Disburse Transfer
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
}

// 4. BPN LOG TAB
function BpnTab({ matterId }: { matterId: string }) {
  const [bpnTitle, setBpnTitle] = useState('');
  const [bpnNotes, setBpnNotes] = useState('');
  const [bpnRef, setBpnRef] = useState('');
  const [bpnStep, setBpnStep] = useState<'submitted' | 'received' | 'juridical_review' | 'bookkeeping' | 'completed'>('submitted');

  const { data: bpnLogsData, refetch } = useQuery({
    queryKey: ['matters', matterId, 'bpn'],
    queryFn: async () => {
      const res = await api.get(`/api/v1/matters/${matterId}/bpn-steps`);
      return res.data;
    }
  });

  const safeBpnLogs = Array.isArray(bpnLogsData)
    ? bpnLogsData
    : (bpnLogsData && Array.isArray((bpnLogsData as any).data))
      ? (bpnLogsData as any).data
      : [];

  const addStepMutation = useMutation({
    mutationFn: async (payload: any) => {
      await api.post(`/api/v1/matters/${matterId}/bpn-steps`, payload);
    },
    onSuccess: () => {
      setBpnTitle('');
      setBpnNotes('');
      setBpnRef('');
      refetch();
      alert('Tahapan BPN berhasil ditambahkan ke berkas log.');
    }
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2.5rem' }}>
        
        {/* Left: SLA tracking logs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h5 style={{ fontWeight: 600, fontSize: '0.95rem' }}>Log Pengurusan BPN</h5>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {safeBpnLogs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Belum ada log pengurusan berkas ke BPN. Tambahkan langkah baru.
              </div>
            ) : (
              safeBpnLogs.map((log: any) => (
                <div 
                  key={log.id}
                  style={{
                    padding: '1rem',
                    borderLeft: `3px solid ${log.slaStatus === 'danger' ? 'var(--color-crimson)' : log.slaStatus === 'warning' ? 'var(--color-gold)' : 'var(--color-emerald)'}`,
                    backgroundColor: 'rgba(255,255,255,0.01)',
                    border: '1px solid var(--border-glass)',
                    borderRadius: '0 8px 8px 0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.4rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{log.title}</span>
                    <span className={`badge ${log.slaStatus === 'danger' ? 'badge-red' : log.slaStatus === 'warning' ? 'badge-yellow' : 'badge-green'}`} style={{ fontSize: '0.6rem' }}>
                      {log.slaStatus === 'danger' ? 'DELAY' : 'ON TIME'}
                    </span>
                  </div>
                  {log.referenceNumber && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-gold)', fontFamily: 'monospace' }}>
                      Ref No: {log.referenceNumber}
                    </span>
                  )}
                  {log.notes && <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{log.notes}</p>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    <span>Oleh: {log.createdByName} • {new Date(log.createdAt).toLocaleDateString('id-ID')}</span>
                    <span>Durasi: {log.slaDays} hari (Target {log.slaTargetDays} hari)</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Append steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h5 style={{ fontWeight: 600, fontSize: '0.95rem' }}>Tambah Catatan Log BPN</h5>

          <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">Tahap BPN</label>
              <select 
                value={bpnStep} 
                onChange={(e) => {
                  const val = e.target.value as any;
                  setBpnStep(val);
                  // Auto-fill titles
                  const labelMap: Record<string, string> = {
                    submitted: 'Berkas Diserahkan ke BPN',
                    received: 'Berkas Diterima BPN',
                    juridical_review: 'Telaah Yuridis',
                    bookkeeping: 'Pembukuan Hak Pertanahan',
                    completed: 'Sertifikat Selesai Dicetak'
                  };
                  setBpnTitle(labelMap[val]);
                }}
                className="input-field select-field"
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
              >
                <option value="submitted" style={{ background: 'var(--bg-secondary)' }}>1. Diserahkan ke BPN</option>
                <option value="received" style={{ background: 'var(--bg-secondary)' }}>2. Diterima Loket BPN</option>
                <option value="juridical_review" style={{ background: 'var(--bg-secondary)' }}>3. Telaah Yuridis berkas</option>
                <option value="bookkeeping" style={{ background: 'var(--bg-secondary)' }}>4. Pembukuan Sertifikat</option>
                <option value="completed" style={{ background: 'var(--bg-secondary)' }}>5. Selesai Terbit</option>
              </select>
            </div>

            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">Judul Aktivitas</label>
              <input 
                type="text" 
                value={bpnTitle || 'Berkas Diserahkan ke BPN'}
                onChange={(e) => setBpnTitle(e.target.value)}
                className="input-field" 
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
              />
            </div>

            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">Nomor Resi / Referensi BPN</label>
              <input 
                type="text" 
                value={bpnRef}
                onChange={(e) => setBpnRef(e.target.value)}
                className="input-field" 
                placeholder="BPN-2026-XXXX"
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
              />
            </div>

            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">Catatan Tambahan</label>
              <textarea 
                value={bpnNotes}
                onChange={(e) => setBpnNotes(e.target.value)}
                className="input-field" 
                rows={3} 
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', resize: 'none' }}
              />
            </div>

            <button 
              onClick={() => addStepMutation.mutate({
                // CreateBpnStepDto: { stepCode, notes?, bpnReferenceNumber? }
                stepCode: bpnStep,
                notes: bpnNotes || undefined,
                bpnReferenceNumber: bpnRef || undefined
              })}
              className="btn btn-primary" 
              style={{ padding: '0.5rem', fontSize: '0.85rem' }}
            >
              Tambah ke Log
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}

// 5. MEETING AGENDA TAB
function AgendaTab({ matterId }: { matterId: string }) {
  const [schedDate, setSchedDate] = useState('');
  const [schedLoc, setSchedLoc] = useState('');
  const [schedNotes, setSchedNotes] = useState('');

  const { data: schedulesData, refetch } = useQuery({
    queryKey: ['matters', matterId, 'schedules'],
    queryFn: async () => {
      const res = await api.get(`/api/v1/matters/${matterId}/schedules`);
      return res.data;
    }
  });

  // ScheduleListResponseDto wraps items in { items: [] }
  const safeSchedules = Array.isArray(schedulesData)
    ? schedulesData
    : Array.isArray((schedulesData as any)?.items)
      ? (schedulesData as any).items
      : Array.isArray((schedulesData as any)?.data)
        ? (schedulesData as any).data
        : [];

  const createScheduleMutation = useMutation({
    mutationFn: async (payload: any) => {
      await api.post(`/api/v1/matters/${matterId}/schedules`, payload);
    },
    onSuccess: () => {
      setSchedDate('');
      setSchedLoc('');
      setSchedNotes('');
      refetch();
      alert('Agenda rapat penandatanganan akta berhasil dijadwalkan!');
    }
  });

  const confirmAttendanceMutation = useMutation({
    mutationFn: async (scheduleId: string) => {
      await api.post(`/api/v1/schedules/${scheduleId}/confirm-attendance`);
    },
    onSuccess: () => {
      refetch();
      alert('Kehadiran dikonfirmasi. Rapat terlaksana dan status berkas dipindahkan ke Penandatanganan Selesai.');
    }
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2.5rem' }}>
        
        {/* Left: Schedules log list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h5 style={{ fontWeight: 600, fontSize: '0.95rem' }}>Jadwal Rapat Penandatanganan</h5>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {safeSchedules.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Belum ada jadwal rapat penandatanganan akta.
              </div>
            ) : (
              safeSchedules.map((s: any) => (
                <div 
                  key={s.id}
                  style={{
                    padding: '1rem',
                    backgroundColor: 'rgba(0,0,0,0.15)',
                    border: '1px solid var(--border-glass)',
                    borderRadius: '8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, display: 'block', color: 'var(--color-gold)' }}>
                      {new Date(s.scheduledAt).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-primary)', margin: '0.2rem 0' }}>
                      Lokasi: {s.location || s.locationDetail || 'Kantor Notaris'}
                    </p>
                    {s.notes && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Catatan: {s.notes}</span>}
                  </div>

                  <div>
                    {s.status === 'confirmed' ? (
                      <button 
                        onClick={() => confirmAttendanceMutation.mutate(s.id)}
                        className="btn btn-primary" 
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                      >
                        Konfirmasi Kehadiran
                      </button>
                    ) : (
                      <span className="badge badge-green" style={{ fontSize: '0.65rem' }}>
                        HADIR & SELESAI
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Setup schedule form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h5 style={{ fontWeight: 600, fontSize: '0.95rem' }}>Buat Jadwal Agenda Baru</h5>

          <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">Waktu Pertemuan *</label>
              <input 
                type="datetime-local" 
                value={schedDate}
                onChange={(e) => setSchedDate(e.target.value)}
                className="input-field" 
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                required
              />
            </div>

            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">Catatan Lokasi *</label>
              <input 
                type="text" 
                value={schedLoc}
                onChange={(e) => setSchedLoc(e.target.value)}
                className="input-field" 
                placeholder="Contoh: Kantor Notaris Sejahtera, Ruang Rapat 2"
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                required
              />
            </div>

            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">Catatan/Keperluan Agenda</label>
              <textarea 
                value={schedNotes}
                onChange={(e) => setSchedNotes(e.target.value)}
                className="input-field" 
                rows={3} 
                placeholder="Contoh: Penandatanganan Minuta Akta Jual Beli Ruko"
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', resize: 'none' }}
              />
            </div>

            <button 
              disabled={!schedDate || !schedLoc}
              onClick={() => createScheduleMutation.mutate({
                // CreateScheduleDto: { scheduledAt, location, notes? }
                scheduledAt: new Date(schedDate).toISOString(),
                location: schedLoc,
                notes: schedNotes
              })}
              className="btn btn-primary" 
              style={{ padding: '0.5rem', fontSize: '0.85rem' }}
            >
              Jadwalkan Agenda Rapat
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}

// 6. CHAT PERKARA TAB
function ChatTab({ matterId }: { matterId: string }) {
  const queryClient = useQueryClient();
  const [msgInput, setMsgInput] = useState('');

  // Fetch chat messages
  const { data: messagesData, refetch } = useQuery({
    queryKey: ['chat', 'messages', matterId],
    queryFn: async () => {
      const res = await api.get(`/api/v1/matters/${matterId}/chat/messages`);
      return res.data;
    },
    refetchInterval: 5000 // Poll every 5 seconds inside active chat panel
  });

  const safeMessages = Array.isArray(messagesData)
    ? messagesData
    : (messagesData && Array.isArray((messagesData as any).data))
      ? (messagesData as any).data
      : [];

  // Mark thread read on mount
  useEffect(() => {
    async function markRead() {
      // Find thread to get threadId
      try {
        const threadsRes = await api.get('/api/v1/chat/threads');
        const threadsList = Array.isArray(threadsRes.data)
          ? threadsRes.data
          : (threadsRes.data && Array.isArray(threadsRes.data.data))
            ? threadsRes.data.data
            : [];
        const match = threadsList.find((t: any) => t.matterId === matterId);
        if (match) {
          await api.post(`/api/v1/chat/threads/${match.threadId}/read`);
          queryClient.invalidateQueries({ queryKey: ['chat', 'threads'] });
        }
      } catch (e) {
        console.error('Failed to mark chat as read:', e);
      }
    }
    markRead();
  }, [matterId]);

  const sendMsgMutation = useMutation({
    mutationFn: async (txt: string) => {
      await api.post(`/api/v1/matters/${matterId}/chat/messages`, { bodyText: txt });
    },
    onSuccess: () => {
      setMsgInput('');
      refetch();
      queryClient.invalidateQueries({ queryKey: ['chat', 'threads'] });
    }
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!msgInput.trim()) return;
    sendMsgMutation.mutate(msgInput);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '400px' }}>
      
      {/* Bubble messages */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingRight: '0.5rem', marginBottom: '1rem' }}>
        {safeMessages.length === 0 ? (
          <div style={{ textAlign: 'center', margin: 'auto', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Belum ada komunikasi di dalam perkara ini. Mulai kirim pesan.
          </div>
        ) : (
          safeMessages.map((m: any) => {
            const isMe = m.senderRole === 'ADMIN';
            
            // Normalize non-string body texts defensively
            const messageText = normalizeBodyText(m.bodyText);

            return (
              <div 
                key={m.id}
                style={{
                  alignSelf: isMe ? 'flex-end' : 'flex-start',
                  maxWidth: '75%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isMe ? 'flex-end' : 'flex-start'
                }}
              >
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.15rem' }}>
                  {m.senderName} ({m.senderRole})
                </span>
                
                <div style={{
                  padding: '0.6rem 1rem',
                  borderRadius: '12px',
                  backgroundColor: isMe ? 'var(--color-emerald-glow)' : 'rgba(255,255,255,0.03)',
                  border: isMe ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid var(--border-glass)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  lineHeight: '1.4'
                }}>
                  {messageText}
                </div>

                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  {new Date(m.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Input panel form */}
      <form onSubmit={handleSend} style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid var(--border-glass)', paddingTop: '1rem' }}>
        <input 
          type="text" 
          value={msgInput}
          onChange={(e) => setMsgInput(e.target.value)}
          className="input-field" 
          placeholder="Ketik pesan perkara... (Ctrl+Enter untuk kirim)" 
          style={{ marginBottom: 0 }}
        />
        <button type="submit" disabled={sendMsgMutation.isPending} className="btn btn-primary" style={{ padding: '0.5rem 1.25rem' }}>
          <Send size={14} />
        </button>
      </form>

    </div>
  );
}

// 7. PAYMENTS TAB — GET /api/v1/matters/{matterId}/payments
// Response: PaymentListResponseDto { items: PaymentItemDto[] }
function PaymentsTab({ matterId }: { matterId: string }) {
  const { data: paymentsData, isLoading } = useQuery({
    queryKey: ['matters', matterId, 'payments'],
    queryFn: async () => {
      const res = await api.get(`/api/v1/matters/${matterId}/payments`);
      return res.data;
    },
    enabled: !!matterId
  });

  // PaymentListResponseDto wraps in { items: [] }
  const safePayments: any[] = Array.isArray(paymentsData)
    ? paymentsData
    : Array.isArray((paymentsData as any)?.items)
      ? (paymentsData as any).items
      : Array.isArray((paymentsData as any)?.data)
        ? (paymentsData as any).data
        : [];

  const STATUS_COLORS: Record<string, string> = {
    unpaid: 'badge-gray',
    pending: 'badge-yellow',
    paid: 'badge-blue',
    verified: 'badge-green',
    failed: 'badge-red',
    refunded: 'badge-orange',
    disputed: 'badge-red',
  };

  if (isLoading) {
    return <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Memuat data pembayaran...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <h4 style={{ fontSize: '1.05rem', fontWeight: 600 }}>Riwayat Pembayaran Perkara</h4>

      {safePayments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Belum ada data pembayaran untuk perkara ini.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {safePayments.map((p: any) => (
            <div
              key={p.id}
              style={{
                padding: '1.25rem',
                backgroundColor: 'rgba(0,0,0,0.15)',
                border: '1px solid var(--border-glass)',
                borderRadius: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                    Rp {(p.totalAmount || p.amount || 0).toLocaleString('id-ID')}
                  </span>
                  {p.taxAmount ? (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                      (termasuk pajak Rp {p.taxAmount.toLocaleString('id-ID')})
                    </span>
                  ) : null}
                </div>
                <span className={`badge ${STATUS_COLORS[p.status] || 'badge-gray'}`} style={{ fontSize: '0.7rem' }}>
                  {p.status?.toUpperCase() || 'UNKNOWN'}
                </span>
              </div>

              {p.description && (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>{p.description}</p>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {p.referenceId && (
                  <span>Ref: <strong style={{ fontFamily: 'monospace', color: 'var(--color-gold)' }}>{p.referenceId}</strong></span>
                )}
                {p.createdAt && (
                  <span>Dibuat: <strong>{new Date(p.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</strong></span>
                )}
                {p.paidAt && (
                  <span>Dibayar: <strong style={{ color: 'var(--color-emerald)' }}>{new Date(p.paidAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</strong></span>
                )}
                {p.verifiedAt && (
                  <span>Terverifikasi: <strong style={{ color: 'var(--color-emerald)' }}>{new Date(p.verifiedAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</strong></span>
                )}
                {p.dueDate && (
                  <span>Jatuh Tempo: <strong>{new Date(p.dueDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</strong></span>
                )}
              </div>

              {p.paymentUrl && (
                <a
                  href={p.paymentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary"
                  style={{ fontSize: '0.8rem', padding: '0.4rem 0.9rem', display: 'inline-flex', gap: '0.4rem', alignSelf: 'flex-start', textDecoration: 'none' }}
                >
                  <CreditCard size={14} />
                  Buka Link Pembayaran
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

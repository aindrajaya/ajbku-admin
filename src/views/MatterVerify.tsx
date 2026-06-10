import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { ArrowLeft, ZoomIn, ZoomOut, Maximize2, Download, AlertTriangle, FileText, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';

type DocType = 'ktp' | 'npwp' | 'sertifikat' | 'pbb' | 'kk' | 'lainnya';

export default function MatterVerify() {
  const { id: matterId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Resize state persisted in localStorage
  const [leftWidth, setLeftWidth] = useState<number>(() => {
    const saved = localStorage.getItem('ajbku-verify-split-width');
    return saved ? Number(saved) : 60; // default 60%
  });
  const isResizing = useRef(false);

  // Tab & document state
  const [activeTab, setActiveTab] = useState<DocType>('ktp');
  const [revisionNote, setRevisionNote] = useState('');
  const [showRevisionDrawer, setShowRevisionDrawer] = useState(false);

  // KTP Form Fields (Section 6.4)
  const [ktpForm, setKtpForm] = useState({
    nik: '',
    fullName: '',
    birthPlace: '',
    birthDate: '',
    address: '',
    maritalStatus: 'kawin',
    occupation: ''
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Fetch matter details
  const { data: matter } = useQuery({
    queryKey: ['matters', matterId],
    queryFn: async () => {
      const res = await api.get(`/api/v1/matters/${matterId}`);
      return res.data;
    }
  });

  // Fetch documents list
  const { data: rawDocs = [], refetch: refetchDocs } = useQuery({
    queryKey: ['matters', matterId, 'docs'],
    queryFn: async () => {
      const res = await api.get(`/api/v1/matters/${matterId}/documents`);
      return Array.isArray(res.data) ? res.data : res.data?.data || [];
    }
  });

  const documents = Array.isArray(rawDocs) ? rawDocs : [];

  // Active document of current tab type
  const activeDoc = documents.find((d: any) => d.docType?.toLowerCase() === activeTab);

  // Signed URL with 14 minutes auto-refresh (Section 8.2)
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const urlExpiresAt = useRef<number | null>(null);

  const fetchSignedUrl = async (docId: string) => {
    try {
      const res = await api.get(`/api/v1/documents/${docId}/download-url`);
      setSignedUrl(res.data.url);
      urlExpiresAt.current = Date.now() + 14 * 60 * 1000; // 14 mins
    } catch (err) {
      console.error('Failed to fetch download url', err);
    }
  };

  useEffect(() => {
    if (activeDoc?.id) {
      fetchSignedUrl(activeDoc.id);
    } else {
      setSignedUrl(null);
    }
  }, [activeDoc?.id]);

  // Auto-refresh timer check every minute
  useEffect(() => {
    const timer = setInterval(() => {
      if (activeDoc?.id && urlExpiresAt.current && Date.now() >= urlExpiresAt.current) {
        console.log('[AJBku] Refreshing signed URL in background...');
        fetchSignedUrl(activeDoc.id);
      }
    }, 60000);
    return () => clearInterval(timer);
  }, [activeDoc?.id]);

  // Draft auto-save to localStorage every 30 seconds
  useEffect(() => {
    const autoSaveTimer = setInterval(() => {
      if (activeTab === 'ktp' && (ktpForm.nik || ktpForm.fullName)) {
        localStorage.setItem(`ajbku-draft-ktp-${matterId}`, JSON.stringify(ktpForm));
        console.debug('[AJBku] Auto-saved draft details locally.');
      }
    }, 30000);
    return () => clearInterval(autoSaveTimer);
  }, [ktpForm, activeTab, matterId]);

  // Load local draft on mount
  useEffect(() => {
    const saved = localStorage.getItem(`ajbku-draft-ktp-${matterId}`);
    if (saved) {
      try {
        setKtpForm(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
  }, [matterId]);

  // Split Pane Resizer
  const handleMouseDown = (e: React.MouseEvent) => {
    isResizing.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing.current) return;
    const percentage = (e.clientX / window.innerWidth) * 100;
    if (percentage > 30 && percentage < 80) {
      setLeftWidth(percentage);
    }
  };

  const handleMouseUp = () => {
    isResizing.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    localStorage.setItem('ajbku-verify-split-width', String(leftWidth));
  };

  // Image zoom scale states
  const [scale, setScale] = useState(1.0);

  // Form Field validation
  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (activeTab === 'ktp') {
      if (!ktpForm.nik || ktpForm.nik.length !== 16 || !/^\d+$/.test(ktpForm.nik)) {
        errors.nik = 'NIK harus 16 digit angka.';
      }
      if (!ktpForm.fullName) errors.fullName = 'Nama lengkap wajib diisi.';
      if (!ktpForm.birthPlace) errors.birthPlace = 'Tempat lahir wajib diisi.';
      if (!ktpForm.birthDate) errors.birthDate = 'Tanggal lahir wajib diisi.';
      if (!ktpForm.address) errors.address = 'Alamat wajib diisi.';
      if (!ktpForm.occupation) errors.occupation = 'Pekerjaan wajib diisi.';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Verification mutations
  const verifyMutation = useMutation({
    mutationFn: async (payload: { status: 'validated' | 'needs_revision' | 'rejected'; note?: string; data?: any }) => {
      if (!activeDoc?.id) throw new Error('No active document to verify.');
      return await api.post(`/api/v1/documents/${activeDoc.id}/verify`, {
        verificationStatus: payload.status,
        revisionNote: payload.note || undefined,
        extractedData: payload.data || undefined
      });
    },
    onSuccess: (_, variables) => {
      refetchDocs();
      queryClient.invalidateQueries({ queryKey: ['matters', matterId] });
      setShowRevisionDrawer(false);
      setRevisionNote('');
      // Clear draft storage on successful validation
      if (variables.status === 'validated') {
        localStorage.removeItem(`ajbku-draft-ktp-${matterId}`);
      }
      alert(`Status dokumen berhasil diperbarui ke: ${variables.status.toUpperCase()}`);
    },
    onError: (err: any) => {
      alert('Gagal memperbarui status dokumen.');
    }
  });

  const handleValidate = () => {
    if (!validateForm()) return;
    verifyMutation.mutate({
      status: 'validated',
      data: ktpForm
    });
  };

  const handleRevisionSubmit = () => {
    if (!revisionNote.trim()) {
      alert('Alasan revisi wajib diisi.');
      return;
    }
    verifyMutation.mutate({
      status: 'needs_revision',
      note: revisionNote
    });
  };

  const handleReject = () => {
    const confirm = window.confirm('Apakah Anda yakin ingin menolak dokumen ini?');
    if (!confirm) return;
    verifyMutation.mutate({
      status: 'rejected'
    });
  };

  const isFormValid = ktpForm.nik && ktpForm.fullName && ktpForm.birthPlace && ktpForm.birthDate && ktpForm.address && ktpForm.occupation;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100%', overflow: 'hidden', backgroundColor: 'var(--bg-primary)', position: 'fixed', top: 0, left: 0, zIndex: 100 }}>
      
      {/* Top Header Row */}
      <header className="glass-panel" style={{
        height: '60px',
        borderRadius: '0',
        padding: '0 2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderTop: 'none', borderLeft: 'none', borderRight: 'none',
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={() => navigate(-1)} className="btn btn-secondary" style={{ padding: '0.4rem' }}>
            <ArrowLeft size={16} />
          </button>
          <div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>Verifikasi Dokumen</span>
              <span style={{ color: 'var(--text-muted)' }}>•</span>
              <span style={{ color: 'var(--color-emerald)', fontSize: '0.9rem', fontFamily: 'monospace' }}>
                {matter?.caseNumber || matter?.matterNumber || 'CASE-NUMBER'}
              </span>
            </h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Perkara: {matter?.title || 'Loading...'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {(['ktp', 'npwp', 'sertifikat', 'pbb', 'kk', 'lainnya'] as DocType[]).map((tab) => {
            const doc = documents.find((d: any) => d.docType?.toLowerCase() === tab);
            const isUploaded = !!doc;
            const isVerified = doc?.status === 'verified';
            
            return (
              <button
                key={tab}
                onClick={() => {
                  if (isUploaded) setActiveTab(tab);
                }}
                disabled={!isUploaded}
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  borderRadius: '6px',
                  cursor: isUploaded ? 'pointer' : 'not-allowed',
                  backgroundColor: activeTab === tab 
                    ? 'rgba(16, 185, 129, 0.15)' 
                    : isUploaded ? 'rgba(255,255,255,0.02)' : 'transparent',
                  border: activeTab === tab
                    ? '1px solid var(--color-emerald)'
                    : '1px solid transparent',
                  color: isVerified 
                    ? 'var(--color-emerald)' 
                    : isUploaded ? 'var(--text-primary)' : 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  opacity: isUploaded ? 1 : 0.4
                }}
              >
                {isVerified && <CheckCircle2 size={12} />}
                {tab.toUpperCase()}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Split Pane Container */}
      <div style={{ flex: 1, display: 'flex', width: '100%', overflow: 'hidden', position: 'relative' }}>
        
        {/* Left Panel: Preview Frame */}
        <div style={{ width: `${leftWidth}%`, height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-secondary)', overflow: 'hidden' }}>
          
          {/* Preview Toolbar */}
          <div style={{ height: '40px', borderBottom: '1px solid var(--border-glass)', padding: '0 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>
              Berkas: <strong>{activeDoc?.fileName || 'Tidak ada file'}</strong>
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => setScale(s => Math.min(s + 0.2, 3))} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>
                <ZoomIn size={14} />
              </button>
              <button onClick={() => setScale(s => Math.max(s - 0.2, 0.5))} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>
                <ZoomOut size={14} />
              </button>
              <button onClick={() => setScale(1.0)} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>
                Fit
              </button>
              {signedUrl && (
                <a href={signedUrl} download target="_blank" rel="noreferrer" className="btn btn-primary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>
                  <Download size={14} />
                  Download
                </a>
              )}
            </div>
          </div>

          {/* Render Area */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto', padding: '1rem', background: '#0e121a' }}>
            {signedUrl ? (
              activeDoc?.fileName?.endsWith('.pdf') ? (
                /* PDF Viewer Embed */
                <iframe 
                  src={`${signedUrl}#zoom=${scale * 100}`} 
                  title="PDF Viewer" 
                  style={{ width: '100%', height: '100%', border: 'none' }}
                />
              ) : (
                /* Image View with scale transform */
                <img 
                  src={signedUrl} 
                  alt="Document Preview" 
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    transform: `scale(${scale})`,
                    transition: 'transform 0.15s ease'
                  }}
                />
              )
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                <FileText size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                <span>Dokumen {activeTab.toUpperCase()} belum diunggah untuk perkara ini.</span>
              </div>
            )}
          </div>
        </div>

        {/* DRAGGABLE DIVIDER */}
        <div 
          onMouseDown={handleMouseDown}
          style={{
            width: '6px',
            height: '100%',
            cursor: 'col-resize',
            backgroundColor: 'var(--border-glass)',
            zIndex: 5,
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-emerald)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--border-glass)'}
        />

        {/* Right Panel: Form Fields */}
        <div style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-primary)', overflow: 'hidden' }}>
          
          <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem', marginBottom: '1.25rem' }}>
              Ekstraksi Dokumen ({activeTab.toUpperCase()})
            </h3>

            {activeTab === 'ktp' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">NIK (Nomor Induk Kependudukan) *</label>
                  <input 
                    type="text" 
                    maxLength={16}
                    className="input-field" 
                    placeholder="Masukkan 16 digit NIK"
                    value={ktpForm.nik}
                    onChange={(e) => setKtpForm({ ...ktpForm, nik: e.target.value.replace(/\D/g, '') })}
                  />
                  {formErrors.nik && <span style={{ color: 'var(--color-crimson)', fontSize: '0.75rem' }}>{formErrors.nik}</span>}
                </div>

                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Nama Lengkap *</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="Sesuai KTP"
                    value={ktpForm.fullName}
                    onChange={(e) => setKtpForm({ ...ktpForm, fullName: e.target.value })}
                  />
                  {formErrors.fullName && <span style={{ color: 'var(--color-crimson)', fontSize: '0.75rem' }}>{formErrors.fullName}</span>}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Tempat Lahir *</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      placeholder="Contoh: Madiun"
                      value={ktpForm.birthPlace}
                      onChange={(e) => setKtpForm({ ...ktpForm, birthPlace: e.target.value })}
                    />
                    {formErrors.birthPlace && <span style={{ color: 'var(--color-crimson)', fontSize: '0.75rem' }}>{formErrors.birthPlace}</span>}
                  </div>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Tanggal Lahir *</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      placeholder="DD/MM/YYYY"
                      value={ktpForm.birthDate}
                      onChange={(e) => setKtpForm({ ...ktpForm, birthDate: e.target.value })}
                    />
                    {formErrors.birthDate && <span style={{ color: 'var(--color-crimson)', fontSize: '0.75rem' }}>{formErrors.birthDate}</span>}
                  </div>
                </div>

                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Alamat Lengkap *</label>
                  <textarea 
                    className="input-field" 
                    rows={3} 
                    placeholder="Alamat sesuai KTP"
                    value={ktpForm.address}
                    onChange={(e) => setKtpForm({ ...ktpForm, address: e.target.value })}
                    style={{ resize: 'none' }}
                  />
                  {formErrors.address && <span style={{ color: 'var(--color-crimson)', fontSize: '0.75rem' }}>{formErrors.address}</span>}
                </div>

                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Status Perkawinan *</label>
                  <select 
                    value={ktpForm.maritalStatus} 
                    onChange={(e) => setKtpForm({ ...ktpForm, maritalStatus: e.target.value })}
                    className="input-field select-field"
                  >
                    <option value="kawin" style={{ background: 'var(--bg-secondary)' }}>Kawin</option>
                    <option value="belum_kawin" style={{ background: 'var(--bg-secondary)' }}>Belum Kawin</option>
                    <option value="cerai" style={{ background: 'var(--bg-secondary)' }}>Cerai</option>
                  </select>
                </div>

                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Pekerjaan *</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="Contoh: Wiraswasta"
                    value={ktpForm.occupation}
                    onChange={(e) => setKtpForm({ ...ktpForm, occupation: e.target.value })}
                  />
                  {formErrors.occupation && <span style={{ color: 'var(--color-crimson)', fontSize: '0.75rem' }}>{formErrors.occupation}</span>}
                </div>

              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Form ekstraksi untuk {activeTab.toUpperCase()} sedang dikembangkan. Gunakan verifikasi dasar untuk menyetujui.
              </div>
            )}
          </div>

          {/* Action Row */}
          <div style={{ height: '70px', borderTop: '1px solid var(--border-glass)', padding: '0 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', backgroundColor: 'var(--bg-secondary)' }}>
            <button 
              disabled={!activeDoc}
              onClick={handleReject} 
              className="btn btn-secondary" 
              style={{ border: '1px solid rgba(239, 68, 68, 0.25)', color: '#f87171' }}
            >
              Tolak
            </button>
            <button 
              disabled={!activeDoc}
              onClick={() => setShowRevisionDrawer(true)} 
              className="btn btn-secondary" 
              style={{ border: '1px solid rgba(217,119,6,0.25)', color: 'var(--color-gold)' }}
            >
              Minta Revisi
            </button>
            <button 
              disabled={!activeDoc || (activeTab === 'ktp' && !isFormValid)} 
              onClick={handleValidate} 
              className="btn btn-primary" 
              style={{ marginLeft: 'auto' }}
            >
              <CheckCircle2 size={16} />
              Validasi Dokumen
            </button>
          </div>

        </div>

      </div>

      {/* Revision Drawer / Bottom Sheet Modal */}
      {showRevisionDrawer && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 110
        }}>
          <div className="glass-panel animate-fade-in" style={{ width: '400px', padding: '2rem', border: '1px solid var(--border-glass-active)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertTriangle size={18} style={{ color: 'var(--color-gold)' }} />
              Ajukan Revisi Dokumen
            </h3>
            
            <div className="input-group">
              <label className="input-label">Catatan Alasan Revisi *</label>
              <textarea 
                className="input-field" 
                rows={4}
                placeholder="Tulis alasan detail mengapa berkas ini perlu diunggah ulang..."
                value={revisionNote}
                onChange={(e) => setRevisionNote(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button onClick={() => setShowRevisionDrawer(false)} className="btn btn-secondary">
                Batal
              </button>
              <button onClick={handleRevisionSubmit} className="btn btn-primary">
                Kirim Permintaan
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

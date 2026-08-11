import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { ArrowLeft, ZoomIn, ZoomOut, Download, AlertTriangle, FileText, CheckCircle2, XCircle } from 'lucide-react';
import { notifyError, notifySuccess } from '../store/ui';
import { renderPdfToCanvas } from '../lib/pdfviewer';
import { useMatterDocumentViewer } from '../hooks/useMatterDocumentViewer';
import { useAuth } from '../auth/AuthProvider';
import { canVerifyDocuments } from '../auth/access';
import {
  buildVerifyDraftKey,
  buildVerifyDocumentKey,
  buildVerifySplitKey,
  createInitialVerifyDocumentForms,
  isVerifyFormValid,
  normalizeVerifyDocumentKey,
  normalizeVerifyDocType,
  normalizeVerifyPartyRole,
  validateVerifyForm,
  verifyDocumentTabs,
  verifyDocFields,
  type VerifyDocumentKey,
  type VerifyDocType,
  type VerifyPartyRole,
} from '../lib/verify';

type NormalizedMatterDocument = {
  id: string;
  docType: string;
  docKey: VerifyDocumentKey;
  partyRole?: VerifyPartyRole;
  status: string;
  fileName: string;
  mimeType?: string;
};

export default function MatterVerify() {
  const { id: matterId } = useParams({ strict: false }) as { id: string };
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scopeKey = user?.id || 'anonymous';
  const splitPaneKey = buildVerifySplitKey(scopeKey);
  const [leftWidth, setLeftWidth] = useState<number>(() => Number(localStorage.getItem(splitPaneKey) || 60));
  const [viewerMode, setViewerMode] = useState<'preview' | 'verify'>(() => {
    const stored = localStorage.getItem(`ajbku-verify-mode-${matterId}`);
    return stored === 'preview' ? 'preview' : 'verify';
  });
  const [activeTab, setActiveTab] = useState<VerifyDocumentKey>('ktp:seller');
  const [revisionNote, setRevisionNote] = useState('');
  const [showRevisionDrawer, setShowRevisionDrawer] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [revisionError, setRevisionError] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const isResizing = useRef(false);
  const [forms, setForms] = useState<Record<VerifyDocumentKey, Record<string, string>>>(() => createInitialVerifyDocumentForms());

  const matterQuery = useQuery({
    queryKey: ['matters', matterId],
    queryFn: async () => (await api.get<any>(`/api/v1/matters/${matterId}`)).data,
  });
  const matterPayload = matterQuery.data;
  const matterRecord = useMemo(() => {
    if (matterPayload && typeof matterPayload === 'object' && 'data' in matterPayload && !Array.isArray((matterPayload as any).data)) {
      return (matterPayload as any).data;
    }
    return matterPayload;
  }, [matterPayload]);

  const documents = useMemo<NormalizedMatterDocument[]>(() => {
    const rows = Array.isArray((matterRecord as any)?.documents) ? (matterRecord as any).documents : [];

    return rows
      .map((doc: any) => {
        const rawDocType =
          doc?.docType ||
          doc?.documentType ||
          doc?.document_type ||
          doc?.type ||
          doc?.document?.docType ||
          doc?.document?.documentType ||
          doc?.latestVersion?.docType ||
          doc?.latestVersion?.documentType ||
          doc?.latestVersion?.document_type;
        const docType = normalizeVerifyDocType(rawDocType);
        const partyRole = normalizeVerifyPartyRole(
          doc?.partyRole ||
          doc?.party_role ||
          doc?.document?.partyRole ||
          doc?.document?.party_role ||
          doc?.latestVersion?.partyRole ||
          doc?.latestVersion?.party_role ||
          rawDocType
        );
        return {
          id: String(doc?.id || ''),
          docType,
          docKey: docType ? buildVerifyDocumentKey(docType, partyRole) : '',
          partyRole,
          status: String(doc?.status || doc?.verificationStatus || doc?.verification_status || ''),
          fileName: String(
            doc?.fileName ||
            doc?.latestVersion?.fileName ||
            doc?.latestVersion?.originalFilename ||
            doc?.latestVersion?.original_filename ||
            ''
          ),
          mimeType: doc?.mimeType || doc?.latestVersion?.mimeType || doc?.latestVersion?.mime_type,
        };
      })
      .filter((doc: NormalizedMatterDocument) => doc.id && doc.docType && doc.docKey);
  }, [matterRecord]);

  const orderedTabs = useMemo(() => verifyDocumentTabs, []);
  const activeTabConfig = orderedTabs.find((tab) => tab.key === activeTab) || orderedTabs[0];
  const activeDocType = activeTabConfig.docType;
  const activeDoc = documents.find((doc) => doc.docKey === activeTab);
  const viewer = useMatterDocumentViewer(matterId, activeDoc || null);
  const activeDraftKey = buildVerifyDraftKey(matterId, activeTab, scopeKey);
  const verificationSummary = (() => {
    const toStatusMeta = (status: string, isUploaded: boolean) => {
      const normalized = status.toLowerCase();
      if (!isUploaded) return { label: 'Belum diunggah', tone: 'muted' as const };
      if (['validated', 'verified'].includes(normalized)) return { label: 'Tervalidasi', tone: 'success' as const };
      if (['needs_revision', 'revision_required'].includes(normalized)) return { label: 'Butuh revisi', tone: 'warning' as const };
      if (normalized === 'rejected') return { label: 'Ditolak', tone: 'danger' as const };
      return { label: 'Belum divalidasi', tone: 'pending' as const };
    };

    const uploadedDocuments = documents.filter((doc) => doc.id);
    const validatedCount = uploadedDocuments.filter((doc) => ['validated', 'verified'].includes(doc.status.toLowerCase())).length;
    const activeStatus = toStatusMeta(activeDoc?.status || '', Boolean(activeDoc));

    return {
      active: {
        type: activeTab,
        docLabel: activeTabConfig.label,
        isUploaded: Boolean(activeDoc),
        fileName: activeDoc?.fileName || '',
        statusLabel: activeStatus.label,
        tone: activeStatus.tone,
      },
      validatedCount,
      totalCount: uploadedDocuments.length,
    };
  })();

  const handleDownload = async () => {
    if (!activeDoc?.fileName || !viewer.documentBytes) {
      notifyError('Binary dokumen belum siap. Coba beberapa detik lagi.', 'Dokumen');
      return;
    }

    try {
      const result = await window.electronAPI.dialog.saveFile({
        buffer: viewer.documentBytes.slice().buffer as ArrayBuffer,
        defaultFilename: activeDoc.fileName,
        filters: [{ name: 'Documents', extensions: [activeDoc.fileName.split('.').pop() || 'pdf'] }],
      });
      if (result.success) {
        notifySuccess(`Dokumen tersimpan di ${result.filePath}.`, 'Dokumen');
      } else {
        notifyError(`Gagal menyimpan dokumen ke filesystem lokal: ${result.error || 'aksi dibatalkan.'}`, 'Dokumen');
      }
    } catch (error: any) {
      notifyError(`Gagal menyimpan dokumen ke filesystem lokal: ${error?.message || 'unknown error'}`, 'Dokumen');
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      localStorage.setItem(activeDraftKey, JSON.stringify(forms[activeTab]));
    }, 30000);
    return () => clearInterval(timer);
  }, [activeDraftKey, activeDocType, forms]);

  useEffect(() => {
    orderedTabs.forEach((tab) => {
      const stored = localStorage.getItem(buildVerifyDraftKey(matterId, tab.key, scopeKey));
      if (!stored) return;
      try {
        const parsed = JSON.parse(stored);
        setForms((prev) => ({ ...prev, [tab.key]: { ...prev[tab.key], ...parsed } }));
      } catch {
        // Ignore corrupted draft payloads.
      }
    });
  }, [matterId, orderedTabs, scopeKey]);

  useEffect(() => {
    const preferredTab = normalizeVerifyDocumentKey(localStorage.getItem(`ajbku-verify-target-${matterId}`));
    const preferredMode = localStorage.getItem(`ajbku-verify-mode-${matterId}`);
    setViewerMode(preferredMode === 'preview' ? 'preview' : 'verify');
    if (preferredTab && orderedTabs.some((tab) => tab.key === preferredTab)) {
      setActiveTab(preferredTab);
      localStorage.removeItem(`ajbku-verify-target-${matterId}`);
      return;
    }

    if (documents.length > 0 && !documents.some((doc) => doc.docKey === activeTab)) {
      const firstUploaded = orderedTabs.find((tab) => documents.some((doc) => doc.docKey === tab.key));
      if (firstUploaded?.key) {
        setActiveTab(firstUploaded.key);
      }
    }
  }, [activeTab, documents, matterId, orderedTabs]);

  const isPreviewOnly = viewerMode === 'preview';
  const canSubmitVerification = canVerifyDocuments(user?.roles);

  useEffect(() => {
    if (!viewer.documentBytes || !viewer.isPdf || !canvasRef.current) {
      return;
    }

    let cancelled = false;
    setPdfError(null);

    void (async () => {
      try {
        const canvas = canvasRef.current;
        const bytes = viewer.documentBytes;
        if (!canvas || !bytes) return;
        const context = canvas.getContext('2d');
        context?.clearRect(0, 0, canvas.width, canvas.height);
        await renderPdfToCanvas(canvas, bytes.slice(), Math.max(0.6, scale));
      } catch {
        if (!cancelled) {
          setPdfError(viewer.error || 'PDF gagal dirender. Gunakan tautan unduh aman untuk membuka dokumen.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [scale, viewer.documentBytes, viewer.error, viewer.isPdf]);

  const handleMouseDown = () => {
    isResizing.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (event: MouseEvent) => {
    if (!isResizing.current) return;
    const next = (event.clientX / window.innerWidth) * 100;
    if (next > 30 && next < 80) setLeftWidth(next);
  };

  const handleMouseUp = () => {
    isResizing.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    localStorage.setItem(splitPaneKey, String(leftWidth));
  };

  const validateActiveForm = () => {
    const nextErrors = validateVerifyForm(activeDocType, forms[activeTab]);
    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const verifyMutation = useMutation({
    mutationFn: async (payload: { status: 'validated' | 'needs_revision' | 'rejected'; note?: string }) => {
      if (!activeDoc?.id) throw new Error('No active document');
      return api.post(`/api/v1/documents/${activeDoc.id}/verify`, {
        verificationStatus: payload.status,
        revisionNote: payload.note,
        extractedData: Object.fromEntries(
          Object.entries(forms[activeTab] || {}).map(([key, value]) => [key, String(value ?? '').trim()])
        ),
      });
    },
    onSuccess: async (_, variables) => {
      localStorage.removeItem(activeDraftKey);
      setShowRevisionDrawer(false);
      setRevisionNote('');
      setRevisionError(null);
      const feedbackLabel =
        variables.status === 'validated'
          ? 'tervalidasi'
          : variables.status === 'needs_revision'
            ? 'diminta revisi'
            : 'ditolak';
      setFeedback(`Dokumen ${activeTabConfig.label} berhasil ${feedbackLabel}. Status di atas form diambil ulang dari database.`);
      await queryClient.invalidateQueries({ queryKey: ['matters', matterId] });
      await queryClient.refetchQueries({ queryKey: ['matters', matterId], type: 'active' });
      if (variables.status === 'validated') {
        const nextTab = orderedTabs.find((tab) => {
          const doc = documents.find((item) => item.docKey === tab.key);
          return doc && doc.status !== 'validated' && doc.status !== 'verified' && tab.key !== activeTab;
        });
        if (nextTab) setActiveTab(nextTab.key);
      }
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || error?.message || 'Gagal memperbarui status dokumen.';
      setFeedback(message);
      if (showRevisionDrawer) {
        setRevisionError(message);
      }
    },
  });

  const isFormValid = isVerifyFormValid(activeDocType, forms[activeTab]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 70px - 4rem)', minHeight: '640px', width: '100%', overflow: 'hidden', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-glass)', borderRadius: '10px' }}>
      <header style={{ minHeight: '60px', borderRadius: '10px 10px 0 0', padding: '0 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', borderBottom: '1px solid var(--border-glass)', backgroundColor: 'var(--bg-primary)', boxShadow: '0 12px 28px rgba(0,0,0,0.18)', position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={() => navigate({ to: '/matters/$id', params: { id: matterId } })} className="btn btn-secondary" style={{ padding: '0.4rem' }}>
            <ArrowLeft size={16} />
          </button>
          <div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700 }}>
              Verifikasi Dokumen • <span style={{ color: 'var(--color-emerald)', fontFamily: 'monospace' }}>{(matterRecord as any)?.caseNumber || (matterRecord as any)?.matterNumber || 'CASE-NUMBER'}</span>
            </h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Perkara: {(matterRecord as any)?.title || 'Loading...'}</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '58%', minWidth: 0, padding: '0.45rem 0' }}>
          {orderedTabs.map((tab) => {
            const doc = documents.find((item) => item.docKey === tab.key);
            const isUploaded = Boolean(doc);
            const isVerified = ['verified', 'validated'].includes(String(doc?.status));
            return (
              <button key={tab.key} onClick={() => { if (isUploaded) setActiveTab(tab.key); }} disabled={!isUploaded} style={{ padding: '0.35rem 0.65rem', minWidth: '96px', fontSize: '0.72rem', fontWeight: 600, borderRadius: '6px', cursor: isUploaded ? 'pointer' : 'not-allowed', backgroundColor: activeTab === tab.key ? 'rgba(16, 185, 129, 0.15)' : isUploaded ? 'rgba(255,255,255,0.02)' : 'transparent', border: activeTab === tab.key ? '1px solid var(--color-emerald)' : '1px solid transparent', color: isVerified ? 'var(--color-emerald)' : isUploaded ? 'var(--text-primary)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', opacity: isUploaded ? 1 : 0.4, whiteSpace: 'nowrap' }}>
                {isVerified ? <CheckCircle2 size={12} /> : null}
                {tab.label}
              </button>
            );
          })}
        </div>
      </header>

      <div style={{ flex: 1, display: 'flex', width: '100%', overflow: 'hidden' }}>
        <div style={{ width: isPreviewOnly ? '100%' : `${leftWidth}%`, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-secondary)' }}>
          <div style={{ height: '40px', borderBottom: '1px solid var(--border-glass)', padding: '0 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Berkas: <strong>{activeDoc?.fileName || 'Tidak ada file'}</strong></span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => setScale((value) => Math.min(value + 0.2, 3))} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}><ZoomIn size={14} /></button>
              <button onClick={() => setScale((value) => Math.max(value - 0.2, 0.6))} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}><ZoomOut size={14} /></button>
              {viewer.error ? (
                <button onClick={() => viewer.reload()} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>
                  Muat Ulang
                </button>
              ) : null}
              {viewer.documentBytes ? (
                <button onClick={handleDownload} className="btn btn-primary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>
                  <Download size={14} />
                  Download
                </button>
              ) : null}
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto', padding: '1rem', background: '#0e121a' }}>
            {viewer.documentObjectUrl ? viewer.isPdf ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }}>
                <canvas ref={canvasRef} style={{ maxWidth: '100%', height: 'auto', boxShadow: '0 12px 32px rgba(0,0,0,0.35)' }} />
                {pdfError ? <div style={{ color: '#fca5a5', fontSize: '0.8rem' }}>{pdfError}</div> : null}
              </div>
            ) : (
              <img
                src={viewer.documentObjectUrl}
                alt="Document Preview"
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  transform: `scale(${scale})`,
                  transformOrigin: 'center center',
                  transition: 'transform 0.15s ease',
                }}
              />
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                <FileText size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                <span>Dokumen {activeTabConfig.label} belum diunggah untuk perkara ini.</span>
              </div>
            )}
          </div>
        </div>

        {!isPreviewOnly ? <div onMouseDown={handleMouseDown} style={{ width: '6px', cursor: 'col-resize', backgroundColor: 'var(--border-glass)' }} /> : null}

        {!isPreviewOnly ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-primary)' }}>
            <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem', marginBottom: '1.25rem' }}>
                Input Data Dokumen ({activeTabConfig.label})
              </h3>

              <div style={{ marginBottom: '1rem', padding: '0.9rem 1rem', borderRadius: '10px', border: '1px solid var(--border-glass)', background: 'rgba(255,255,255,0.025)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.75rem' }}>
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>Status Verifikasi Dokumen {activeTabConfig.label}</div>
                    <div style={{ marginTop: '0.18rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>Status tab aktif ini diambil dari data matter terbaru.</div>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {verificationSummary.validatedCount}/{verificationSummary.totalCount} dokumen tervalidasi
                  </span>
                </div>

                <div>
                  {(() => {
                    const item = verificationSummary.active;
                    const palette =
                      item.tone === 'success'
                        ? { border: 'rgba(16,185,129,0.35)', bg: 'rgba(16,185,129,0.08)', color: 'var(--color-emerald)', icon: <CheckCircle2 size={16} /> }
                        : item.tone === 'warning'
                          ? { border: 'rgba(217,119,6,0.35)', bg: 'rgba(217,119,6,0.08)', color: 'var(--color-gold)', icon: <AlertTriangle size={16} /> }
                          : item.tone === 'danger'
                            ? { border: 'rgba(239,68,68,0.35)', bg: 'rgba(239,68,68,0.08)', color: '#fca5a5', icon: <XCircle size={16} /> }
                            : item.tone === 'pending'
                              ? { border: 'rgba(59,130,246,0.28)', bg: 'rgba(59,130,246,0.07)', color: 'var(--badge-blue-text)', icon: <FileText size={16} /> }
                              : { border: 'var(--border-glass)', bg: 'rgba(255,255,255,0.015)', color: 'var(--text-muted)', icon: <FileText size={16} /> };

                    return (
                      <div style={{ padding: '0.8rem 0.9rem', borderRadius: '8px', border: `1px solid ${palette.border}`, background: palette.bg, color: palette.color }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                            {palette.icon}
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: '0.78rem', fontWeight: 800 }}>{item.docLabel} - {item.statusLabel}</div>
                              <div style={{ marginTop: '0.2rem', color: 'var(--text-secondary)', fontSize: '0.7rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {item.fileName || (item.isUploaded ? 'Nama file tidak tersedia' : 'Dokumen belum diunggah')}
                              </div>
                            </div>
                          </div>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
                            Total dokumen: {verificationSummary.totalCount}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div style={{ marginBottom: '1rem', padding: '0.8rem 1rem', borderRadius: '10px', border: '1px solid rgba(16,185,129,0.18)', background: 'rgba(16,185,129,0.06)', color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: 1.5 }}>
                Admin wajib memasukkan data dokumen secara manual berdasarkan berkas yang tampil di panel kiri. Tidak ada OCR otomatis pada PRD ini.
              </div>

              {feedback ? (
                <div style={{ marginBottom: '1rem', padding: '0.8rem 1rem', borderRadius: '10px', border: '1px solid rgba(16,185,129,0.24)', background: 'rgba(16,185,129,0.08)', color: 'var(--color-emerald)' }}>
                  {feedback}
                </div>
              ) : null}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {verifyDocFields[activeDocType].map((field) => (
                  <div key={field.key} className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">{field.label}{field.required ? ' *' : ''}</label>
                    {field.key.toLowerCase().includes('address') || field.key === 'notes' ? (
                      <textarea className="input-field" rows={3} value={forms[activeTab][field.key] || ''} onBlur={validateActiveForm} onChange={(event) => setForms((prev) => ({ ...prev, [activeTab]: { ...prev[activeTab], [field.key]: event.target.value } }))} />
                    ) : (
                      <input
                        type={field.key === 'birthDate' ? 'date' : 'text'}
                        className="input-field"
                        value={forms[activeTab][field.key] || ''}
                        onBlur={validateActiveForm}
                        onChange={(event) => setForms((prev) => ({ ...prev, [activeTab]: { ...prev[activeTab], [field.key]: event.target.value.replace(field.key === 'nik' ? /\D/g : /$^/, '') } }))}
                      />
                    )}
                    {formErrors[field.key] ? <span style={{ color: 'var(--color-crimson)', fontSize: '0.75rem' }}>{formErrors[field.key]}</span> : null}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ minHeight: '88px', borderTop: '1px solid var(--border-glass)', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', backgroundColor: 'var(--bg-secondary)' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>Keputusan Verifikasi</div>
                <div style={{ marginTop: '0.2rem', fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  {activeDoc ? `Dokumen aktif: ${activeTabConfig.label}` : 'Pilih dokumen yang sudah diunggah.'}
                </div>
                {!canSubmitVerification ? (
                  <div style={{ marginTop: '0.35rem', color: '#fca5a5', fontSize: '0.72rem' }}>
                    Role Anda tidak memiliki akses verifikasi dokumen.
                  </div>
                ) : null}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.65rem', flexWrap: 'wrap' }}>
                <button
                  disabled={!activeDoc || !canSubmitVerification || verifyMutation.isPending}
                  onClick={() => verifyMutation.mutate({ status: 'rejected' })}
                  className="btn btn-secondary"
                  style={{ minWidth: '112px', justifyContent: 'center', border: '1px solid rgba(239, 68, 68, 0.35)', background: 'rgba(239, 68, 68, 0.08)', color: '#fca5a5' }}
                >
                  <XCircle size={16} />
                  Tolak
                </button>
                <button
                  disabled={!activeDoc || !canSubmitVerification || verifyMutation.isPending}
                  onClick={() => { setRevisionError(null); setShowRevisionDrawer(true); }}
                  className="btn btn-secondary"
                  style={{ minWidth: '138px', justifyContent: 'center', border: '1px solid rgba(217,119,6,0.35)', background: 'rgba(217,119,6,0.1)', color: 'var(--color-gold)' }}
                >
                  <AlertTriangle size={16} />
                  Minta Revisi
                </button>
                <button
                  disabled={!activeDoc || !isFormValid || !canSubmitVerification || verifyMutation.isPending}
                  onClick={() => { if (validateActiveForm()) verifyMutation.mutate({ status: 'validated' }); }}
                  className="btn btn-primary"
                  style={{ minWidth: '162px', justifyContent: 'center', boxShadow: '0 10px 24px rgba(16,185,129,0.22)' }}
                >
                  <CheckCircle2 size={16} />
                  Validasi Dokumen
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {showRevisionDrawer ? (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'grid', placeItems: 'center', zIndex: 110 }}>
          <div className="glass-panel animate-fade-in" style={{ width: '400px', padding: '2rem', border: '1px solid var(--border-glass-active)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertTriangle size={18} style={{ color: 'var(--color-gold)' }} />
              Ajukan Revisi Dokumen
            </h3>
            <div className="input-group">
              <label className="input-label">Catatan Alasan Revisi *</label>
              <textarea className="input-field" rows={4} value={revisionNote} onChange={(event) => setRevisionNote(event.target.value)} />
            </div>
            {!revisionNote.trim() ? <div style={{ color: '#fca5a5', fontSize: '0.75rem' }}>Alasan revisi wajib diisi sebelum request dikirim.</div> : null}
            {revisionError ? (
              <div style={{ marginTop: '0.75rem', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.32)', background: 'rgba(239,68,68,0.08)', color: '#fca5a5', fontSize: '0.8rem' }}>
                {revisionError}
              </div>
            ) : null}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button onClick={() => setShowRevisionDrawer(false)} className="btn btn-secondary">Batal</button>
              <button disabled={!canSubmitVerification || verifyMutation.isPending} onClick={() => { setRevisionError(null); if (!revisionNote.trim()) return; verifyMutation.mutate({ status: 'needs_revision', note: revisionNote }); }} className="btn btn-primary">
                {verifyMutation.isPending ? 'Mengirim...' : 'Kirim Permintaan'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

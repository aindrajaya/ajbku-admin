import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { ArrowLeft, AlertTriangle, FileText, CheckCircle2, XCircle } from 'lucide-react';
import { notifyError, notifySuccess } from '../store/ui';
import { useAuth } from '../auth/AuthProvider';
import { canVerifyDocuments } from '../auth/access';
import { queryKeys } from '../lib/queryKeys';
import { type MatterRequirement, type MatterRequirementsSnapshot, requirementInstruction, requirementStatusLabel } from '../lib/matterRequirements';
import AuthorizedDocumentViewer from '../components/AuthorizedDocumentViewer';
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
  verifyDocFields,
  type VerifyDocumentKey,
  type VerifyDocType,
  type VerifyPartyRole,
} from '../lib/verify';

type NormalizedMatterDocument = {
  id: string;
  docType: string;
  docKey: VerifyDocumentKey;
  documentSlotKey?: string;
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
  const scopeKey = user?.id || 'anonymous';
  const splitPaneKey = buildVerifySplitKey(scopeKey);
  const [leftWidth, setLeftWidth] = useState<number>(() => Number(localStorage.getItem(splitPaneKey) || 60));
  const [viewerMode, setViewerMode] = useState<'preview' | 'verify'>(() => {
    const stored = localStorage.getItem(`ajbku-verify-mode-${matterId}`);
    return stored === 'preview' ? 'preview' : 'verify';
  });
  const [activeTab, setActiveTab] = useState<string>('ktp:seller');
  const [revisionNote, setRevisionNote] = useState('');
  const [showRevisionDrawer, setShowRevisionDrawer] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [revisionError, setRevisionError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const isResizing = useRef(false);
  const [forms, setForms] = useState<Record<VerifyDocumentKey, Record<string, string>>>(() => createInitialVerifyDocumentForms());

  const matterQuery = useQuery({
    queryKey: ['matters', matterId],
    queryFn: async () => (await api.get<any>(`/api/v1/matters/${matterId}`)).data,
  });
  const matterPayload = matterQuery.data;
  const requirementsQuery = useQuery({
    queryKey: queryKeys.matterDocumentRequirements(matterId),
    queryFn: async () => (await api.get<MatterRequirementsSnapshot>(`/api/v1/matters/${matterId}/requirements`)).data,
    retry: false,
  });
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
          documentSlotKey: String(doc?.documentSlotKey || doc?.document_slot_key || doc?.latestVersion?.documentSlotKey || doc?.latestVersion?.document_slot_key || '') || undefined,
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

  const orderedTabs = useMemo(() => {
    const snapshot = requirementsQuery.data;
    // Compatibility display only for a legacy matter whose canonical snapshot cannot be read.
    // New and backfilled matters always render the immutable requirement snapshot above.
    if (!snapshot?.requirementsConfigured || !snapshot.requirements?.length) {
      return documents.map((doc, index) => {
        const key = doc.docKey;
        const partyRole = doc.partyRole || (['ktp', 'npwp', 'kk'].includes(doc.docType) ? 'seller' : undefined);
        const roleLabel = partyRole === 'seller' ? ' Penjual' : partyRole === 'buyer' ? ' Pembeli' : '';
        const requirement: MatterRequirement = {
          id: doc.id, requirementKey: key, requirementInstanceKey: null, documentSlotKey: key,
          documentType: doc.docType, partyRole, label: `${doc.docType.toUpperCase()}${roleLabel}`, description: null, required: false,
          requirementType: 'document' as const, requirementLevel: 'optional' as const, isRepeatable: false, minCount: 0,
          digitalUploadRequired: true, physicalOriginalRequired: false, physicalItemRequired: false, direction: 'input' as const,
          status: doc.status, displayOrder: index, maxCount: null, condition: null, document: { documentId: doc.id, verificationStatus: doc.status, fileName: doc.fileName },
        };
        return { key, requirement, docType: doc.docType, partyRole, label: requirement.label, status: doc.status, required: false };
      });
    }
    return [...snapshot.requirements]
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((item) => ({ key: item.id, requirement: item, docType: normalizeVerifyDocType(item.documentType), partyRole: normalizeVerifyPartyRole(item.partyRole), label: item.label, status: item.status, required: item.required }));
  }, [documents, requirementsQuery.data]);
  const activeTabConfig = orderedTabs.find((tab) => tab.key === activeTab) || orderedTabs[0];
  const activeRequirement = activeTabConfig?.requirement;
  const activeDocType = activeTabConfig?.docType || '';
  const activeDoc = activeRequirement?.document?.documentId ? {
    id: activeRequirement.document.documentId,
    docType: activeDocType,
    docKey: activeTab as VerifyDocumentKey,
    documentSlotKey: activeRequirement.documentSlotKey,
    status: activeRequirement.document.verificationStatus || activeRequirement.status,
    fileName: activeRequirement.document.fileName || '',
  } : documents.find((doc) => doc.documentSlotKey === activeRequirement?.documentSlotKey);
  const activeDraftKey = buildVerifyDraftKey(matterId, activeTab as VerifyDocumentKey, scopeKey);
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
        docLabel: activeTabConfig?.label || activeTab,
        isUploaded: Boolean(activeDoc),
        fileName: activeDoc?.fileName || '',
        statusLabel: activeStatus.label,
        tone: activeStatus.tone,
      },
      validatedCount,
      totalCount: uploadedDocuments.length,
    };
  })();

  useEffect(() => {
    const timer = setInterval(() => {
      localStorage.setItem(activeDraftKey, JSON.stringify(forms[activeTab as VerifyDocumentKey] || {}));
    }, 30000);
    return () => clearInterval(timer);
  }, [activeDraftKey, activeDocType, forms]);

  useEffect(() => {
    orderedTabs.forEach((tab) => {
      const stored = localStorage.getItem(buildVerifyDraftKey(matterId, tab.key as VerifyDocumentKey, scopeKey));
      if (!stored) return;
      try {
        const parsed = JSON.parse(stored);
        setForms((prev) => ({ ...prev, [tab.key as VerifyDocumentKey]: { ...(prev[tab.key as VerifyDocumentKey] || {}), ...parsed } }));
      } catch {
        // Ignore corrupted draft payloads.
      }
    });
  }, [matterId, orderedTabs, scopeKey]);

  useEffect(() => {
    const preferredTab = localStorage.getItem(`ajbku-verify-target-${matterId}`);
    const preferredMode = localStorage.getItem(`ajbku-verify-mode-${matterId}`);
    setViewerMode(preferredMode === 'preview' ? 'preview' : 'verify');
    const normalizedPreferredTab = normalizeVerifyDocumentKey(preferredTab);
    const preferredRequirement = preferredTab && orderedTabs.find((tab) => tab.key === preferredTab || tab.requirement.documentSlotKey === preferredTab || tab.key === normalizedPreferredTab);
    if (preferredRequirement) {
      setActiveTab(preferredRequirement.key);
      localStorage.removeItem(`ajbku-verify-target-${matterId}`);
      return;
    }

    if (orderedTabs.length && !orderedTabs.some((tab) => tab.key === activeTab)) {
      const firstUploaded = orderedTabs.find((tab) => tab.requirement.document?.documentId);
      if (firstUploaded?.key) {
        setActiveTab(firstUploaded.key);
      } else {
        setActiveTab(orderedTabs[0].key);
      }
    }
  }, [activeTab, documents, matterId, orderedTabs]);

  const isPreviewOnly = viewerMode === 'preview';
  const canSubmitVerification = canVerifyDocuments(user?.roles);

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

  const hasExtractionForm = activeDocType !== '' && Boolean(verifyDocFields[activeDocType as VerifyDocType]);
  const validateActiveForm = () => {
    if (!hasExtractionForm) return true;
    const nextErrors = validateVerifyForm(activeDocType as VerifyDocType, forms[activeTab as VerifyDocumentKey] || {});
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
          Object.entries(forms[activeTab as VerifyDocumentKey] || {}).map(([key, value]) => [key, String(value ?? '').trim()])
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
      setFeedback(`Dokumen ${activeTabConfig?.label || activeTab} berhasil ${feedbackLabel}. Status di atas form diambil ulang dari database.`);
      await queryClient.invalidateQueries({ queryKey: ['matters', matterId] });
      await queryClient.invalidateQueries({ queryKey: queryKeys.matterDocumentRequirements(matterId) });
      await queryClient.refetchQueries({ queryKey: ['matters', matterId], type: 'active' });
      if (variables.status === 'validated') {
        const nextTab = orderedTabs.find((tab) => {
          const doc = tab.requirement.document;
          return doc && doc.verificationStatus !== 'validated' && doc.verificationStatus !== 'verified' && tab.key !== activeTab;
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

  const isFormValid = !hasExtractionForm || isVerifyFormValid(activeDocType as VerifyDocType, forms[activeTab as VerifyDocumentKey] || {});

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 70px - 4rem)', minHeight: '640px', width: '100%', overflow: 'hidden', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-glass)', borderRadius: '10px' }}>
      <header style={{ height: '70px', flexShrink: 0, borderRadius: '10px 10px 0 0', padding: '0 2rem', display: 'flex', alignItems: 'center', gap: '1rem', borderBottom: '1px solid var(--border-glass)', backgroundColor: 'var(--bg-primary)', boxShadow: '0 12px 28px rgba(0,0,0,0.18)', position: 'relative', zIndex: 2, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0, minWidth: 0 }}>
          <button onClick={() => navigate({ to: '/matters/$id', params: { id: matterId } })} className="btn btn-secondary" style={{ padding: '0.4rem' }}>
            <ArrowLeft size={16} />
          </button>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700 }}>
              Verifikasi Dokumen • <span style={{ color: 'var(--color-emerald)', fontFamily: 'monospace' }}>{(matterRecord as any)?.caseNumber || (matterRecord as any)?.matterNumber || 'CASE-NUMBER'}</span>
            </h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Perkara: {(matterRecord as any)?.title || 'Loading...'}</p>
          </div>
        </div>

        <div aria-label="Daftar requirement" style={{ display: 'flex', flex: 1, minWidth: 0, gap: '0.45rem', flexWrap: 'nowrap', justifyContent: 'flex-start', overflowX: 'auto', overflowY: 'hidden', padding: '0.45rem 0', scrollbarWidth: 'thin' }}>
          {orderedTabs.map((tab) => {
            const doc = tab.requirement.document;
            const isUploaded = Boolean(doc?.documentId);
            const isVerified = ['verified', 'validated'].includes(String(doc?.verificationStatus || tab.requirement.status));
            return (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{ padding: '0.35rem 0.65rem', minWidth: '96px', flexShrink: 0, fontSize: '0.72rem', fontWeight: 600, borderRadius: '6px', cursor: 'pointer', backgroundColor: activeTab === tab.key ? 'rgba(16, 185, 129, 0.15)' : isUploaded ? 'rgba(255,255,255,0.02)' : 'transparent', border: activeTab === tab.key ? '1px solid var(--color-emerald)' : '1px solid transparent', color: isVerified ? 'var(--color-emerald)' : isUploaded ? 'var(--text-primary)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', opacity: 1, whiteSpace: 'nowrap' }}>
                {isVerified ? <CheckCircle2 size={12} /> : null}
                {tab.label}
              </button>
            );
          })}
        </div>
      </header>

      <div style={{ flex: 1, display: 'flex', width: '100%', overflow: 'hidden' }}>
        <div style={{ width: isPreviewOnly ? '100%' : `${leftWidth}%`, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-secondary)', padding: '.75rem' }}>
          <AuthorizedDocumentViewer document={activeDoc ? { documentId: activeDoc.id, fileName: activeDoc.fileName, mimeType: activeDoc.mimeType, downloadEndpoint: `/api/v1/documents/${activeDoc.id}/download-url` } : null} />
        </div>

        {!isPreviewOnly ? <div onMouseDown={handleMouseDown} style={{ width: '6px', cursor: 'col-resize', backgroundColor: 'var(--border-glass)' }} /> : null}

        {!isPreviewOnly ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-primary)' }}>
            <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem', marginBottom: '1.25rem' }}>
                Review Requirement ({activeTabConfig?.label || 'Pilih requirement'})
              </h3>

              {activeRequirement ? <div style={{ marginBottom: '1rem', padding: '.85rem 1rem', border: '1px solid var(--border-glass)', borderRadius: 10, fontSize: '.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.4rem', marginBottom: '.45rem' }}>
                  <span className="badge badge-gray">{activeRequirement.requirementType}</span>
                  <span className="badge badge-gray">{activeRequirement.requirementLevel}</span>
                  <span className="badge badge-gray">{requirementStatusLabel(activeRequirement.status)}</span>
                  {activeRequirement.physicalOriginalRequired ? <span className="badge badge-yellow">asli fisik wajib</span> : null}
                  {activeRequirement.isRepeatable ? <span className="badge badge-gray">{activeRequirement.minCount}–{activeRequirement.maxCount ?? '∞'} item</span> : null}
                </div>
                <div>{requirementInstruction(activeRequirement)}</div>
                {activeRequirement.condition != null ? <div style={{ marginTop: '.4rem', color: 'var(--color-gold)' }}>Kondisi: {typeof activeRequirement.condition === 'string' ? activeRequirement.condition : JSON.stringify(activeRequirement.condition)}. Keputusan applicability harus ditetapkan admin secara manual.</div> : null}
              </div> : null}

              <div style={{ marginBottom: '1rem', padding: '0.9rem 1rem', borderRadius: '10px', border: '1px solid var(--border-glass)', background: 'rgba(255,255,255,0.025)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.75rem' }}>
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>Status Verifikasi Dokumen {activeTabConfig?.label || '-'}</div>
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
                {activeRequirement && activeRequirement.requirementType !== 'document' ? <div style={{ padding: '1rem', border: '1px dashed var(--border-glass)', borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '.85rem' }}>{requirementInstruction(activeRequirement)}</div> : hasExtractionForm ? verifyDocFields[activeDocType as VerifyDocType].map((field) => (
                  <div key={field.key} className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">{field.label}{field.required ? ' *' : ''}</label>
                    {field.key.toLowerCase().includes('address') || field.key === 'notes' ? (
                      <textarea className="input-field" rows={3} value={forms[activeTab as VerifyDocumentKey]?.[field.key] || ''} onBlur={validateActiveForm} onChange={(event) => setForms((prev) => ({ ...prev, [activeTab as VerifyDocumentKey]: { ...(prev[activeTab as VerifyDocumentKey] || {}), [field.key]: event.target.value } }))} />
                    ) : (
                      <input
                        type={field.key === 'birthDate' ? 'date' : 'text'}
                        className="input-field"
                        value={forms[activeTab as VerifyDocumentKey]?.[field.key] || ''}
                        onBlur={validateActiveForm}
                        onChange={(event) => setForms((prev) => ({ ...prev, [activeTab as VerifyDocumentKey]: { ...(prev[activeTab as VerifyDocumentKey] || {}), [field.key]: event.target.value.replace(field.key === 'nik' ? /\D/g : /$^/, '') } }))}
                      />
                    )}
                    {formErrors[field.key] ? <span style={{ color: 'var(--color-crimson)', fontSize: '0.75rem' }}>{formErrors[field.key]}</span> : null}
                  </div>
                )) : <div style={{ padding: '1rem', border: '1px dashed var(--border-glass)', borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '.85rem' }}>Dokumen ini tidak memiliki form ekstraksi khusus. Tinjau berkas lalu pilih keputusan verifikasi.</div>}
              </div>
            </div>

            <div style={{ minHeight: '88px', borderTop: '1px solid var(--border-glass)', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', backgroundColor: 'var(--bg-secondary)' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>Keputusan Verifikasi</div>
                <div style={{ marginTop: '0.2rem', fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  {activeDoc ? `Dokumen aktif: ${activeTabConfig?.label || activeTab}` : 'Pilih dokumen yang sudah diunggah.'}
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

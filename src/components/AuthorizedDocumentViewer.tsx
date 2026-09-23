import React, { useEffect, useRef, useState } from 'react';
import { Download, Printer, RotateCw, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Maximize2, FileText } from 'lucide-react';
import { api } from '../api/client';
import { getPdfPageCount, renderPdfToCanvas } from '../lib/pdfviewer';
import { notifyError } from '../store/ui';

export type AuthorizedDocument = { documentId: string; fileName: string; mimeType?: string; downloadEndpoint: string };

export default function AuthorizedDocumentViewer({ document }: { document: AuthorizedDocument | null }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState('application/octet-stream');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const isPdf = mimeType === 'application/pdf' || document?.fileName.toLowerCase().endsWith('.pdf');

  const load = async (): Promise<{ bytes: Uint8Array; mimeType: string } | null> => {
    if (!document) return null;
    setLoading(true); setError(null); setPage(1); setPages(1); setScale(1); setRotation(0);
    try {
      const signed = await api.get<{ url: string }>(document.downloadEndpoint);
      const binary = await window.electronAPI.documents.fetchBinary(signed.data.url);
      if (!binary.success || !binary.buffer) throw new Error(binary.error || 'Gagal memuat dokumen.');
      const nextBytes = new Uint8Array(binary.buffer.slice(0));
      const nextMime = binary.contentType || document.mimeType || 'application/octet-stream';
      setBytes(nextBytes); setMimeType(nextMime);
      const nextUrl = URL.createObjectURL(new Blob([nextBytes], { type: nextMime }));
      setObjectUrl((previous) => { if (previous) URL.revokeObjectURL(previous); return nextUrl; });
      if (nextMime === 'application/pdf' || document.fileName.toLowerCase().endsWith('.pdf')) setPages(await getPdfPageCount(nextBytes.slice()));
      return { bytes: nextBytes, mimeType: nextMime };
    } catch (reason: any) { setError(reason?.message || 'Gagal memuat dokumen.'); return null; }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); }; }, [document?.documentId]);
  useEffect(() => {
    if (!bytes || !isPdf || !canvasRef.current) return;
    void renderPdfToCanvas(canvasRef.current, bytes.slice(), scale, page, rotation).catch(() => setError('PDF gagal dirender.'));
  }, [bytes, isPdf, page, rotation, scale]);

  const download = async () => {
    const fresh = await load();
    if (!fresh || !document) return;
    const result = await window.electronAPI.dialog.saveFile({ buffer: fresh.bytes.slice().buffer, defaultFilename: document.fileName, filters: [{ name: 'Documents', extensions: [document.fileName.split('.').pop() || 'pdf'] }] });
    if (!result.success && result.error) notifyError(result.error, 'Download dokumen');
  };
  const print = async () => {
    const fresh = await load();
    if (!fresh || !document) return;
    const result = await window.electronAPI.documents.print({ buffer: fresh.bytes.slice().buffer, mimeType: fresh.mimeType, fileName: document.fileName });
    if (!result.success) notifyError(result.error || 'Gagal membuka dialog print.', 'Print dokumen');
  };

  if (!document) return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}><FileText size={42} style={{ opacity: .35, marginBottom: '.75rem' }} /><div>Pilih dokumen untuk ditinjau.</div></div>;
  return <div style={{ display: 'flex', flexDirection: 'column', minHeight: '500px', border: '1px solid var(--border-glass)', borderRadius: '10px', overflow: 'hidden' }}>
    <div style={{ display: 'flex', gap: '.45rem', flexWrap: 'wrap', alignItems: 'center', padding: '.65rem .8rem', borderBottom: '1px solid var(--border-glass)' }}>
      <strong style={{ flex: 1, minWidth: 140, fontSize: '.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{document.fileName}</strong>
      {isPdf && <><button className="btn btn-secondary" onClick={() => setPage((v) => Math.max(1, v - 1))} disabled={page <= 1}><ChevronLeft size={15} /></button><span style={{ fontSize: '.78rem' }}>{page} / {pages}</span><button className="btn btn-secondary" onClick={() => setPage((v) => Math.min(pages, v + 1))} disabled={page >= pages}><ChevronRight size={15} /></button></>}
      <button className="btn btn-secondary" onClick={() => setScale((v) => Math.max(.6, v - .2))}><ZoomOut size={15} /></button><button className="btn btn-secondary" onClick={() => setScale((v) => Math.min(3, v + .2))}><ZoomIn size={15} /></button><button className="btn btn-secondary" onClick={() => setScale(1)} title="Fit width"><Maximize2 size={15} /></button><button className="btn btn-secondary" onClick={() => setRotation((v) => (v + 90) % 360)}><RotateCw size={15} /></button>
      <button className="btn btn-secondary" onClick={() => void print()} disabled={loading || !bytes}><Printer size={15} /> Print</button><button className="btn btn-primary" onClick={() => void download()} disabled={loading || !bytes}><Download size={15} /> Download</button>
    </div>
    <div style={{ flex: 1, minHeight: 430, overflow: 'auto', display: 'grid', placeItems: 'center', padding: '1rem', background: '#0e121a' }}>
      {loading ? <span style={{ color: '#cbd5e1' }}>Memuat dokumen...</span> : error ? <span style={{ color: '#fca5a5' }}>{error}</span> : isPdf ? <canvas ref={canvasRef} style={{ maxWidth: '100%', height: 'auto', boxShadow: '0 12px 32px rgba(0,0,0,.35)' }} /> : objectUrl ? <img src={objectUrl} alt={document.fileName} style={{ maxWidth: '100%', maxHeight: 640, transform: `scale(${scale}) rotate(${rotation}deg)` }} /> : null}
    </div>
  </div>;
}

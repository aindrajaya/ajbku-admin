import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';

type ViewerDoc = {
  id: string;
  fileName: string;
  mimeType?: string;
};

export function useMatterDocumentViewer(matterId: string, activeDoc: ViewerDoc | null) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [documentBytes, setDocumentBytes] = useState<Uint8Array | null>(null);
  const [documentObjectUrl, setDocumentObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);

  const isPdf = useMemo(
    () => Boolean(activeDoc?.fileName?.toLowerCase().endsWith('.pdf')),
    [activeDoc?.fileName]
  );

  useEffect(() => {
    let cancelled = false;
    let objectUrlToRevoke: string | null = null;

    async function loadDocument() {
      if (!activeDoc?.id) {
        setSignedUrl(null);
        setDocumentBytes(null);
        setDocumentObjectUrl(null);
        setError(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const urlRes = await api.get<{ url: string }>(`/api/v1/documents/${activeDoc.id}/download-url`);
        if (cancelled) return;

        setSignedUrl(urlRes.data.url);
        console.info('[viewer] signed url ready', {
          matterId,
          documentId: activeDoc.id,
          fileName: activeDoc.fileName,
          mimeType: activeDoc.mimeType,
        });
        const binaryRes = await window.electronAPI.documents.fetchBinary(urlRes.data.url);
        if (!binaryRes.success || !binaryRes.buffer) {
          throw new Error(binaryRes.error || 'Gagal mengambil binary dokumen.');
        }

        if (cancelled) return;

        const buffer = new Uint8Array(binaryRes.buffer.slice(0));
        setDocumentBytes(buffer);
        console.info('[viewer] binary ready', {
          matterId,
          documentId: activeDoc.id,
          byteLength: buffer.byteLength,
          contentType: binaryRes.contentType,
        });

        const mimeType = binaryRes.contentType || activeDoc.mimeType || 'application/octet-stream';
        objectUrlToRevoke = URL.createObjectURL(new Blob([buffer], { type: mimeType }));
        setDocumentObjectUrl(objectUrlToRevoke);
      } catch (err: any) {
        if (!cancelled) {
          console.error('[viewer] failed to load document', {
            matterId,
            documentId: activeDoc.id,
            error: err,
          });
          setError(err?.message || 'PDF gagal dirender. Gunakan tautan unduh aman untuk membuka dokumen.');
          setSignedUrl(null);
          setDocumentBytes(null);
          setDocumentObjectUrl(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadDocument();

    return () => {
      cancelled = true;
      if (objectUrlToRevoke) {
        URL.revokeObjectURL(objectUrlToRevoke);
      }
    };
  }, [activeDoc?.id, activeDoc?.mimeType, matterId, reloadNonce]);

  useEffect(() => {
    if (!documentObjectUrl) {
      return undefined;
    }

    return () => URL.revokeObjectURL(documentObjectUrl);
  }, [documentObjectUrl]);

  useEffect(() => {
    if (!activeDoc?.id) {
      return undefined;
    }

    const refreshTimer = window.setInterval(() => {
      setReloadNonce((value) => value + 1);
    }, 13 * 60 * 1000);

    return () => window.clearInterval(refreshTimer);
  }, [activeDoc?.id]);

  return {
    signedUrl,
    documentBytes,
    documentObjectUrl,
    error,
    isLoading,
    isPdf,
    reload: () => setReloadNonce((value) => value + 1),
  };
}

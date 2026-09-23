import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AuthorizedDocumentViewer from './AuthorizedDocumentViewer';

const apiGetMock = vi.fn();
const fetchBinaryMock = vi.fn();

vi.mock('../api/client', () => ({ api: { get: (...args: any[]) => apiGetMock(...args) } }));
vi.mock('../lib/pdfviewer', () => ({ getPdfPageCount: vi.fn(async () => 1), renderPdfToCanvas: vi.fn(async () => undefined) }));

describe('AuthorizedDocumentViewer', () => {
  beforeEach(() => {
    apiGetMock.mockReset(); fetchBinaryMock.mockReset();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:identity-document') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    (window as any).electronAPI = { documents: { fetchBinary: fetchBinaryMock }, dialog: { saveFile: vi.fn() } };
    apiGetMock.mockResolvedValue({ data: { url: 'https://storage.ajbku.id/signed/ktp.png?signature=approved' } });
    fetchBinaryMock.mockResolvedValue({ success: true, buffer: new Uint8Array([1, 2, 3]).buffer, contentType: 'image/png' });
  });

  it('uses the backend download endpoint then the approved Electron binary-fetch path', async () => {
    render(<AuthorizedDocumentViewer document={{ documentId: 'doc-1', fileName: 'ktp.png', mimeType: 'image/png', downloadEndpoint: '/api/v1/admin/identity-documents/doc-1/download-url' }} />);
    await waitFor(() => expect(apiGetMock).toHaveBeenCalledWith('/api/v1/admin/identity-documents/doc-1/download-url'));
    expect(fetchBinaryMock).toHaveBeenCalledWith('https://storage.ajbku.id/signed/ktp.png?signature=approved');
    expect(screen.getByAltText('ktp.png')).toBeTruthy();
  });

  it('shows a safe error when the approved binary fetch fails', async () => {
    fetchBinaryMock.mockResolvedValueOnce({ success: false, error: 'Signed URL expired' });
    render(<AuthorizedDocumentViewer document={{ documentId: 'doc-1', fileName: 'ktp.png', downloadEndpoint: '/api/v1/admin/identity-documents/doc-1/download-url' }} />);
    expect(await screen.findByText('Signed URL expired')).toBeTruthy();
  });
});

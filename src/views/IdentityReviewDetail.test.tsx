import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import IdentityReviewDetail from './IdentityReviewDetail';

const apiGetMock = vi.fn();
const apiPostMock = vi.fn();
const notifySuccessMock = vi.fn();
const notifyErrorMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({ Link: ({ children, ...props }: any) => <a {...props}>{children}</a>, useParams: () => ({ clientProfileId: 'client-1' }) }));
vi.mock('../api/client', () => ({ api: { get: (...args: any[]) => apiGetMock(...args), post: (...args: any[]) => apiPostMock(...args) } }));
vi.mock('../store/ui', () => ({ notifySuccess: (...args: any[]) => notifySuccessMock(...args), notifyError: (...args: any[]) => notifyErrorMock(...args) }));
vi.mock('../components/AuthorizedDocumentViewer', () => ({ default: ({ document }: any) => <div data-testid="document-viewer">{document?.downloadEndpoint || 'no-document'}</div> }));

const detail = { clientProfileId: 'client-1', userId: 'user-1', fullName: 'Siti Aminah', email: 'siti@example.test', phone: '0812', addressLine: 'Jl. Merdeka', city: 'Jakarta', profileCompletionStatus: 'complete', identityVerificationStatus: 'pending_review', documents: [{ documentId: 'doc-1', documentType: 'ktp', fileName: 'ktp-siti.pdf', mimeType: 'application/pdf', fileSizeBytes: 10, versionNumber: 2, verificationStatus: 'pending_review', uploadedAt: '2026-01-01T00:00:00.000Z', downloadEndpoint: '/api/v1/admin/identity-documents/doc-1/download-url' }] };

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><IdentityReviewDetail /></QueryClientProvider>);
  return client;
}

describe('IdentityReviewDetail', () => {
  beforeEach(() => {
    apiGetMock.mockReset(); apiPostMock.mockReset(); notifySuccessMock.mockReset(); notifyErrorMock.mockReset();
    apiGetMock.mockResolvedValue({ data: detail }); apiPostMock.mockResolvedValue({ data: { ...detail, identityVerificationStatus: 'verified' } });
  });

  it('loads the route client profile and renders canonical profile and document statuses', async () => {
    renderScreen();
    expect(await screen.findByText('Siti Aminah')).toBeTruthy();
    expect(apiGetMock).toHaveBeenCalledWith('/api/v1/admin/client-identity-verifications/client-1');
    expect(screen.getByText('complete')).toBeTruthy();
    expect(screen.getAllByText('Menunggu review').length).toBeGreaterThan(0);
    expect(screen.getByText('ktp-siti.pdf')).toBeTruthy();
    expect(screen.getByText((_, element) => element?.textContent === 'Versi 2 · Menunggu review')).toBeTruthy();
    expect(screen.getByTestId('document-viewer').textContent).toContain('/api/v1/admin/identity-documents/doc-1/download-url');
  });

  it('posts approve only to the backend business endpoint and refreshes identity queries', async () => {
    const client = renderScreen(); const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    await screen.findByText('Siti Aminah');
    fireEvent.click(screen.getByText('Verifikasi'));
    await waitFor(() => expect(apiPostMock).toHaveBeenCalledWith('/api/v1/admin/client-identity-verifications/client-1/approve', {}));
    expect(notifySuccessMock).toHaveBeenCalledWith('Identitas berhasil diverifikasi.');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['identity-review', 'client-1'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['identity-reviews'] });
  });

  it('prevents a duplicate approval while the first decision is pending', async () => {
    let resolveRequest: (value: unknown) => void = () => undefined;
    apiPostMock.mockImplementationOnce(() => new Promise((resolve) => { resolveRequest = resolve; }));
    renderScreen(); await screen.findByText('Siti Aminah');
    const approve = screen.getByText('Verifikasi') as HTMLButtonElement;
    fireEvent.click(approve);
    await waitFor(() => expect(approve.disabled).toBe(true));
    fireEvent.click(approve);
    expect(apiPostMock).toHaveBeenCalledTimes(1);
    resolveRequest({ data: { ...detail, identityVerificationStatus: 'verified' } });
  });

  it('surfaces an approval failure without claiming success', async () => {
    apiPostMock.mockRejectedValueOnce(new Error('Approval gagal'));
    renderScreen(); await screen.findByText('Siti Aminah');
    fireEvent.click(screen.getByText('Verifikasi'));
    await waitFor(() => expect(notifyErrorMock).toHaveBeenCalledWith('Approval gagal', 'Verifikasi identitas'));
    expect(notifySuccessMock).not.toHaveBeenCalled();
  });

  it('requires a revision reason and posts it to the revision business endpoint', async () => {
    const client = renderScreen(); const invalidateSpy = vi.spyOn(client, 'invalidateQueries'); await screen.findByText('Siti Aminah');
    fireEvent.click(screen.getByText('Minta revisi'));
    const save = screen.getByText('Simpan keputusan') as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(screen.getByPlaceholderText('Catatan wajib untuk client'), { target: { value: 'Foto KTP kurang jelas' } });
    fireEvent.click(save);
    await waitFor(() => expect(apiPostMock).toHaveBeenCalledWith('/api/v1/admin/client-identity-verifications/client-1/request-revision', { note: 'Foto KTP kurang jelas' }));
    expect(notifySuccessMock).toHaveBeenCalledWith('Keputusan verifikasi tersimpan.');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['identity-review', 'client-1'] });
  });

  it('surfaces a revision failure without closing it as successful', async () => {
    apiPostMock.mockRejectedValueOnce(new Error('Revisi gagal'));
    renderScreen(); await screen.findByText('Siti Aminah');
    fireEvent.click(screen.getByText('Minta revisi'));
    fireEvent.change(screen.getByPlaceholderText('Catatan wajib untuk client'), { target: { value: 'Foto KTP kurang jelas' } });
    fireEvent.click(screen.getByText('Simpan keputusan'));
    await waitFor(() => expect(notifyErrorMock).toHaveBeenCalledWith('Revisi gagal', 'Verifikasi identitas'));
    expect(screen.getByText('Minta revisi identitas')).toBeTruthy();
  });

  it('posts reject with its required note and surfaces failures without false success', async () => {
    apiPostMock.mockRejectedValueOnce(new Error('Keputusan ditolak server'));
    renderScreen(); await screen.findByText('Siti Aminah');
    fireEvent.click(screen.getByText('Tolak'));
    fireEvent.change(screen.getByPlaceholderText('Catatan wajib untuk client'), { target: { value: 'Dokumen tidak sesuai' } });
    fireEvent.click(screen.getByText('Simpan keputusan'));
    await waitFor(() => expect(apiPostMock).toHaveBeenCalledWith('/api/v1/admin/client-identity-verifications/client-1/reject', { note: 'Dokumen tidak sesuai' }));
    expect(notifyErrorMock).toHaveBeenCalledWith('Keputusan ditolak server', 'Verifikasi identitas');
    expect(notifySuccessMock).not.toHaveBeenCalled();
  });

  it('refreshes identity state after a successful rejection', async () => {
    const client = renderScreen(); const invalidateSpy = vi.spyOn(client, 'invalidateQueries'); await screen.findByText('Siti Aminah');
    fireEvent.click(screen.getByText('Tolak'));
    fireEvent.change(screen.getByPlaceholderText('Catatan wajib untuk client'), { target: { value: 'Dokumen tidak sesuai' } });
    fireEvent.click(screen.getByText('Simpan keputusan'));
    await waitFor(() => expect(apiPostMock).toHaveBeenCalledWith('/api/v1/admin/client-identity-verifications/client-1/reject', { note: 'Dokumen tidak sesuai' }));
    expect(notifySuccessMock).toHaveBeenCalledWith('Keputusan verifikasi tersimpan.');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['identity-reviews'] });
  });

  it('handles a missing detail response safely', async () => {
    apiGetMock.mockResolvedValueOnce({ data: null }); renderScreen();
    expect(await screen.findByText('Data identity review tidak ditemukan.')).toBeTruthy();
  });

  it('handles a failed detail request safely', async () => {
    apiGetMock.mockRejectedValueOnce(new Error('Detail tidak tersedia')); renderScreen();
    expect(await screen.findByText('Data identity review tidak ditemukan.')).toBeTruthy();
  });
});

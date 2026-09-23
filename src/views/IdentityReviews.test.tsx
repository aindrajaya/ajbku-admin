import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import IdentityReviews from './IdentityReviews';

const apiGetMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, params, ...props }: any) => <a href={String(to).replace('$clientProfileId', params?.clientProfileId || '')} {...props}>{children}</a>,
}));
vi.mock('../api/client', () => ({ api: { get: (...args: any[]) => apiGetMock(...args) } }));

function renderScreen() {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><IdentityReviews /></QueryClientProvider>);
}

const list = {
  items: [{ clientProfileId: 'client-1', userId: 'user-1', fullName: 'Siti Aminah', email: 'siti@example.test', phone: '0812', profileCompletionStatus: 'complete', identityVerificationStatus: 'pending_review', latestDocument: { documentId: 'doc-1', documentType: 'ktp', fileName: 'ktp-siti.pdf', mimeType: 'application/pdf', fileSizeBytes: 10, versionNumber: 1, verificationStatus: 'pending_review', uploadedAt: '2026-01-01T00:00:00.000Z', downloadEndpoint: '/api/v1/admin/identity-documents/doc-1/download-url' } }],
  meta: { page: 1, limit: 20, total: 1 },
};

describe('IdentityReviews', () => {
  beforeEach(() => { apiGetMock.mockReset(); apiGetMock.mockResolvedValue({ data: list }); });

  it('loads and renders pending client verification records from the business endpoint', async () => {
    renderScreen();
    expect(screen.getByText('Memuat queue...')).toBeTruthy();
    expect(await screen.findByText('Siti Aminah')).toBeTruthy();
    expect(screen.getByText('complete')).toBeTruthy();
    expect(screen.getAllByText('Menunggu review').length).toBeGreaterThan(0);
    expect(screen.getByText('ktp-siti.pdf')).toBeTruthy();
    expect(apiGetMock).toHaveBeenCalledWith('/api/v1/admin/client-identity-verifications', { status: 'pending_review', page: 1, limit: 20 });
    expect(screen.getByText('Tinjau').getAttribute('href')).toBe('/identity-reviews/client-1');
  });

  it('renders an empty state when no records are returned', async () => {
    apiGetMock.mockResolvedValueOnce({ data: { items: [], meta: { page: 1, limit: 20, total: 0 } } });
    renderScreen();
    expect(await screen.findByText('Tidak ada client pada status ini.')).toBeTruthy();
  });

  it('handles a backend list failure without crashing', async () => {
    apiGetMock.mockRejectedValueOnce(new Error('Server tidak tersedia'));
    renderScreen();
    await waitFor(() => expect(screen.getByText('Tidak ada client pada status ini.')).toBeTruthy());
  });
});

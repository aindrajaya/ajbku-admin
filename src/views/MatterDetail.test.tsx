import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MatterDetail from './MatterDetail';

const apiGetMock = vi.fn();
const apiPatchMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
  useNavigate: () => vi.fn(),
  useParams: () => ({ id: 'matter-1' }),
}));

vi.mock('../api/client', () => ({
  api: {
    get: (...args: any[]) => apiGetMock(...args),
    patch: (...args: any[]) => apiPatchMock(...args),
    post: vi.fn(),
  },
}));

vi.mock('../store/realtime', () => ({
  useRealtimeStore: () => ({ connected: false }),
}));

vi.mock('../store/ui', () => ({
  notifyError: vi.fn(),
  notifyInfo: vi.fn(),
  notifySuccess: vi.fn(),
}));

const matter = {
  id: 'matter-1',
  matterNumber: 'MTR-001',
  title: 'AJB Ruko',
  workflowStatus: 'documents_under_review',
  assignmentStatus: 'unassigned',
  paymentStatus: 'unpaid',
  documents: [],
};

function renderMatterDetail() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MatterDetail />
    </QueryClientProvider>,
  );
}

describe('MatterDetail activity log', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPatchMock.mockReset();
    apiPatchMock.mockResolvedValue({ data: { ok: true } });
  });

  it('renders server-filtered audit events without requiring matterId on each row', async () => {
    apiGetMock.mockImplementation(async (url: string, params?: unknown) => {
      if (url === '/api/v1/matters/matter-1') return { data: matter };
      if (url === '/api/v1/audit-events') {
        expect(params).toEqual({ matterId: 'matter-1', page: 1, limit: 50 });
        return {
          data: [
            { id: 'old', action: 'document_verified', details: 'Dokumen diperiksa', actorName: 'Admin Satu', createdAt: '2026-08-10T08:00:00.000Z' },
            { id: 'new', action: 'notary_assigned', details: 'Notaris dipilih', actorName: 'Admin Dua', createdAt: '2026-08-11T08:00:00.000Z', aggregateType: 'assignment' },
          ],
        };
      }
      throw new Error(`Unhandled URL ${url}`);
    });

    renderMatterDetail();

    expect(await screen.findByText('notary assigned')).toBeTruthy();
    expect(screen.getByText('document verified')).toBeTruthy();
    expect(screen.getByText('Notaris dipilih')).toBeTruthy();
    expect(screen.getByText('assignment')).toBeTruthy();
    const titles = screen.getAllByText(/^(notary assigned|document verified)$/).map((node) => node.textContent);
    expect(titles).toEqual(['notary assigned', 'document verified']);
    expect(apiGetMock).not.toHaveBeenCalledWith('/api/v1/matters/matter-1/timeline');
  });

  it('falls back to timeline data and renders its field names', async () => {
    apiGetMock.mockImplementation(async (url: string) => {
      if (url === '/api/v1/matters/matter-1') return { data: matter };
      if (url === '/api/v1/audit-events') return { data: [] };
      if (url === '/api/v1/matters/matter-1/timeline') {
        return {
          data: {
            data: [{ id: 'timeline-1', statusCode: 'documents_verified', title: 'Dokumen lengkap', description: 'Verifikasi selesai', createdBy: 'admin-1', createdAt: '2026-08-11T08:00:00.000Z' }],
          },
        };
      }
      throw new Error(`Unhandled URL ${url}`);
    });

    renderMatterDetail();

    expect(await screen.findByText('Dokumen lengkap')).toBeTruthy();
    expect(screen.getByText('Verifikasi selesai')).toBeTruthy();
    expect(screen.getByText(/admin-1/)).toBeTruthy();
  });

  it('falls back when the audit response contains only malformed rows', async () => {
    apiGetMock.mockImplementation(async (url: string) => {
      if (url === '/api/v1/matters/matter-1') return { data: matter };
      if (url === '/api/v1/audit-events') return { data: [null, 'invalid'] };
      if (url === '/api/v1/matters/matter-1/timeline') {
        return { data: [{ id: 'timeline-1', title: 'Fallback tersedia', createdAt: '2026-08-11T08:00:00.000Z' }] };
      }
      throw new Error(`Unhandled URL ${url}`);
    });

    renderMatterDetail();

    expect(await screen.findByText('Fallback tersedia')).toBeTruthy();
  });

  it('distinguishes an empty log from a failed request', async () => {
    apiGetMock.mockImplementation(async (url: string) => {
      if (url === '/api/v1/matters/matter-1') return { data: matter };
      if (url === '/api/v1/audit-events' || url === '/api/v1/matters/matter-1/timeline') return { data: [] };
      throw new Error(`Unhandled URL ${url}`);
    });

    renderMatterDetail();

    expect(await screen.findByText('Belum ada aktivitas perkara tercatat.')).toBeTruthy();
    expect(screen.queryByText('Log perkara gagal dimuat.')).toBeNull();
  });

  it('shows an error for malformed responses and retries both sources', async () => {
    let timelineAttempts = 0;
    apiGetMock.mockImplementation(async (url: string) => {
      if (url === '/api/v1/matters/matter-1') return { data: matter };
      if (url === '/api/v1/audit-events') throw new Error('Forbidden');
      if (url === '/api/v1/matters/matter-1/timeline') {
        timelineAttempts += 1;
        return timelineAttempts === 1
          ? { data: { unexpected: true } }
          : { data: [{ id: 'recovered', title: 'Log pulih', description: 'Berhasil dimuat ulang', createdAt: '2026-08-11T08:00:00.000Z' }] };
      }
      throw new Error(`Unhandled URL ${url}`);
    });

    renderMatterDetail();

    expect(await screen.findByText('Log perkara gagal dimuat.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Coba Lagi' }));
    expect(await screen.findByText('Log pulih')).toBeTruthy();
    expect(timelineAttempts).toBe(2);
  });

  it('refetches activity after a successful status update', async () => {
    let auditCalls = 0;
    apiGetMock.mockImplementation(async (url: string) => {
      if (url === '/api/v1/matters/matter-1') return { data: matter };
      if (url === '/api/v1/audit-events') {
        auditCalls += 1;
        return { data: [{ id: `event-${auditCalls}`, action: 'status_updated', createdAt: '2026-08-11T08:00:00.000Z' }] };
      }
      throw new Error(`Unhandled URL ${url}`);
    });

    renderMatterDetail();

    expect(await screen.findByText('status updated')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ubah Status' }));
    fireEvent.click(screen.getByRole('button', { name: 'Simpan' }));

    await waitFor(() => expect(apiPatchMock).toHaveBeenCalledWith('/api/v1/matters/matter-1/status', { status: 'documents_under_review' }));
    await waitFor(() => expect(auditCalls).toBeGreaterThan(1));
  });
});

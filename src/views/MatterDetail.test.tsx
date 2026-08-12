import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MatterDetail from './MatterDetail';

const apiGetMock = vi.fn();
const apiPatchMock = vi.fn();
const apiPostMock = vi.fn();
const mockAuth = vi.hoisted(() => ({
  roles: ['PRINCIPAL'] as string[],
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
  useNavigate: () => vi.fn(),
  useParams: () => ({ id: 'matter-1' }),
}));

vi.mock('../api/client', () => ({
  api: {
    get: (...args: any[]) => apiGetMock(...args),
    patch: (...args: any[]) => apiPatchMock(...args),
    post: (...args: any[]) => apiPostMock(...args),
  },
}));

vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'admin-1', roles: mockAuth.roles } }),
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
    mockAuth.roles = ['PRINCIPAL'];
    apiGetMock.mockReset();
    apiPatchMock.mockReset();
    apiPostMock.mockReset();
    apiPatchMock.mockResolvedValue({ data: { ok: true } });
    apiPostMock.mockResolvedValue({ data: { id: 'timeline-note-1' } });
  });

  it('renders timeline data from the latest matter timeline API before audit events', async () => {
    apiGetMock.mockImplementation(async (url: string, params?: unknown) => {
      if (url === '/api/v1/matters/matter-1') return { data: matter };
      if (url === '/api/v1/matters/matter-1/timeline') {
        return {
          data: [
            { id: 'timeline-created', title: 'Perkara dibuat', actorName: 'Client User', happenedAt: '2026-08-10T09:55:00.000Z', sourceModule: 'matter' },
          ],
        };
      }
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

    expect(await screen.findByText('Perkara dibuat')).toBeTruthy();
    expect(screen.getByText(/oleh Client User/)).toBeTruthy();
    expect(screen.queryByText('notary assigned')).toBeNull();
    expect(apiGetMock).not.toHaveBeenCalledWith('/api/v1/audit-events', expect.anything());
  });

  it('renders timeline field names', async () => {
    apiGetMock.mockImplementation(async (url: string) => {
      if (url === '/api/v1/matters/matter-1') return { data: matter };
      if (url === '/api/v1/matters/matter-1/timeline') {
        return {
          data: [{ id: 'timeline-1', matterId: 'matter-1', statusCode: 'documents_verified', title: 'Dokumen lengkap', description: 'Verifikasi selesai', actorUserId: 'admin-1', actorName: 'Admin AJBKU', happenedAt: '2026-08-11T08:00:00.000Z', sourceModule: 'verification' }],
        };
      }
      throw new Error(`Unhandled URL ${url}`);
    });

    renderMatterDetail();

    expect(await screen.findByText('Dokumen lengkap')).toBeTruthy();
    expect(screen.getByText('Verifikasi selesai')).toBeTruthy();
    expect(screen.getByText(/oleh Admin AJBKU/)).toBeTruthy();
    expect(screen.queryByText(/admin-1/)).toBeNull();
    expect(screen.getByText('verification')).toBeTruthy();
  });

  it('falls back to Admin when timeline rows only include actorUserId', async () => {
    apiGetMock.mockImplementation(async (url: string) => {
      if (url === '/api/v1/matters/matter-1') return { data: matter };
      if (url === '/api/v1/matters/matter-1/timeline') {
        return {
          data: [{ id: 'timeline-1', title: 'Catatan lama', actorUserId: '7fe13f88-19d5-4526-8901-9e0c4d35aa5d', happenedAt: '2026-08-11T08:00:00.000Z' }],
        };
      }
      throw new Error(`Unhandled URL ${url}`);
    });

    renderMatterDetail();

    expect(await screen.findByText('Catatan lama')).toBeTruthy();
    expect(screen.getByText(/oleh Admin/)).toBeTruthy();
    expect(screen.queryByText(/7fe13f88/)).toBeNull();
  });

  it('uses createdBy full name before Admin fallback for user-created matters', async () => {
    apiGetMock.mockImplementation(async (url: string) => {
      if (url === '/api/v1/matters/matter-1') return { data: matter };
      if (url === '/api/v1/matters/matter-1/timeline') {
        return {
          data: [{
            id: 'timeline-created',
            title: 'Perkara dibuat',
            actorUserId: '7fe13f88-19d5-4526-8901-9e0c4d35aa5d',
            createdBy: 'Budi Santoso',
            happenedAt: '2026-08-10T09:55:00.000Z',
            sourceModule: 'matter',
          }],
        };
      }
      throw new Error(`Unhandled URL ${url}`);
    });

    renderMatterDetail();

    expect(await screen.findByText('Perkara dibuat')).toBeTruthy();
    expect(screen.getByText(/oleh Budi Santoso/)).toBeTruthy();
    expect(screen.queryByText(/oleh Admin/)).toBeNull();
    expect(screen.queryByText(/7fe13f88/)).toBeNull();
  });

  it('falls back to audit events when the timeline request fails', async () => {
    apiGetMock.mockImplementation(async (url: string) => {
      if (url === '/api/v1/matters/matter-1') return { data: matter };
      if (url === '/api/v1/matters/matter-1/timeline') {
        throw new Error('Timeline unavailable');
      }
      if (url === '/api/v1/audit-events') return { data: [{ id: 'audit-1', action: 'fallback_available', createdAt: '2026-08-11T08:00:00.000Z' }] };
      throw new Error(`Unhandled URL ${url}`);
    });

    renderMatterDetail();

    expect(await screen.findByText('fallback available')).toBeTruthy();
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
      if (url === '/api/v1/audit-events') return { data: { unexpected: true } };
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
    let timelineCalls = 0;
    apiGetMock.mockImplementation(async (url: string) => {
      if (url === '/api/v1/matters/matter-1') return { data: matter };
      if (url === '/api/v1/matters/matter-1/timeline') {
        timelineCalls += 1;
        return { data: [{ id: `event-${timelineCalls}`, title: 'Status diperbarui', happenedAt: '2026-08-11T08:00:00.000Z' }] };
      }
      throw new Error(`Unhandled URL ${url}`);
    });

    renderMatterDetail();

    expect(await screen.findByText('Status diperbarui')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ubah Status' }));
    fireEvent.click(screen.getByRole('button', { name: 'Simpan' }));

    await waitFor(() => expect(apiPatchMock).toHaveBeenCalledWith('/api/v1/matters/matter-1/status', { status: 'documents_under_review' }));
    await waitFor(() => expect(timelineCalls).toBeGreaterThan(1));
  });

  it('adds manual timeline notes for allowed roles and refetches activity', async () => {
    let timelineCalls = 0;
    apiGetMock.mockImplementation(async (url: string) => {
      if (url === '/api/v1/matters/matter-1') return { data: matter };
      if (url === '/api/v1/matters/matter-1/timeline') {
        timelineCalls += 1;
        return { data: timelineCalls === 1 ? [] : [{ id: 'manual-note', title: 'Catatan manual ditambahkan', happenedAt: '2026-08-11T08:00:00.000Z' }] };
      }
      throw new Error(`Unhandled URL ${url}`);
    });

    renderMatterDetail();

    const noteInput = await screen.findByLabelText('Catatan Manual');
    fireEvent.change(noteInput, { target: { value: 'Perlu follow up dengan klien.' } });
    fireEvent.click(screen.getByRole('button', { name: /Tambah Catatan/ }));

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith('/api/v1/matters/matter-1/timeline', {
        statusCode: 'manual_note',
        title: 'Catatan manual ditambahkan',
        description: 'Perlu follow up dengan klien.',
      });
    });
    await waitFor(() => expect(timelineCalls).toBeGreaterThan(1));
    await waitFor(() => expect((noteInput as HTMLTextAreaElement).value).toBe(''));
  });

  it('hides manual timeline note form for finance admin users', async () => {
    mockAuth.roles = ['FINANCE_ADMIN'];
    apiGetMock.mockImplementation(async (url: string) => {
      if (url === '/api/v1/matters/matter-1') return { data: matter };
      if (url === '/api/v1/audit-events' || url === '/api/v1/matters/matter-1/timeline') return { data: [] };
      throw new Error(`Unhandled URL ${url}`);
    });

    renderMatterDetail();

    expect(await screen.findByText('Belum ada aktivitas perkara tercatat.')).toBeTruthy();
    expect(screen.queryByLabelText('Catatan Manual')).toBeNull();
  });
});

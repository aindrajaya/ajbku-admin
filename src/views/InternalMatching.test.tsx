import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import InternalMatching from './InternalMatching';

const apiGetMock = vi.fn();
const apiPostMock = vi.fn();
const notifySuccessMock = vi.fn();
const notifyErrorMock = vi.fn();

vi.mock('../api/client', () => ({
  api: {
    get: (...args: any[]) => apiGetMock(...args),
    post: (...args: any[]) => apiPostMock(...args),
  },
}));

vi.mock('../store/ui', () => ({
  notifySuccess: (...args: any[]) => notifySuccessMock(...args),
  notifyError: (...args: any[]) => notifyErrorMock(...args),
}));

function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <InternalMatching />
    </QueryClientProvider>
  );

  return queryClient;
}

function setupDefaultApi() {
  apiGetMock.mockImplementation(async (url: string, params?: Record<string, unknown>) => {
    if (url === '/api/v1/matters' && params?.workflowStatus === 'documents_verified') {
      return {
        data: {
          items: [
            {
              id: 'matter-1',
              caseNumber: 'AJB-001',
              title: 'AJB Ruko',
              landCityCode: '3171',
              workflowStatus: 'documents_verified',
              assignmentStatus: 'unassigned',
            },
            {
              id: 'matter-dup',
              caseNumber: 'AJB-DUP',
              title: 'AJB Duplikat',
              landCityCode: '3172',
              workflowStatus: 'documents_verified',
              assignmentStatus: 'unassigned',
            },
          ],
        },
      };
    }

    if (url === '/api/v1/matters' && params?.workflowStatus === 'assignment_pending') {
      return {
        data: {
          items: [
            {
              id: 'matter-dup',
              caseNumber: 'AJB-DUP',
              title: 'AJB Duplikat',
              landCityCode: '3172',
              workflowStatus: 'assignment_pending',
              assignmentStatus: 'unassigned',
            },
            {
              id: 'matter-assigned',
              caseNumber: 'AJB-ASSIGNED',
              title: 'AJB Sudah Assigned',
              landCityCode: '3173',
              workflowStatus: 'assignment_pending',
              assignmentStatus: 'assigned',
            },
          ],
        },
      };
    }

    if (url === '/api/v1/matters/matter-1/assignment/recommendations') {
      return {
        data: [
          {
            notaryProfileId: 'notary-1',
            fullName: 'Notaris Satu',
            status: 'approved',
            acceptsNewAssignment: true,
            coverageAreas: [{ cityName: 'Jakarta Selatan', provinceName: 'DKI Jakarta', coverageType: 'service_area' }],
            activeMattersCount: 4,
            slaPerformanceScore: 90,
            rating: 4.7,
            distanceKm: 3,
            scoreReason: 'Cakupan wilayah cocok',
          },
          {
            notaryProfileId: 'notary-2',
            fullName: 'Notaris Pending',
            status: 'pending_approval',
            acceptsNewAssignment: true,
            coverageAreas: [],
          },
        ],
      };
    }

    throw new Error(`Unhandled URL ${url} ${JSON.stringify(params)}`);
  });
}

describe('InternalMatching', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPostMock.mockReset();
    notifySuccessMock.mockReset();
    notifyErrorMock.mockReset();
    apiPostMock.mockResolvedValue({ data: { ok: true } });
    setupDefaultApi();
  });

  it('fetches documents verified and assignment pending matter queues', async () => {
    renderScreen();

    await screen.findByText('AJB Ruko');

    expect(apiGetMock).toHaveBeenCalledWith('/api/v1/matters', expect.objectContaining({ workflowStatus: 'documents_verified' }));
    expect(apiGetMock).toHaveBeenCalledWith('/api/v1/matters', expect.objectContaining({ workflowStatus: 'assignment_pending' }));
  });

  it('dedupes duplicated matters and excludes already assigned matters', async () => {
    renderScreen();

    expect(await screen.findByText('AJB Ruko')).toBeTruthy();
    expect(screen.getAllByText('AJB Duplikat')).toHaveLength(1);
    expect(screen.queryByText('AJB Sudah Assigned')).toBeNull();
    expect(screen.getByText('2 perkara')).toBeTruthy();
  });

  it('selecting a matter enables recommendation fetch', async () => {
    renderScreen();

    fireEvent.click(await screen.findByText('AJB Ruko'));
    expect(screen.getByText('Generate kandidat untuk perkara terpilih.')).toBeTruthy();

    fireEvent.click(screen.getByText('Dapatkan Rekomendasi'));

    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith('/api/v1/matters/matter-1/assignment/recommendations');
    });
    expect(await screen.findByText('Notaris Satu')).toBeTruthy();
  });

  it('assigns an approved and accepting candidate through the canonical assignment endpoint', async () => {
    renderScreen();

    fireEvent.click(await screen.findByText('AJB Ruko'));
    fireEvent.click(screen.getByText('Dapatkan Rekomendasi'));
    fireEvent.click(await screen.findByText('Notaris Satu'));
    fireEvent.click(screen.getByText('Konfirmasi Assignment'));

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith('/api/v1/matters/matter-1/assignment/decide', { notaryId: 'notary-1' });
    });
    expect(notifySuccessMock).toHaveBeenCalledWith('Notaris berhasil ditugaskan untuk perkara ini.');
  });

  it('disables non-approved or unavailable candidates', async () => {
    renderScreen();

    fireEvent.click(await screen.findByText('AJB Ruko'));
    fireEvent.click(screen.getByText('Dapatkan Rekomendasi'));

    const pendingCandidate = await screen.findByRole('button', { name: /Notaris Pending/i });
    expect((pendingCandidate as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Hanya notaris approved dan siap assignment yang dapat dipilih.')).toBeTruthy();
  });

  it('shows empty matter queue and empty recommendation states safely', async () => {
    apiGetMock.mockImplementation(async (url: string, params?: Record<string, unknown>) => {
      if (url === '/api/v1/matters') return { data: { items: [] } };
      if (url === '/api/v1/matters/matter-1/assignment/recommendations') return { data: [] };
      throw new Error(`Unhandled URL ${url} ${JSON.stringify(params)}`);
    });

    renderScreen();

    expect(await screen.findByText('Tidak ada perkara yang membutuhkan assignment.')).toBeTruthy();

    apiGetMock.mockReset();
    apiGetMock.mockImplementation(async (url: string, params?: Record<string, unknown>) => {
      if (url === '/api/v1/matters' && params?.workflowStatus === 'documents_verified') {
        return { data: [{ id: 'matter-1', title: 'AJB Ruko', workflowStatus: 'documents_verified', assignmentStatus: 'unassigned' }] };
      }
      if (url === '/api/v1/matters' && params?.workflowStatus === 'assignment_pending') return { data: [] };
      if (url === '/api/v1/matters/matter-1/assignment/recommendations') return { data: [] };
      throw new Error(`Unhandled URL ${url} ${JSON.stringify(params)}`);
    });

    renderScreen();
    fireEvent.click(await screen.findByText('AJB Ruko'));
    fireEvent.click(screen.getByText('Dapatkan Rekomendasi'));

    expect(await screen.findByText('Belum ada rekomendasi untuk perkara ini.')).toBeTruthy();
    expect(notifyErrorMock).toHaveBeenCalledWith('Tidak ada notaris yang cocok untuk perkara ini.');
  });

  it('renders loading state safely', () => {
    apiGetMock.mockReturnValue(new Promise(() => undefined));

    renderScreen();

    expect(screen.getByText('Memuat queue matching...')).toBeTruthy();
  });
});

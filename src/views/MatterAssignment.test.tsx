import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MatterAssignment from './MatterAssignment';

const apiGetMock = vi.fn();
const apiPostMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
  useParams: () => ({ id: 'matter-1' }),
}));

vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'admin-1', roles: ['PRINCIPAL'] } }),
}));

vi.mock('../api/client', () => ({
  api: {
    get: (...args: any[]) => apiGetMock(...args),
    post: (...args: any[]) => apiPostMock(...args),
  },
}));

vi.mock('../store/ui', () => ({
  notifyError: vi.fn(),
  notifySuccess: vi.fn(),
}));

describe('MatterAssignment', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPostMock.mockReset();
    apiPostMock.mockResolvedValue({ data: { ok: true } });
    apiGetMock.mockImplementation(async (url: string) => {
      if (url === '/api/v1/matters/matter-1') {
        return {
          data: {
            id: 'matter-1',
            title: 'AJB Ruko',
            landCityCode: '3171',
            assignmentStatus: 'unassigned',
            documents: [
              { id: 'doc-ktp', document_type: 'ktp', verification_status: 'validated' },
              { id: 'doc-npwp', document_type: 'npwp', verification_status: 'validated' },
              { id: 'doc-sertifikat', document_type: 'sertifikat', verification_status: 'validated' },
              { id: 'doc-pbb', document_type: 'pbb', verification_status: 'validated' },
              { id: 'doc-kk', document_type: 'kk', verification_status: 'validated' },
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
              distanceKm: 3.2,
              activeMattersCount: 4,
              rating: 4.5,
              slaPerformanceScore: 80,
              scoreReason: 'Sesuai cakupan wilayah dan beban kerja',
            },
          ],
        };
      }

      throw new Error(`Unhandled URL ${url}`);
    });
  });

  it('fetches notary recommendations with GET', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MatterAssignment />
      </QueryClientProvider>
    );

    fireEvent.click(await screen.findByText('Dapatkan Rekomendasi'));

    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith('/api/v1/matters/matter-1/assignment/recommendations');
    });
    expect(await screen.findByText('Notaris Satu')).toBeTruthy();
  });

  it('assigns an approved and accepting candidate through the canonical assignment endpoint', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MatterAssignment />
      </QueryClientProvider>
    );

    fireEvent.click(await screen.findByText('Dapatkan Rekomendasi'));
    fireEvent.click(await screen.findByText('Notaris Satu'));
    fireEvent.click(screen.getByText('Konfirmasi Assignment'));

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith('/api/v1/matters/matter-1/assignment/decide', { notaryId: 'notary-1' });
    });
  });

  it('disables candidates that are not approved or not accepting assignments', async () => {
    apiGetMock.mockImplementation(async (url: string) => {
      if (url === '/api/v1/matters/matter-1') {
        return {
          data: {
            id: 'matter-1',
            title: 'AJB Ruko',
            landCityCode: '3171',
            assignmentStatus: 'unassigned',
            documents: [
              { id: 'doc-ktp', document_type: 'ktp', verification_status: 'validated' },
              { id: 'doc-npwp', document_type: 'npwp', verification_status: 'validated' },
              { id: 'doc-sertifikat', document_type: 'sertifikat', verification_status: 'validated' },
              { id: 'doc-pbb', document_type: 'pbb', verification_status: 'validated' },
              { id: 'doc-kk', document_type: 'kk', verification_status: 'validated' },
            ],
          },
        };
      }

      if (url === '/api/v1/matters/matter-1/assignment/recommendations') {
        return {
          data: [
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

      throw new Error(`Unhandled URL ${url}`);
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MatterAssignment />
      </QueryClientProvider>
    );

    fireEvent.click(await screen.findByText('Dapatkan Rekomendasi'));

    const candidate = await screen.findByRole('button', { name: /Notaris Pending/i });
    expect((candidate as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Hanya notaris approved dan siap assignment yang dapat dipilih.')).toBeTruthy();
    expect((screen.getByText('Konfirmasi Assignment') as HTMLButtonElement).disabled).toBe(true);
  });

  it('blocks recommendation and assignment actions when core documents are incomplete', async () => {
    apiGetMock.mockImplementation(async (url: string) => {
      if (url === '/api/v1/matters/matter-1') {
        return {
          data: {
            id: 'matter-1',
            title: 'AJB Ruko',
            landCityCode: '3171',
            assignmentStatus: 'unassigned',
            documents: [
              { id: 'doc-ktp', document_type: 'ktp', verification_status: 'validated' },
              { id: 'doc-npwp', document_type: 'npwp', verification_status: 'pending' },
            ],
          },
        };
      }

      throw new Error(`Unhandled URL ${url}`);
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MatterAssignment />
      </QueryClientProvider>
    );

    expect(await screen.findByText('Assignment diblokir sampai dokumen inti tervalidasi.')).toBeTruthy();
    expect(screen.queryByText('Dapatkan Rekomendasi')).toBeNull();
    expect(screen.queryByText('Konfirmasi Assignment')).toBeNull();
    expect(apiGetMock).not.toHaveBeenCalledWith('/api/v1/matters/matter-1/assignment/recommendations');
    expect(apiPostMock).not.toHaveBeenCalled();
  });
});

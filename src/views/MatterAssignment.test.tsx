import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MatterAssignment from './MatterAssignment';

const apiGetMock = vi.fn();

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
    post: vi.fn(),
  },
}));

vi.mock('../store/ui', () => ({
  notifyError: vi.fn(),
  notifySuccess: vi.fn(),
}));

describe('MatterAssignment', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
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
              distanceKm: 3.2,
              activeMattersCount: 4,
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
});

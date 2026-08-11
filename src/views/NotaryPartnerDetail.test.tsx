import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NotaryPartnerDetail from './NotaryPartnerDetail';

const apiGetMock = vi.fn();
let routeId = 'np-1';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: any) => <a href={to} {...props}>{children}</a>,
  useParams: () => ({ id: routeId }),
}));

vi.mock('../api/client', () => ({
  api: {
    get: (...args: any[]) => apiGetMock(...args),
  },
}));

function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <NotaryPartnerDetail />
    </QueryClientProvider>
  );

  return queryClient;
}

const partner = {
  notaryProfileId: 'np-1',
  fullName: 'Raka Pratama',
  email: 'raka@example.dev',
  phone: '0812',
  licenseNumber: 'MN.123',
  status: 'approved',
  acceptsNewAssignment: true,
  jurisdictionCity: 'Jakarta Selatan',
  jurisdictionProvince: 'DKI Jakarta',
  coverageAreas: [{ cityName: 'Jakarta Selatan', provinceName: 'DKI Jakarta', coverageType: 'service_area' }],
  activeMattersCount: 2,
  rating: 4.6,
  slaPerformanceScore: 91,
};

describe('NotaryPartnerDetail', () => {
  beforeEach(() => {
    routeId = 'np-1';
    apiGetMock.mockReset();
    apiGetMock.mockImplementation(async (url: string, params?: Record<string, unknown>) => {
      if (url === '/api/v1/admin/notary-partners') {
        return { data: [partner] };
      }
      if (url === '/api/v1/admin/matters') {
        return {
          data: {
            items: [
              {
                id: 'matter-1',
                caseNumber: 'AJB-001',
                title: 'AJB Ruko',
                workflowStatus: 'in_progress',
                assignmentStatus: 'assigned',
              },
            ],
          },
        };
      }
      throw new Error(`Unhandled URL ${url} ${JSON.stringify(params)}`);
    });
  });

  it('renders partner profile detail from list lookup', async () => {
    renderScreen();

    expect((await screen.findAllByText('Raka Pratama')).length).toBeGreaterThan(0);
    expect(screen.getByText('MN.123')).toBeTruthy();
    expect(screen.getByText('raka@example.dev')).toBeTruthy();
    expect(screen.getAllByText('Jakarta Selatan, DKI Jakarta').length).toBeGreaterThan(0);
    expect(screen.getByText('91% SLA')).toBeTruthy();
    expect(screen.getByText('4.6')).toBeTruthy();
    expect(screen.getByText('Audit status belum tersedia dari contract backend saat ini.')).toBeTruthy();
  });

  it('fetches assigned matters with assignedNotaryProfileId', async () => {
    renderScreen();

    expect(await screen.findByText('AJB Ruko')).toBeTruthy();
    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith('/api/v1/admin/matters', {
        assignedNotaryProfileId: 'np-1',
        page: 1,
        limit: 100,
      });
    });
    expect(screen.getByText('AJB-001')).toBeTruthy();
  });

  it('shows empty assigned matter state safely', async () => {
    apiGetMock.mockImplementation(async (url: string) => {
      if (url === '/api/v1/admin/notary-partners') return { data: [partner] };
      if (url === '/api/v1/admin/matters') return { data: { items: [] } };
      throw new Error(`Unhandled URL ${url}`);
    });

    renderScreen();

    expect(await screen.findByText('Belum ada perkara aktif untuk notaris ini.')).toBeTruthy();
  });

  it('handles missing partner with not-found message', async () => {
    routeId = 'missing';
    apiGetMock.mockResolvedValue({ data: [partner] });

    renderScreen();

    expect(await screen.findByText('Notaris mitra tidak ditemukan')).toBeTruthy();
  });
});

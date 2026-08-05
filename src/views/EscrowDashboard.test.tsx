import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import EscrowDashboard from './EscrowDashboard';

const apiGetMock = vi.fn();

vi.mock('../api/client', () => ({
  api: {
    get: (...args: any[]) => apiGetMock(...args),
    post: vi.fn(),
  },
}));

vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({
    user: {
      id: 'maker-1',
      roles: ['FINANCE_ADMIN'],
    },
  }),
}));

describe('EscrowDashboard', () => {
  it('disables checker action for maker-owned payout', async () => {
    apiGetMock.mockImplementation(async (url: string) => {
      if (url === '/api/v1/matters') {
        return { data: { items: [{ id: 'matter-1', caseNumber: 'AJB-001', title: 'AJB Ruko Margonda' }] } };
      }
      if (url === '/api/v1/matters/matter-1/escrow') {
        return {
          data: {
            totalAmount: 150000000,
            pendingAmount: 50000000,
            releasedAmount: 25000000,
          },
        };
      }
      if (url === '/api/v1/matters/matter-1/escrow/releases') {
        return {
          data: [
            {
              id: 'rel-1',
              amount: 25000000,
              status: 'pending',
              createdByUserId: 'maker-1',
              createdByName: 'Finance A',
            },
          ],
        };
      }
      throw new Error(`Unhandled URL ${url}`);
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <EscrowDashboard />
      </QueryClientProvider>
    );

    await waitFor(() => expect(screen.getByText('AJB-001')).toBeTruthy());
    const checkerButton = screen.getByText('Setujui (Checker)') as HTMLButtonElement;
    expect(checkerButton.disabled).toBe(true);
    expect(screen.getByText('Anda tidak bisa menyetujui payout yang Anda buat sendiri.')).toBeTruthy();
  });
});

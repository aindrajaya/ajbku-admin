import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NotaryPayouts from './NotaryPayouts';

const apiGetMock = vi.fn();

vi.mock('../api/client', () => ({
  api: {
    get: (...args: any[]) => apiGetMock(...args),
  },
}));

const payouts = [
  {
    id: 'payout-1',
    matterId: 'matter-1',
    matterTitle: 'AJB Ruko',
    notaryProfileId: 'np-1',
    notaryName: 'Raka Pratama',
    amount: 2500000,
    status: 'pending',
    createdAt: '2026-08-10T10:00:00.000Z',
    paidAt: null,
  },
  {
    id: 'payout-2',
    matterId: 'matter-2',
    matterTitle: 'AJB Rumah',
    notaryProfileId: 'np-2',
    notaryName: 'Dewi Santoso',
    amount: 3750000,
    status: 'paid',
    createdAt: '2026-08-09T10:00:00.000Z',
    paidAt: '2026-08-11T10:00:00.000Z',
  },
  {
    id: 'payout-3',
    matterId: 'matter-3',
    matterTitle: 'AJB Tanah',
    notaryProfileId: 'np-3',
    notaryName: 'Bima Lestari',
    amount: 1500000,
    status: 'cancelled',
    createdAt: '2026-08-08T10:00:00.000Z',
    paidAt: null,
  },
];

function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <NotaryPayouts />
    </QueryClientProvider>
  );

  return queryClient;
}

describe('NotaryPayouts', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiGetMock.mockResolvedValue({ data: payouts });
  });

  it('fetches notary payouts with empty params by default', async () => {
    renderScreen();

    expect(await screen.findByText('AJB Ruko')).toBeTruthy();
    expect(apiGetMock).toHaveBeenCalledWith('/api/v1/admin/notary-payouts', {});
  });

  it('sends status filter to the list endpoint', async () => {
    renderScreen();

    await screen.findByText('AJB Ruko');
    fireEvent.change(screen.getByDisplayValue('Semua Status'), { target: { value: 'pending' } });

    await waitFor(() =>
      expect(apiGetMock).toHaveBeenCalledWith('/api/v1/admin/notary-payouts', { status: 'pending' })
    );

    fireEvent.change(screen.getByDisplayValue('Pending'), { target: { value: 'paid' } });
    await waitFor(() =>
      expect(apiGetMock).toHaveBeenCalledWith('/api/v1/admin/notary-payouts', { status: 'paid' })
    );

    fireEvent.change(screen.getByDisplayValue('Paid'), { target: { value: 'cancelled' } });
    await waitFor(() =>
      expect(apiGetMock).toHaveBeenCalledWith('/api/v1/admin/notary-payouts', { status: 'cancelled' })
    );
  });

  it('renders payout rows with matter, notary, amount, status, and dates', async () => {
    renderScreen();

    expect(await screen.findByText('AJB Ruko')).toBeTruthy();
    expect(screen.getByText('matter-1')).toBeTruthy();
    expect(screen.getByText('Raka Pratama')).toBeTruthy();
    expect(screen.getByText('np-1')).toBeTruthy();
    expect(screen.getByText(/2\.500\.000/)).toBeTruthy();
    expect(screen.getAllByText('Pending').length).toBeGreaterThan(0);
    expect(screen.getAllByText('-').length).toBeGreaterThan(0);
    expect(screen.getByText('Dewi Santoso')).toBeTruthy();
    expect(screen.getAllByText('Paid').length).toBeGreaterThan(0);
  });

  it('renders fallback payout values and invalid date strings safely', async () => {
    apiGetMock.mockReset();
    apiGetMock.mockResolvedValue({
      data: [
        {
          id: 'payout-fallback',
          matter: { id: 'matter-fallback' },
          notary_profile: { id: 'np-fallback' },
          amount: 'not-a-number',
          status: 'processing',
          created_at: 'not-a-date',
          paid_at: 'also-not-a-date',
        },
      ],
    });

    renderScreen();

    expect(await screen.findByText('matter-fallback')).toBeTruthy();
    expect(screen.getByText('np-fallback')).toBeTruthy();
    expect(screen.getByText('Notary Partner')).toBeTruthy();
    expect(screen.getByText(/Rp\s*0/)).toBeTruthy();
    expect(screen.getAllByText('Pending').length).toBeGreaterThan(0);
    expect(screen.getByText('not-a-date')).toBeTruthy();
    expect(screen.getByText('also-not-a-date')).toBeTruthy();
    expect(screen.getByText('-')).toBeTruthy();
  });

  it('shows metrics for pending, paid, and cancelled payouts', async () => {
    renderScreen();

    await screen.findByText('AJB Ruko');
    expect(within(screen.getAllByText('Pending')[0].parentElement as HTMLElement).getByText('1')).toBeTruthy();
    expect(within(screen.getAllByText('Paid')[0].parentElement as HTMLElement).getByText('1')).toBeTruthy();
    expect(within(screen.getAllByText('Cancelled')[0].parentElement as HTMLElement).getByText('1')).toBeTruthy();
  });

  it('filters client-side search by matter, notary, amount, and status label', async () => {
    renderScreen();

    await screen.findByText('AJB Ruko');
    fireEvent.change(screen.getByPlaceholderText('Cari matter, notaris, amount, atau status'), {
      target: { value: 'Dewi' },
    });
    expect(screen.getByText('Dewi Santoso')).toBeTruthy();
    expect(screen.queryByText('Raka Pratama')).toBeNull();

    fireEvent.change(screen.getByPlaceholderText('Cari matter, notaris, amount, atau status'), {
      target: { value: '1500000' },
    });
    expect(screen.getByText('Bima Lestari')).toBeTruthy();
    expect(screen.queryByText('Dewi Santoso')).toBeNull();

    fireEvent.change(screen.getByPlaceholderText('Cari matter, notaris, amount, atau status'), {
      target: { value: 'cancelled' },
    });
    expect(screen.getByText('AJB Tanah')).toBeTruthy();
    expect(screen.queryByText('AJB Ruko')).toBeNull();
  });

  it('renders loading state safely', () => {
    apiGetMock.mockReturnValueOnce(new Promise(() => undefined));
    renderScreen();
    expect(screen.getByText('Memuat notary payouts...')).toBeTruthy();
  });

  it('renders empty state safely', async () => {
    apiGetMock.mockReset();
    apiGetMock.mockResolvedValue({ data: [] });
    renderScreen();
    expect(await screen.findByText('Belum ada notary payout pada status ini.')).toBeTruthy();
  });

  it('renders filtered-empty state safely', async () => {
    apiGetMock.mockReset();
    apiGetMock.mockResolvedValue({ data: payouts });
    renderScreen();
    await screen.findByText('AJB Ruko');
    fireEvent.change(screen.getByPlaceholderText('Cari matter, notaris, amount, atau status'), {
      target: { value: 'not-found' },
    });
    expect(screen.getByText('Tidak ada notary payout yang cocok dengan pencarian.')).toBeTruthy();
  });
});

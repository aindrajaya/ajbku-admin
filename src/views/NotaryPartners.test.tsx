import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NotaryPartners from './NotaryPartners';

const apiGetMock = vi.fn();
const apiPatchMock = vi.fn();
const notifySuccessMock = vi.fn();
const notifyErrorMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, params, ...props }: any) => (
    <a href={params?.id ? String(to).replace('$id', params.id) : String(to)} {...props}>{children}</a>
  ),
}));

vi.mock('../api/client', () => ({
  api: {
    get: (...args: any[]) => apiGetMock(...args),
    patch: (...args: any[]) => apiPatchMock(...args),
  },
}));

vi.mock('../store/ui', () => ({
  notifySuccess: (...args: any[]) => notifySuccessMock(...args),
  notifyError: (...args: any[]) => notifyErrorMock(...args),
}));

const partners = [
  {
    notaryProfileId: 'np-pending',
    userId: 'user-1',
    fullName: 'Raka Pratama',
    email: 'raka@example.dev',
    phone: '0812',
    licenseNumber: 'MN.123',
    status: 'pending_approval',
    acceptsNewAssignment: false,
    jurisdictionCity: 'Jakarta Selatan',
    jurisdictionProvince: 'DKI Jakarta',
    coverageAreas: [{ cityName: 'Jakarta Selatan', provinceName: 'DKI Jakarta', coverageType: 'service_area' }],
    activeMattersCount: 1,
    slaPerformanceScore: 80,
  },
  {
    notaryProfileId: 'np-approved',
    userId: 'user-2',
    fullName: 'Dewi Santoso',
    email: 'dewi@example.dev',
    phone: '0822',
    licenseNumber: 'MN.456',
    status: 'approved',
    acceptsNewAssignment: true,
    jurisdictionCity: 'Bandung',
    jurisdictionProvince: 'Jawa Barat',
    coverageAreas: [{ cityName: 'Bandung', provinceName: 'Jawa Barat', coverageType: 'legal_authority' }],
    activeMattersCount: 3,
    slaPerformanceScore: 95,
  },
  {
    notaryProfileId: 'np-rejected',
    userId: 'user-3',
    fullName: 'Bima Lestari',
    email: 'bima@example.dev',
    phone: '0833',
    licenseNumber: 'MN.789',
    status: 'rejected',
    acceptsNewAssignment: false,
    jurisdictionCity: 'Surabaya',
    jurisdictionProvince: 'Jawa Timur',
    coverageAreas: [{ cityName: 'Surabaya', provinceName: 'Jawa Timur', coverageType: 'service_area' }],
    activeMattersCount: 0,
    slaPerformanceScore: 0,
  },
  {
    notaryProfileId: 'np-suspended',
    userId: 'user-4',
    fullName: 'Sinta Wijaya',
    email: 'sinta@example.dev',
    phone: '0844',
    licenseNumber: 'MN.900',
    status: 'suspended',
    acceptsNewAssignment: true,
    jurisdictionCity: 'Medan',
    jurisdictionProvince: 'Sumatera Utara',
    coverageAreas: [{ cityName: 'Medan', provinceName: 'Sumatera Utara', coverageType: 'service_area' }],
    activeMattersCount: 2,
    slaPerformanceScore: 70,
  },
];

type QueryFamilyPredicate = (query: { queryKey: unknown[] }) => boolean;

function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <NotaryPartners />
    </QueryClientProvider>
  );

  return queryClient;
}

function getPredicateCalls(invalidateSpy: { mock: { calls: Array<[unknown?, ...unknown[]]> } }) {
  return invalidateSpy.mock.calls
    .map(([options]) => (options as { predicate?: QueryFamilyPredicate }).predicate)
    .filter((predicate): predicate is QueryFamilyPredicate => Boolean(predicate));
}

describe('NotaryPartners', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPatchMock.mockReset();
    notifySuccessMock.mockReset();
    notifyErrorMock.mockReset();
    apiGetMock.mockResolvedValue({ data: partners });
    apiPatchMock.mockResolvedValue({ data: { notaryProfileId: 'np-pending', status: 'approved' } });
  });

  it('renders fetched partner rows with status and assignment details', async () => {
    renderScreen();

    expect(await screen.findByText('Raka Pratama')).toBeTruthy();
    expect(screen.getByText('MN.123')).toBeTruthy();
    expect(screen.getAllByText('Jakarta Selatan, DKI Jakarta').length).toBeGreaterThan(0);
    expect(screen.getByText('Menunggu Approval')).toBeTruthy();
    expect(screen.getByText('Siap Assignment')).toBeTruthy();
    expect(screen.getAllByText('Tidak Aktif').length).toBeGreaterThan(0);
    expect(screen.getByText('1 perkara aktif')).toBeTruthy();
    expect(screen.getByText('80% SLA')).toBeTruthy();
  });

  it('links each row to the notary partner detail route', async () => {
    renderScreen();

    await screen.findByText('Raka Pratama');
    const detailLinks = screen.getAllByText('Buka Detail');

    expect(detailLinks[0].getAttribute('href')).toBe('/notary-partners/np-pending');
  });

  it('shows metric cards for pending, approved, and rejected or suspended partners', async () => {
    renderScreen();

    await screen.findByText('Raka Pratama');
    expect(within(screen.getAllByText('Pending Approval')[0].parentElement as HTMLElement).getByText('1')).toBeTruthy();
    expect(within(screen.getAllByText('Approved')[0].parentElement as HTMLElement).getByText('1')).toBeTruthy();
    expect(within(screen.getByText('Rejected / Suspended').parentElement as HTMLElement).getByText('2')).toBeTruthy();
  });

  it('sends status filter to the list endpoint', async () => {
    renderScreen();

    await screen.findByText('Raka Pratama');
    fireEvent.change(screen.getByDisplayValue('Semua Status'), { target: { value: 'approved' } });

    await waitFor(() =>
      expect(apiGetMock).toHaveBeenCalledWith('/api/v1/admin/notary-partners', { status: 'approved' })
    );
  });

  it('filters client-side search by name, license, city, and coverage', async () => {
    renderScreen();

    await screen.findByText('Raka Pratama');
    fireEvent.change(screen.getByPlaceholderText('Cari nama, lisensi, kota, atau coverage'), {
      target: { value: 'MN.456' },
    });

    expect(screen.getByText('Dewi Santoso')).toBeTruthy();
    expect(screen.queryByText('Raka Pratama')).toBeNull();

    fireEvent.change(screen.getByPlaceholderText('Cari nama, lisensi, kota, atau coverage'), {
      target: { value: 'Surabaya' },
    });
    expect(screen.getByText('Bima Lestari')).toBeTruthy();
    expect(screen.queryByText('Dewi Santoso')).toBeNull();
  });

  it('approves a partner through the status endpoint and invalidates the list', async () => {
    const queryClient = renderScreen();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await screen.findByText('Raka Pratama');
    fireEvent.click(screen.getAllByText('Approve')[0]);

    await waitFor(() =>
      expect(apiPatchMock).toHaveBeenCalledWith('/api/v1/admin/notary-partners/np-pending/status', { status: 'approved' })
    );
    const predicates = getPredicateCalls(invalidateSpy);
    expect(predicates.some((predicate) => predicate({ queryKey: ['notary-partners', {}] }))).toBe(true);
    expect(predicates.some((predicate) => predicate({ queryKey: ['notary-payouts', {}] }))).toBe(false);
    expect(notifySuccessMock).toHaveBeenCalledWith('Notaris mitra berhasil di-approve.');
  });

  it('rejects a partner after confirmation through the status endpoint', async () => {
    renderScreen();

    await screen.findByText('Dewi Santoso');
    fireEvent.click(screen.getAllByText('Reject')[0]);

    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.click(screen.getByText('Konfirmasi Reject'));

    await waitFor(() =>
      expect(apiPatchMock).toHaveBeenCalledWith('/api/v1/admin/notary-partners/np-pending/status', { status: 'rejected' })
    );
    expect(notifySuccessMock).toHaveBeenCalledWith('Notaris mitra berhasil di-reject.');
  });

  it('shows backend errors when approve mutation fails', async () => {
    apiPatchMock.mockRejectedValueOnce({ response: { data: { message: 'Status tidak valid' } } });
    renderScreen();

    await screen.findByText('Raka Pratama');
    fireEvent.click(screen.getAllByText('Approve')[0]);

    await waitFor(() => expect(notifyErrorMock).toHaveBeenCalledWith('Status tidak valid'));
    expect(notifySuccessMock).not.toHaveBeenCalled();
  });

  it('shows fallback errors when reject mutation fails', async () => {
    apiPatchMock.mockRejectedValueOnce(new Error('Network down'));
    renderScreen();

    await screen.findByText('Raka Pratama');
    fireEvent.click(screen.getAllByText('Reject')[0]);
    fireEvent.click(screen.getByText('Konfirmasi Reject'));

    await waitFor(() => expect(notifyErrorMock).toHaveBeenCalledWith('Network down'));
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('renders loading and empty states safely', async () => {
    apiGetMock.mockReturnValueOnce(new Promise(() => undefined));
    renderScreen();
    expect(screen.getByText('Memuat notaris mitra...')).toBeTruthy();

    apiGetMock.mockReset();
    apiGetMock.mockResolvedValue({ data: [] });
    renderScreen();
    expect(await screen.findByText('Belum ada notaris mitra pada status ini.')).toBeTruthy();
  });
});

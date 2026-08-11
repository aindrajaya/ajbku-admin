import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ReportsOperational from './ReportsOperational';

const apiGetMock = vi.fn();
const saveFileMock = vi.fn();
const notifySuccessMock = vi.fn();
const notifyErrorMock = vi.fn();

vi.mock('../api/client', () => ({
  api: {
    get: (...args: any[]) => apiGetMock(...args),
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
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <ReportsOperational />
    </QueryClientProvider>
  );

  return queryClient;
}

function decodeSavedCsv() {
  const payload = saveFileMock.mock.calls[0][0];
  return new TextDecoder().decode(payload.buffer);
}

describe('ReportsOperational CSV export', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    saveFileMock.mockReset();
    notifySuccessMock.mockReset();
    notifyErrorMock.mockReset();
    saveFileMock.mockResolvedValue({ success: true, filePath: 'C:/tmp/report.csv' });
    (window as any).electronAPI = {
      dialog: {
        saveFile: (...args: any[]) => saveFileMock(...args),
      },
    };
  });

  it('keeps current CSV columns when optional notary fields are absent', async () => {
    apiGetMock.mockResolvedValue({
      data: [
        {
          caseNumber: 'AJB-001',
          serviceName: 'AJB',
          clientName: 'Budi Santoso',
          createdAt: '2026-06-10T00:00:00.000Z',
          workflowStatus: 'closed',
          transactionValue: 1000000,
        },
      ],
    });

    renderScreen();
    await screen.findAllByText('1 berkas');
    fireEvent.click(screen.getByText('Ekspor CSV (Excel)'));

    await waitFor(() => expect(saveFileMock).toHaveBeenCalled());
    const csv = decodeSavedCsv();
    expect(csv).toContain('No. Perkara,Layanan,Klien,Tanggal Pengajuan,Status,Nilai Transaksi');
    expect(csv).not.toContain('Notaris');
    expect(csv).not.toContain('Notary Payout Status');
    expect(csv).toContain('"AJB-001","AJB","Budi Santoso"');
  });

  it('adds optional notary, payout, and intake columns when backend rows contain them', async () => {
    apiGetMock.mockResolvedValue({
      data: [
        {
          caseNumber: 'AJB-002',
          serviceName: 'AJB',
          clientName: 'Dewi "Client"',
          createdAt: '2026-06-11T00:00:00.000Z',
          workflowStatus: 'payment_verified',
          transactionValue: 2500000,
          notaryName: 'Raka, Notaris',
          notaryProfileId: 'np-1',
          notaryPayoutStatus: 'pending',
          notaryPayoutAmount: 750000,
          intakeSource: 'client_mandiri',
        },
      ],
    });

    renderScreen();
    await screen.findAllByText('1 berkas');
    fireEvent.click(screen.getByText('Ekspor CSV (Excel)'));

    await waitFor(() => expect(saveFileMock).toHaveBeenCalled());
    const csv = decodeSavedCsv();
    expect(csv).toContain('No. Perkara,Layanan,Klien,Tanggal Pengajuan,Status,Nilai Transaksi,Notaris,Notary Profile ID,Notary Payout Status,Notary Payout Amount,Intake Source');
    expect(csv).toContain('"Dewi ""Client"""');
    expect(csv).toContain('"Raka, Notaris"');
    expect(csv).toContain('"np-1","pending","750000","client_mandiri"');
  });

  it('supports snake_case optional fields without adding absent optional columns', async () => {
    apiGetMock.mockResolvedValue({
      data: [
        {
          caseNumber: 'AJB-003',
          serviceName: 'Hibah',
          clientName: 'Sinta',
          workflowStatus: 'closed',
          notary_name: 'Bima Lestari',
          notary_payout_status: 'paid',
        },
      ],
    });

    renderScreen();
    await screen.findAllByText('1 berkas');
    fireEvent.click(screen.getByText('Ekspor CSV (Excel)'));

    await waitFor(() => expect(saveFileMock).toHaveBeenCalled());
    const csv = decodeSavedCsv();
    expect(csv).toContain('Nilai Transaksi,Notaris,Notary Payout Status');
    expect(csv).not.toContain('Notary Profile ID');
    expect(csv).not.toContain('Notary Payout Amount');
    expect(csv).toContain('"Bima Lestari","paid"');
  });
});

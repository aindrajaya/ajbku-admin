import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Dashboard from './Dashboard';

const apiGetMock = vi.fn();
let roles = ['PRINCIPAL'];
let matterRows: any[] = [];

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, params, ...props }: any) => (
    <a href={params?.id ? String(to).replace('$id', params.id) : String(to)} {...props}>{children}</a>
  ),
  useNavigate: () => vi.fn(),
}));

vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({ status: 'authenticated' }),
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
      <Dashboard />
    </QueryClientProvider>
  );

  return queryClient;
}

describe('Dashboard v3 metrics', () => {
  beforeEach(() => {
    roles = ['PRINCIPAL'];
    matterRows = [
      { id: 'matter-1', caseNumber: 'AJB-001', title: 'AJB Ruko', workflowStatus: 'documents_under_review', landCityCode: '3171' },
      { id: 'matter-2', caseNumber: 'AJB-002', title: 'AJB Rumah', workflowStatus: 'intake_submitted', landCityCode: '3172' },
    ];

    apiGetMock.mockReset();
    apiGetMock.mockImplementation(async (url: string, params?: Record<string, unknown>) => {
      if (url === '/api/v1/auth/me') return { data: { roles } };
      if (url === '/api/v1/matters') return { data: matterRows };
      if (url === '/api/v1/moderation/messages/flagged') return { data: [] };
      if (url === '/api/v1/admin/notary-partners' && params?.status === 'pending_approval') {
        return {
          data: [
            { notaryProfileId: 'np-1', fullName: 'Raka Pratama', status: 'pending_approval' },
            { notaryProfileId: 'np-2', fullName: 'Dewi Santoso', status: 'pending_approval' },
          ],
        };
      }
      if (url === '/api/v1/admin/notary-payouts' && params?.status === 'pending') {
        return {
          data: [
            { id: 'pay-1', matterId: 'matter-1', notaryProfileId: 'np-1', notaryName: 'Raka Pratama', amount: 2500000, status: 'pending' },
          ],
        };
      }
      throw new Error(`Unhandled URL ${url} ${JSON.stringify(params)}`);
    });
  });

  it('fetches pending notary approvals and pending notary payouts through real helpers', async () => {
    renderScreen();

    await screen.findByText('Notaris Pending');

    expect(apiGetMock).toHaveBeenCalledWith('/api/v1/admin/notary-partners', { status: 'pending_approval' });
    expect(apiGetMock).toHaveBeenCalledWith('/api/v1/admin/notary-payouts', { status: 'pending' });
  });

  it('renders principal notary metrics with links to notary modules', async () => {
    renderScreen();

    await screen.findByText('Notaris Pending');
    const notaryMetric = screen.getByText('Notaris Pending').closest('a') as HTMLAnchorElement;
    const payoutMetric = screen.getByText('Payout Notaris').closest('a') as HTMLAnchorElement;

    expect(notaryMetric.getAttribute('href')).toBe('/notary-partners');
    expect(payoutMetric.getAttribute('href')).toBe('/notary-payouts');
    await waitFor(() => expect(within(notaryMetric).getByText('2')).toBeTruthy());
    expect(within(payoutMetric).getByText('1')).toBeTruthy();
  });

  it('renders intake mandiri only when matter rows include supported source marker', async () => {
    matterRows = [
      { id: 'matter-1', caseNumber: 'AJB-001', title: 'AJB Mandiri', workflowStatus: 'intake_submitted', intakeSource: 'client_mandiri' },
      { id: 'matter-2', caseNumber: 'AJB-002', title: 'AJB Staff', workflowStatus: 'intake_submitted', intakeSource: 'staff' },
    ];

    renderScreen();

    const intakeMetric = await screen.findByText('Intake Mandiri');
    expect(within(intakeMetric.closest('a') as HTMLAnchorElement).getByText('1')).toBeTruthy();
  });

  it('does not render intake mandiri when source marker is absent', async () => {
    renderScreen();

    await screen.findByText('Notaris Pending');
    expect(screen.queryByText('Intake Mandiri')).toBeNull();
  });

  it('uses real pending notary payout count for finance dashboard', async () => {
    roles = ['FINANCE_ADMIN'];

    renderScreen();

    await screen.findByText('Dana di Escrow');
    const payoutMetric = screen.getByText('Payout Notaris');
    const metricLink = payoutMetric.closest('a') as HTMLAnchorElement;
    expect(metricLink.getAttribute('href')).toBe('/notary-payouts');
    expect(within(metricLink).getByText('1')).toBeTruthy();
  });
});

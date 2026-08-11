import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SettingsView from './Settings';

const apiGetMock = vi.fn();

vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({
    user: {
      id: 'admin-1',
      tenantId: 'tenant-1',
      roles: ['PRINCIPAL'],
    },
  }),
}));

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return {
    ...actual,
    api: {
      get: (...args: any[]) => apiGetMock(...args),
      post: vi.fn(),
      patch: vi.fn(),
    },
  };
});

describe('SettingsView', () => {
  beforeEach(() => {
    localStorage.clear();
    apiGetMock.mockReset();
    apiGetMock.mockImplementation(async (url: string) => {
      if (url === '/api/v1/tenants/tenant-1') {
        return {
          data: {
            id: 'tenant-1',
            code: 'AJB',
            name: 'Kantor AJB',
            status: 'active',
            address: 'Jl. Sudirman',
            phone: '021123456',
            logoUrl: null,
            logoStorageKey: null,
          },
        };
      }

      if (url === '/api/v1/tenants/tenant-1/users') {
        return { data: [] };
      }

      if (url === '/api/v1/tenants/tenant-1/notaries') {
        return { data: [] };
      }

      if (url === '/api/v1/tenants/tenant-1/rates') {
        return {
          data: {
            tenantId: 'tenant-1',
            baseFee: 2500000,
            njoptkp: 12000000,
            bphtbRate: 5,
            pphRate: 2.5,
            certificateCheckFee: 500000,
            transferNameFee: 1500000,
            extraRates: {},
          },
        };
      }

      throw new Error(`Unhandled URL ${url}`);
    });
  });

  it('hydrates server settings once and renders the first allowed tab', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <SettingsView />
      </QueryClientProvider>
    );

    expect(await screen.findByDisplayValue('Kantor AJB')).toBeTruthy();
    expect(screen.getByText('Profil Kantor')).toBeTruthy();
    expect(screen.getByText('Wilayah Notaris')).toBeTruthy();
  });
});

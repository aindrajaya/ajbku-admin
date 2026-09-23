import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Matters from './Matters';

const apiGetMock = vi.fn();

vi.mock('../api/client', () => ({ api: { get: (...args: unknown[]) => apiGetMock(...args) } }));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a>,
  useNavigate: () => vi.fn(),
}));

const categories = [
  { id: 'cat-pajak', code: 'AJB-PAJAK', name: 'AJB - Pajak', description: 'Pajak', isActive: true, requiresBpn: false, requiresNotaryAssignment: true, createdAt: '', updatedAt: '' },
  { id: 'cat-oke', code: 'AJB-OKE', name: 'AJB - Oke', description: 'Oke', isActive: true, requiresBpn: true, requiresNotaryAssignment: true, createdAt: '', updatedAt: '' },
];

function renderScreen() {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><Matters /></QueryClientProvider>);
}

describe('Matters service category filter', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiGetMock.mockImplementation((url: string) => {
      if (url === '/api/v1/matters/service-categories') return Promise.resolve({ data: categories });
      return Promise.resolve({ data: [] });
    });
  });

  it('uses the catalogue order and sends the selected UUID to the matter list endpoint', async () => {
    renderScreen();
    const filter = await screen.findByTestId('service-category-filter');
    await waitFor(() => expect(Array.from((filter as HTMLSelectElement).options).map((option) => option.text)).toEqual([
        'Semua Layanan', 'AJB - Pajak', 'AJB - Oke',
      ]));

    fireEvent.change(filter, { target: { value: 'cat-oke' } });
    await waitFor(() => expect(apiGetMock).toHaveBeenCalledWith('/api/v1/matters', expect.objectContaining({ serviceCategoryId: 'cat-oke' })));
  });
});

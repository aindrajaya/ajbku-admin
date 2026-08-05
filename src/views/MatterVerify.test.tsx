import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MatterVerify from './MatterVerify';

const apiGetMock = vi.fn();
const mutateMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ id: 'matter-1' }),
  useNavigate: () => vi.fn(),
}));

vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'admin-1' } }),
}));

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(() => ({
    promise: Promise.resolve({
      getPage: async () => ({
        getViewport: () => ({ width: 200, height: 300 }),
        render: () => ({ promise: Promise.resolve() }),
      }),
    }),
  })),
}));

vi.mock('../api/client', () => ({
  api: {
    get: (...args: any[]) => apiGetMock(...args),
    post: vi.fn(),
  },
}));

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useMutation: () => ({
      mutate: mutateMock,
      isPending: false,
    }),
  };
});

describe('MatterVerify', () => {
  beforeEach(() => {
    (window as any).electronAPI = {
      documents: {
        fetchBinary: vi.fn(async () => ({
          success: true,
          buffer: new Uint8Array([1, 2, 3]).buffer,
          contentType: 'image/png',
        })),
      },
      dialog: {
        saveFile: vi.fn(),
      },
    };
    mutateMock.mockReset();
    apiGetMock.mockImplementation(async (url: string) => {
      if (url === '/api/v1/matters/matter-1') {
        return {
          data: {
            id: 'matter-1',
            caseNumber: 'AJB-001',
            title: 'AJB Ruko',
            documents: [
              {
                id: 'doc-1',
                document_type: 'ktp',
                verification_status: 'uploaded',
                latestVersion: {
                  original_filename: 'ktp.png',
                  mime_type: 'image/png',
                },
              },
            ],
          },
        };
      }
      if (url === '/api/v1/documents/doc-1/download-url') {
        return { data: { url: 'https://example.test/ktp.png' } };
      }
      throw new Error(`Unhandled URL ${url}`);
    });
  });

  it('shows inline error for 15-digit NIK and blocks submit mutation', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MatterVerify />
      </QueryClientProvider>
    );

    await waitFor(() => expect(screen.getByText(/Verifikasi Dokumen/i)).toBeTruthy());
    await waitFor(() => expect((screen.getByText('KTP') as HTMLButtonElement).disabled).toBe(false));

    const fields = screen.getAllByRole('textbox');
    fireEvent.change(fields[0], { target: { value: '123456789012345' } });
    fireEvent.change(fields[1], { target: { value: 'Budi Santoso' } });
    fireEvent.change(fields[2], { target: { value: 'Madiun' } });
    fireEvent.change(fields[3], { target: { value: '1990-01-01' } });
    fireEvent.change(fields[4], { target: { value: 'Jl. Diponegoro No. 1' } });
    fireEvent.change(fields[5], { target: { value: 'Wiraswasta' } });

    fireEvent.blur(fields[0]);

    expect(await screen.findByText('NIK harus 16 digit angka.')).toBeTruthy();
    expect(mutateMock).not.toHaveBeenCalled();
  });
});

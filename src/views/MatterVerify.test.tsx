import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MatterVerify from './MatterVerify';

const apiGetMock = vi.fn();
const mutateMock = vi.fn();
const navigateMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ id: 'matter-1' }),
  useNavigate: () => navigateMock,
}));

vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'admin-1', roles: ['ADMIN_INTAKE'] } }),
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
    navigateMock.mockReset();
    localStorage.clear();
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

    await waitFor(() => expect(screen.getByText(/AJB-001/)).toBeTruthy());
    await waitFor(() => expect((screen.getAllByText('KTP Penjual')[0] as HTMLButtonElement).disabled).toBe(false));

    const getFieldInput = (label: string) => {
      const inputGroup = screen.getByText(label).closest('.input-group');
      return inputGroup?.querySelector('input, textarea') as HTMLInputElement | HTMLTextAreaElement;
    };

    const nikInput = getFieldInput('NIK *');
    fireEvent.change(nikInput, { target: { value: '123456789012345' } });
    fireEvent.change(getFieldInput('Nama Lengkap *'), { target: { value: 'Budi Santoso' } });
    fireEvent.change(getFieldInput('Tempat Lahir *'), { target: { value: 'Madiun' } });
    fireEvent.change(getFieldInput('Tanggal Lahir *'), { target: { value: '1990-01-01' } });
    fireEvent.change(getFieldInput('Alamat *'), { target: { value: 'Jl. Diponegoro No. 1' } });
    fireEvent.change(getFieldInput('Pekerjaan *'), { target: { value: 'Wiraswasta' } });

    fireEvent.blur(nikInput);

    expect(await screen.findByText('NIK harus 16 digit angka.')).toBeTruthy();
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it('renders KTP birth date as a date input', async () => {
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

    await waitFor(() => expect(screen.getByText(/AJB-001/)).toBeTruthy());

    const birthDateLabel = screen.getByText('Tanggal Lahir *');
    const inputGroup = birthDateLabel.closest('.input-group');
    const birthDateInput = inputGroup?.querySelector('input');

    expect(birthDateInput?.getAttribute('type')).toBe('date');
  });

  it('navigates back to matter detail explicitly', async () => {
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

    await waitFor(() => expect(screen.getByText(/AJB-001/)).toBeTruthy());

    fireEvent.click(screen.getAllByRole('button')[0]);

    expect(navigateMock).toHaveBeenCalledWith({ to: '/matters/$id', params: { id: 'matter-1' } });
  });

  it('keeps the requested document tab after matter documents load', async () => {
    localStorage.setItem('ajbku-verify-target-matter-1', 'npwp');
    apiGetMock.mockImplementation(async (url: string) => {
      if (url === '/api/v1/matters/matter-1') {
        return {
          data: {
            id: 'matter-1',
            caseNumber: 'AJB-001',
            title: 'AJB Ruko',
            documents: [
              {
                id: 'doc-ktp',
                document_type: 'ktp',
                verification_status: 'uploaded',
                latestVersion: { original_filename: 'ktp.png', mime_type: 'image/png' },
              },
              {
                id: 'doc-npwp',
                document_type: 'npwp',
                verification_status: 'uploaded',
                latestVersion: { original_filename: 'npwp.png', mime_type: 'image/png' },
              },
              {
                id: 'doc-kk',
                document_type: 'kartu_keluarga',
                verification_status: 'uploaded',
                latestVersion: { original_filename: 'kk.png', mime_type: 'image/png' },
              },
            ],
          },
        };
      }
      if (url === '/api/v1/documents/doc-npwp/download-url') {
        return { data: { url: 'https://example.test/npwp.png' } };
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
        <MatterVerify />
      </QueryClientProvider>
    );

    expect(await screen.findByText('Nomor NPWP *')).toBeTruthy();
    await waitFor(() => expect(screen.getAllByText(/npwp\.png/).length).toBeGreaterThan(0));
    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith('/api/v1/documents/doc-npwp/download-url');
    });
  });

  it('opens buyer-specific document tabs from backend party role data', async () => {
    localStorage.setItem('ajbku-verify-target-matter-1', 'npwp-pembeli');
    apiGetMock.mockImplementation(async (url: string) => {
      if (url === '/api/v1/matters/matter-1') {
        return {
          data: {
            id: 'matter-1',
            caseNumber: 'AJB-001',
            title: 'AJB Ruko',
            documents: [
              {
                id: 'doc-npwp-seller',
                document_type: 'npwp',
                party_role: 'seller',
                verification_status: 'uploaded',
                latestVersion: { original_filename: 'npwp-penjual.png', mime_type: 'image/png' },
              },
              {
                id: 'doc-npwp-buyer',
                document_type: 'npwp',
                party_role: 'buyer',
                verification_status: 'validated',
                latestVersion: { original_filename: 'npwp-pembeli.png', mime_type: 'image/png' },
              },
            ],
          },
        };
      }
      if (url === '/api/v1/documents/doc-npwp-buyer/download-url') {
        return { data: { url: 'https://example.test/npwp-pembeli.png' } };
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
        <MatterVerify />
      </QueryClientProvider>
    );

    expect(await screen.findByText('Status Verifikasi Dokumen NPWP Pembeli')).toBeTruthy();
    await waitFor(() => expect(screen.getAllByText(/npwp-pembeli\.png/).length).toBeGreaterThan(0));
    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith('/api/v1/documents/doc-npwp-buyer/download-url');
    });
  });
});

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ChatInbox from './ChatInbox';

const apiGetMock = vi.fn();
const apiPostMock = vi.fn();

vi.mock('../api/client', () => ({
  api: {
    get: (...args: any[]) => apiGetMock(...args),
    post: (...args: any[]) => apiPostMock(...args),
  },
}));

vi.mock('../store/realtime', () => ({
  useRealtimeStore: (selector: any) => selector({ fallbackEnabled: false }),
}));

describe('ChatInbox', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPostMock.mockReset();
  });

  it('sends text-only chat payload and renders empty messages safely', async () => {
    apiGetMock.mockImplementation(async (url: string) => {
      if (url === '/api/v1/chat/threads') {
        return {
          data: [
            {
              threadId: 'thread-1',
              matterId: 'matter-1',
              matterCaseNumber: 'AJB-001',
              counterpartyName: 'Budi',
              counterpartyRole: 'CLIENT',
              lastMessage: 'Halo admin',
              lastMessageAt: '2026-06-26T10:00:00.000Z',
              unreadCount: 1,
            },
          ],
        };
      }
      if (url === '/api/v1/matters/matter-1/chat/messages') {
        return { data: [] };
      }
      throw new Error(`Unhandled URL ${url}`);
    });
    apiPostMock.mockResolvedValue({ data: {} });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ChatInbox />
      </QueryClientProvider>
    );

    await waitFor(() => expect(screen.getByText('AJB-001')).toBeTruthy());
    fireEvent.click(screen.getByText('Budi'));

    expect(await screen.findByText('Belum ada percakapan. Kirim pesan pertama untuk memulai obrolan.')).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('Tulis pesan... (Ctrl+Enter untuk kirim)'), {
      target: { value: 'Pesan baru' },
    });
    fireEvent.click(screen.getByText('Kirim'));

    await waitFor(() =>
      expect(apiPostMock).toHaveBeenCalledWith('/api/v1/matters/matter-1/chat/messages', {
        messageType: 'text',
        bodyText: 'Pesan baru',
      })
    );
  });
});

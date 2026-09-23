import React from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RealtimeProvider } from './RealtimeProvider';

const setStatusMock = vi.fn();
const markEventMock = vi.fn();
const getSupabaseRealtimeClientMock = vi.fn();
const removeChannelsMock = vi.fn();
const clearRealtimeAuthMock = vi.fn();
const getRealtimeAuthTokenMock = vi.fn();

let authState: {
  status: 'authenticated' | 'unauthenticated';
  user: { id: string; tenantId: string } | null;
  realtimeTokenVersion?: number;
} = {
  status: 'authenticated',
  user: { id: 'user-1', tenantId: 'tenant-1' },
  realtimeTokenVersion: 0,
};

interface RealtimeHandler {
  channelName: string;
  eventType: string;
  filter: Record<string, unknown>;
  callback: () => void;
}

type QueryFamilyPredicate = (query: { queryKey: unknown[] }) => boolean;

const handlers: RealtimeHandler[] = [];
const channels: Array<{
  name: string;
  on: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
}> = [];

vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => authState,
}));

vi.mock('../store/realtime', () => ({
  useRealtimeStore: (selector: (state: { setStatus: typeof setStatusMock; markEvent: typeof markEventMock }) => unknown) =>
    selector({
      setStatus: setStatusMock,
      markEvent: markEventMock,
    }),
}));

vi.mock('./supabase', () => ({
  getSupabaseRealtimeClient: () => getSupabaseRealtimeClientMock(),
  removeChannels: (createdChannels: unknown[]) => removeChannelsMock(createdChannels),
  clearRealtimeAuth: (client: unknown) => clearRealtimeAuthMock(client),
}));

vi.mock('../api/client', () => ({
  getRealtimeAuthToken: () => getRealtimeAuthTokenMock(),
}));

function createRealtimeClient() {
  return {
    realtime: {
      setAuth: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
    },
    removeAllChannels: vi.fn().mockResolvedValue([]),
    channel: vi.fn((name: string) => {
      const channel = {
        name,
        on: vi.fn((eventType: string, filter: Record<string, unknown>, callback: () => void) => {
          handlers.push({ channelName: name, eventType, filter, callback });
          return channel;
        }),
        subscribe: vi.fn((callback?: (status: string) => void) => {
          callback?.('SUBSCRIBED');
          return channel;
        }),
      };
      channels.push(channel);
      return channel;
    }),
  };
}

function renderProvider(queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RealtimeProvider>
        <div>content</div>
      </RealtimeProvider>
    </QueryClientProvider>
  );

  return { ...view, queryClient };
}

function getHandler(tableName: string) {
  const handler = handlers.find((item) => item.filter.table === tableName);
  if (!handler) {
    throw new Error(`Missing handler for ${tableName}`);
  }
  return handler;
}

function getPredicateCalls(invalidateSpy: { mock: { calls: Array<[unknown?, ...unknown[]]> } }) {
  return invalidateSpy.mock.calls
    .map(([options]) => (options as { predicate?: QueryFamilyPredicate }).predicate)
    .filter((predicate): predicate is QueryFamilyPredicate => Boolean(predicate));
}

beforeEach(() => {
  authState = {
    status: 'authenticated',
    user: { id: 'user-1', tenantId: 'tenant-1' },
    realtimeTokenVersion: 0,
  };
  handlers.length = 0;
  channels.length = 0;
  setStatusMock.mockClear();
  markEventMock.mockClear();
  getSupabaseRealtimeClientMock.mockReset();
  removeChannelsMock.mockClear();
  clearRealtimeAuthMock.mockClear();
  getRealtimeAuthTokenMock.mockReset();
  getRealtimeAuthTokenMock.mockResolvedValue({ accessToken: 'realtime-token', userId: 'user-1' });
  getSupabaseRealtimeClientMock.mockReturnValue(createRealtimeClient());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('RealtimeProvider', () => {
  it('sets the authenticated token before subscribing and preserves all channel contracts', async () => {
    const client = createRealtimeClient();
    getSupabaseRealtimeClientMock.mockReturnValue(client);
    renderProvider();

    await vi.waitFor(() => expect(channels).toHaveLength(5));

    expect(client.realtime.setAuth).toHaveBeenCalledWith('realtime-token');
    expect(client.realtime.setAuth.mock.invocationCallOrder[0]).toBeLessThan(channels[0].subscribe.mock.invocationCallOrder[0]);
    expect(channels.map((channel) => channel.name)).toEqual([
      'notifications:user-1',
      'moderation:tenant-1',
      'chat-messages:user-1',
      'chat-participants:user-1',
      'notary-partners:tenant-1',
    ]);
    expect(getHandler('notary_profiles')).toMatchObject({
      channelName: 'notary-partners:tenant-1',
      eventType: 'postgres_changes',
      filter: { event: '*', schema: 'public', table: 'notary_profiles' },
    });
  });

  it('invalidates notary partner list and detail query families for notary profile events', () => {
    const { queryClient } = renderProvider();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    return vi.waitFor(() => expect(handlers).not.toHaveLength(0)).then(() => {
      getHandler('notary_profiles').callback();

      const predicates = getPredicateCalls(invalidateSpy);
      expect(markEventMock).toHaveBeenCalledTimes(1);
      expect(predicates).toHaveLength(2);
      expect(predicates.some((predicate: QueryFamilyPredicate) => predicate({ queryKey: ['notary-partners', {}] }))).toBe(true);
      expect(predicates.some((predicate: QueryFamilyPredicate) => predicate({ queryKey: ['notary-partner-detail', 'notary-1'] }))).toBe(true);
      expect(predicates.some((predicate: QueryFamilyPredicate) => predicate({ queryKey: ['notary-payouts', {}] }))).toBe(false);
    });
  });

  it('sets fallback status and creates no notary channels when Supabase client is missing', () => {
    getSupabaseRealtimeClientMock.mockReturnValue(null);

    renderProvider();

    expect(setStatusMock).toHaveBeenCalledWith('fallback');
    expect(channels).toHaveLength(0);
    expect(removeChannelsMock).not.toHaveBeenCalled();
  });

  it('removes all created channels and clears the authenticated realtime session on cleanup', async () => {
    const { unmount } = renderProvider();

    await vi.waitFor(() => expect(channels).toHaveLength(5));

    unmount();

    expect(removeChannelsMock).toHaveBeenCalledWith(channels);
    await vi.waitFor(() => expect(clearRealtimeAuthMock).toHaveBeenCalledTimes(1));
    expect(setStatusMock).toHaveBeenLastCalledWith('idle');
  });

  it('does not subscribe until an authenticated realtime token is available', async () => {
    getRealtimeAuthTokenMock.mockResolvedValue(null);

    renderProvider();

    await vi.waitFor(() => expect(setStatusMock).toHaveBeenCalledWith('fallback'));
    expect(channels).toHaveLength(0);
  });

  it('updates Realtime authorization when the access token refreshes', async () => {
    const client = createRealtimeClient();
    getSupabaseRealtimeClientMock.mockReturnValue(client);
    getRealtimeAuthTokenMock
      .mockResolvedValueOnce({ accessToken: 'token-before-refresh', userId: 'user-1' })
      .mockResolvedValueOnce({ accessToken: 'token-after-refresh', userId: 'user-1' });

    const { rerender } = renderProvider();
    await vi.waitFor(() => expect(client.realtime.setAuth).toHaveBeenCalledWith('token-before-refresh'));

    authState = { ...authState, realtimeTokenVersion: 1 };
    rerender(<QueryClientProvider client={new QueryClient()}><RealtimeProvider><div>content</div></RealtimeProvider></QueryClientProvider>);

    await vi.waitFor(() => expect(client.realtime.setAuth).toHaveBeenCalledWith('token-after-refresh'));
  });

  it('removes old-user channels before activating a switched user session', async () => {
    getRealtimeAuthTokenMock
      .mockResolvedValueOnce({ accessToken: 'user-1-token', userId: 'user-1' })
      .mockResolvedValueOnce({ accessToken: 'user-2-token', userId: 'user-2' });

    const { rerender } = renderProvider();
    await vi.waitFor(() => expect(channels).toHaveLength(5));
    const firstSessionChannels = [...channels];

    authState = { status: 'authenticated', user: { id: 'user-2', tenantId: 'tenant-2' }, realtimeTokenVersion: 0 };
    rerender(<QueryClientProvider client={new QueryClient()}><RealtimeProvider><div>content</div></RealtimeProvider></QueryClientProvider>);

    await vi.waitFor(() => expect(channels).toHaveLength(10));
    expect(removeChannelsMock).toHaveBeenCalledWith(firstSessionChannels);
    expect(channels.slice(5).map((channel) => channel.name)).toContain('notifications:user-2');
  });
});

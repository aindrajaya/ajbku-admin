import React from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RealtimeProvider } from './RealtimeProvider';

const setStatusMock = vi.fn();
const markEventMock = vi.fn();
const getSupabaseRealtimeClientMock = vi.fn();
const removeChannelsMock = vi.fn();

let authState: {
  status: 'authenticated' | 'unauthenticated';
  user: { id: string; tenantId: string } | null;
} = {
  status: 'authenticated',
  user: { id: 'user-1', tenantId: 'tenant-1' },
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
}));

function createRealtimeClient() {
  return {
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
  };
  handlers.length = 0;
  channels.length = 0;
  setStatusMock.mockClear();
  markEventMock.mockClear();
  getSupabaseRealtimeClientMock.mockReset();
  removeChannelsMock.mockClear();
  getSupabaseRealtimeClientMock.mockReturnValue(createRealtimeClient());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('RealtimeProvider', () => {
  it('creates existing realtime channels plus notary partner and payout channels for authenticated users', () => {
    renderProvider();

    expect(channels.map((channel) => channel.name)).toEqual([
      'notifications:user-1',
      'moderation:tenant-1',
      'chat-messages:user-1',
      'chat-participants:user-1',
      'notary-partners:tenant-1',
      'notary-payouts:tenant-1',
    ]);
    expect(getHandler('notary_profiles')).toMatchObject({
      channelName: 'notary-partners:tenant-1',
      eventType: 'postgres_changes',
      filter: { event: '*', schema: 'public', table: 'notary_profiles' },
    });
    expect(getHandler('notary_payouts')).toMatchObject({
      channelName: 'notary-payouts:tenant-1',
      eventType: 'postgres_changes',
      filter: { event: '*', schema: 'public', table: 'notary_payouts' },
    });
  });

  it('invalidates notary partner list and detail query families for notary profile events', () => {
    const { queryClient } = renderProvider();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    getHandler('notary_profiles').callback();

    const predicates = getPredicateCalls(invalidateSpy);
    expect(markEventMock).toHaveBeenCalledTimes(1);
    expect(predicates).toHaveLength(2);
    expect(predicates.some((predicate: QueryFamilyPredicate) => predicate({ queryKey: ['notary-partners', {}] }))).toBe(true);
    expect(predicates.some((predicate: QueryFamilyPredicate) => predicate({ queryKey: ['notary-partner-detail', 'notary-1'] }))).toBe(true);
    expect(predicates.some((predicate: QueryFamilyPredicate) => predicate({ queryKey: ['notary-payouts', {}] }))).toBe(false);
  });

  it('invalidates notary payout query family for notary payout events', () => {
    const { queryClient } = renderProvider();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    getHandler('notary_payouts').callback();

    const predicates = getPredicateCalls(invalidateSpy);
    expect(markEventMock).toHaveBeenCalledTimes(1);
    expect(predicates).toHaveLength(1);
    expect(predicates[0]({ queryKey: ['notary-payouts', {}] })).toBe(true);
    expect(predicates[0]({ queryKey: ['notary-partners', {}] })).toBe(false);
  });

  it('sets fallback status and creates no notary channels when Supabase client is missing', () => {
    getSupabaseRealtimeClientMock.mockReturnValue(null);

    renderProvider();

    expect(setStatusMock).toHaveBeenCalledWith('fallback');
    expect(channels).toHaveLength(0);
    expect(removeChannelsMock).not.toHaveBeenCalled();
  });

  it('removes all created channels on cleanup', () => {
    const { unmount } = renderProvider();

    unmount();

    expect(removeChannelsMock).toHaveBeenCalledWith(channels);
    expect(setStatusMock).toHaveBeenLastCalledWith('idle');
  });
});

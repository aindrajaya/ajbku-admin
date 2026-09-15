import React, { useEffect, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import { useRealtimeStore } from '../store/realtime';
import { queryKeys } from '../lib/queryKeys';
import { getRealtimeAuthToken } from '../api/client';
import { clearRealtimeAuth, getSupabaseRealtimeClient, removeChannels } from './supabase';

function invalidateQueryFamily(queryClient: QueryClient, familyName: string) {
  void queryClient.invalidateQueries({
    predicate: (query) => Array.isArray(query.queryKey) && query.queryKey[0] === familyName,
  });
}

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { status, user, realtimeTokenVersion } = useAuth();
  const queryClient = useQueryClient();
  const setStatus = useRealtimeStore((state) => state.setStatus);
  const markEvent = useRealtimeStore((state) => state.markEvent);
  const realtimeCleanup = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let active = true;
    let channels: RealtimeChannel[] = [];
    let client: ReturnType<typeof getSupabaseRealtimeClient> = null;

    if (status !== 'authenticated' || !user?.tenantId) {
      setStatus('idle');
      return () => {
        active = false;
      };
    }

    client = getSupabaseRealtimeClient();
    if (!client) {
      setStatus('fallback');
      return () => {
        active = false;
      };
    }

    setStatus('connecting');

    void (async () => {
      await realtimeCleanup.current;
      if (!active) return;

      const realtimeAuth = await getRealtimeAuthToken();
      if (!active || !realtimeAuth || realtimeAuth.userId !== user.id) {
        if (active) setStatus('fallback');
        return;
      }

      await client.realtime.setAuth(realtimeAuth.accessToken);
      if (!active) return;

      channels = [
      client
        .channel(`notifications:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            markEvent();
            void queryClient.invalidateQueries({ queryKey: queryKeys.notificationsList() });
          }
        )
        .subscribe((subscriptionStatus) => {
          if (subscriptionStatus === 'SUBSCRIBED') {
            setStatus('connected');
          }
        }),
      client
        .channel(`moderation:${user.tenantId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'chat_messages',
            filter: 'is_flagged=eq.true',
          },
          () => {
            markEvent();
            void queryClient.invalidateQueries({
              predicate: (query) => Array.isArray(query.queryKey) && query.queryKey[0] === 'moderation.flaggedMessages',
            });
          }
        )
        .subscribe(),
      client
        .channel(`chat-messages:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'chat_messages',
          },
          () => {
            markEvent();
            void queryClient.invalidateQueries({ queryKey: queryKeys.chatThreads() });
            void queryClient.invalidateQueries({
              predicate: (query) => Array.isArray(query.queryKey) && query.queryKey[0] === 'chat.thread',
            });
          }
        )
        .subscribe(),
      client
        .channel(`chat-participants:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'chat_participants',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            markEvent();
            void queryClient.invalidateQueries({ queryKey: queryKeys.chatThreads() });
          }
        )
        .subscribe(),
      client
        .channel(`notary-partners:${user.tenantId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notary_profiles',
          },
          () => {
            markEvent();
            invalidateQueryFamily(queryClient, 'notary-partners');
            invalidateQueryFamily(queryClient, 'notary-partner-detail');
          }
        )
        .subscribe(),
      ];
    })();

    return () => {
      active = false;
      removeChannels(channels);
      if (client) {
        realtimeCleanup.current = realtimeCleanup.current
          .catch(() => undefined)
          .then(() => clearRealtimeAuth(client));
      }
      setStatus('idle');
    };
  }, [markEvent, queryClient, realtimeTokenVersion, setStatus, status, user?.id, user?.tenantId]);

  return <>{children}</>;
}

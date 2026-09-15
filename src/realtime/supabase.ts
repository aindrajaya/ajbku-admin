import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import { getRealtimeAuthToken } from '../api/client';

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseRealtimeClient() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  if (!supabaseClient) {
    supabaseClient = createClient(url, anonKey, {
      accessToken: async () => (await getRealtimeAuthToken())?.accessToken ?? anonKey,
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
  }

  return supabaseClient;
}

export function removeChannels(channels: RealtimeChannel[]) {
  const client = getSupabaseRealtimeClient();
  if (!client) {
    return;
  }

  channels.forEach((channel) => {
    void client.removeChannel(channel);
  });
}

export async function clearRealtimeAuth(client: SupabaseClient) {
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  await client.removeAllChannels();
  if (anonKey) {
    await client.realtime.setAuth(anonKey);
  }
  await client.realtime.disconnect();
}

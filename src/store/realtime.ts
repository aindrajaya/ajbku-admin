import { create } from 'zustand';

export type RealtimeStatus = 'idle' | 'connecting' | 'connected' | 'fallback';

interface RealtimeState {
  status: RealtimeStatus;
  fallbackEnabled: boolean;
  fallbackIntervalMs: number;
  lastEventAt: number | null;
  setStatus: (status: RealtimeStatus) => void;
  markEvent: () => void;
}

export const useRealtimeStore = create<RealtimeState>((set) => ({
  status: 'idle',
  fallbackEnabled: true,
  fallbackIntervalMs: 10000,
  lastEventAt: null,
  setStatus: (status) =>
    set({
      status,
      fallbackEnabled: status !== 'connected',
    }),
  markEvent: () =>
    set({
      lastEventAt: Date.now(),
    }),
}));

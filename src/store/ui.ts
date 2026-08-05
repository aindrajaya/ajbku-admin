import { create } from 'zustand';

export type ToastTone = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  tone: ToastTone;
  message: string;
  title?: string;
}

interface UiState {
  toasts: ToastItem[];
  pushToast: (toast: Omit<ToastItem, 'id'>) => void;
  dismissToast: (id: string) => void;
}

export const useUiStore = create<UiState>((set) => ({
  toasts: [],
  pushToast: (toast) =>
    set((state) => ({
      toasts: [
        ...state.toasts,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          ...toast,
        },
      ],
    })),
  dismissToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    })),
}));

function pushToast(toast: Omit<ToastItem, 'id'>) {
  useUiStore.getState().pushToast(toast);
}

export function notifySuccess(message: string, title?: string) {
  pushToast({ tone: 'success', message, title });
}

export function notifyError(message: string, title?: string) {
  pushToast({ tone: 'error', message, title });
}

export function notifyWarning(message: string, title?: string) {
  pushToast({ tone: 'warning', message, title });
}

export function notifyInfo(message: string, title?: string) {
  pushToast({ tone: 'info', message, title });
}

import React, { useEffect } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { useUiStore, type ToastItem } from '../store/ui';

const toneStyles: Record<ToastItem['tone'], { border: string; background: string; color: string; icon: React.ReactNode }> = {
  success: {
    border: '1px solid rgba(16, 185, 129, 0.28)',
    background: 'rgba(16, 185, 129, 0.12)',
    color: '#6ee7b7',
    icon: <CheckCircle2 size={18} />,
  },
  error: {
    border: '1px solid rgba(239, 68, 68, 0.28)',
    background: 'rgba(239, 68, 68, 0.12)',
    color: '#fca5a5',
    icon: <AlertCircle size={18} />,
  },
  warning: {
    border: '1px solid rgba(217, 119, 6, 0.3)',
    background: 'rgba(217, 119, 6, 0.12)',
    color: '#fcd34d',
    icon: <AlertTriangle size={18} />,
  },
  info: {
    border: '1px solid rgba(59, 130, 246, 0.28)',
    background: 'rgba(59, 130, 246, 0.12)',
    color: '#93c5fd',
    icon: <Info size={18} />,
  },
};

export default function AppFeedback() {
  const toasts = useUiStore((state) => state.toasts);
  const dismissToast = useUiStore((state) => state.dismissToast);

  useEffect(() => {
    if (toasts.length === 0) {
      return;
    }

    const timers = toasts.map((toast) =>
      window.setTimeout(() => dismissToast(toast.id), toast.tone === 'error' ? 5500 : 4000)
    );

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [dismissToast, toasts]);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div style={{ position: 'fixed', right: '24px', bottom: '24px', zIndex: 200, display: 'flex', flexDirection: 'column', gap: '0.75rem', width: 'min(360px, calc(100vw - 32px))' }}>
      {toasts.map((toast) => {
        const palette = toneStyles[toast.tone];
        return (
          <div key={toast.id} className="glass-panel animate-fade-in" style={{ padding: '0.9rem 1rem', border: palette.border, background: palette.background, color: palette.color }}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <span style={{ marginTop: '0.1rem' }}>{palette.icon}</span>
              <div style={{ flex: 1 }}>
                {toast.title ? <div style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.2rem' }}>{toast.title}</div> : null}
                <div style={{ fontSize: '0.82rem', lineHeight: 1.45 }}>{toast.message}</div>
              </div>
              <button type="button" onClick={() => dismissToast(toast.id)} style={{ background: 'transparent', border: 'none', color: palette.color, cursor: 'pointer', padding: 0 }}>
                <X size={16} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

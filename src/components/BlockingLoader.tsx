import React from 'react';

export default function BlockingLoader({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(8, 15, 28, 0.55)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <div
        className="glass-panel animate-fade-in"
        style={{
          width: 'min(360px, calc(100vw - 32px))',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.85rem',
          textAlign: 'center',
          border: '1px solid var(--border-glass-active)',
          boxShadow: 'var(--shadow-premium), var(--shadow-emerald-glow)',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '999px',
            border: '3px solid rgba(255,255,255,0.12)',
            borderTopColor: 'var(--color-emerald)',
            animation: 'spin-loader 0.8s linear infinite',
          }}
        />
        <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{title}</div>
        <div style={{ fontSize: '0.84rem', lineHeight: 1.5, color: 'var(--text-secondary)' }}>{message}</div>
      </div>
      <style>{`
        @keyframes spin-loader {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

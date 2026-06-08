import React, { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCw, Home } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo
    });
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.hash = '#/';
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '80vh',
          padding: '2rem',
          fontFamily: 'var(--font-sans)',
          color: 'var(--text-primary)'
        }}>
          <div className="glass-panel animate-fade-in" style={{
            maxWidth: '600px',
            width: '100%',
            padding: '2.5rem',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5), 0 0 30px rgba(239, 68, 68, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            borderRadius: '12px'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1.5rem',
              color: '#ef4444'
            }}>
              <AlertTriangle size={32} />
            </div>

            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
              Terjadi Kesalahan Aplikasi
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: '1.5' }}>
              React tidak dapat merender halaman ini karena kesalahan internal. Detail kesalahan ditampilkan di bawah ini.
            </p>

            {/* Error Message Details */}
            <div style={{
              width: '100%',
              backgroundColor: 'rgba(0,0,0,0.3)',
              border: '1px solid var(--border-glass)',
              borderRadius: '8px',
              padding: '1rem',
              textAlign: 'left',
              marginBottom: '2rem',
              overflowX: 'auto',
              maxHeight: '150px'
            }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>
                PESAN ERROR:
              </span>
              <code style={{ fontSize: '0.8rem', color: '#f87171', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                {this.state.error?.toString() || 'Kesalahan rendering tidak dikenal'}
              </code>
              {this.state.errorInfo?.componentStack && (
                <>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.75rem', marginBottom: '0.25rem', fontWeight: 600 }}>
                    LOKASI KOMPONEN:
                  </span>
                  <pre style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace', margin: 0, whiteSpace: 'pre-wrap' }}>
                    {this.state.errorInfo.componentStack.split('\n').slice(0, 4).join('\n')}
                  </pre>
                </>
              )}
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
              <button 
                onClick={this.handleReload} 
                className="btn btn-primary" 
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
              >
                <RotateCw size={16} />
                Muat Ulang Halaman
              </button>
              <button 
                onClick={this.handleGoHome} 
                className="btn btn-secondary" 
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
              >
                <Home size={16} />
                Kembali ke Beranda
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

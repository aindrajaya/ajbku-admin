import React, { useEffect, useState } from 'react';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { ShieldCheck, Lock, Mail, Building, Key } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import BlockingLoader from '../components/BlockingLoader';

export default function Login() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const {
    tenantCode: persistedTenantCode,
    setTenantCode,
    status,
    pendingAuth,
    loginWithCredentials,
    completeTotpLogin,
    cancelCredentialAuth,
  } = useAuth();
  const [tenantCode, setTenantCodeLocal] = useState(persistedTenantCode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isTotpStep = pathname === '/auth/totp' || pathname === '/login/totp' || status === 'credential-authenticated';

  useEffect(() => {
    if (status === 'credential-authenticated' && pathname !== '/auth/totp') {
      void navigate({ to: '/auth/totp', replace: true });
      return;
    }
    if ((pathname === '/auth/totp' || pathname === '/login/totp') && status !== 'credential-authenticated') {
      void navigate({ to: '/auth/login', replace: true });
    }
  }, [navigate, pathname, status]);

  const handleCredentialsSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!tenantCode || !email || !password) {
      setError('Seluruh kolom wajib diisi.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      setTenantCode(tenantCode);
      const result = await loginWithCredentials({
        tenantCode,
        email,
        password,
      });

      if (result.needsTotp) {
        await navigate({ to: '/auth/totp' });
      }
    } catch (err: any) {
      const message = typeof err?.message === 'string' ? err.message : '';
      const statusCode = err?.response?.status;
      console.info('[auth] login-ui-error', {
        statusCode: statusCode ?? null,
        message: message || null,
      });
      if (message.includes('401') || statusCode === 401) {
        setError('Kredensial atau kode kantor salah.');
      } else if (message) {
        setError(message);
      } else {
        setError('Gagal terhubung ke server.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTotpSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!pendingAuth) return;
    if (totpCode.length !== 6) {
      setError('Kode TOTP harus terdiri dari 6 digit.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await completeTotpLogin(totpCode);
    } catch {
      setError('Kode tidak valid. Pastikan waktu perangkat Anda sinkron.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      {loading ? (
        <BlockingLoader
          title={isTotpStep ? 'Memverifikasi Admin' : 'Masuk ke Dashboard Admin'}
          message={isTotpStep ? 'Kode authenticator sedang diverifikasi. Mohon tunggu sebentar.' : 'Kredensial admin sedang diperiksa dan sesi aman sedang disiapkan.'}
        />
      ) : null}
      <div className="glass-panel animate-fade-in auth-card" style={{ boxShadow: 'var(--shadow-premium), var(--shadow-emerald-glow)', border: '1px solid var(--border-glass-active)' }}>
        <div className="auth-card-header">
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.7rem', marginBottom: '1rem', borderRadius: '999px', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.22)', color: 'var(--color-emerald-hover)', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Admin Desktop
          </div>
          <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'linear-gradient(135deg, var(--color-emerald), var(--color-gold))', margin: '0 auto 1rem', display: 'grid', placeItems: 'center', boxShadow: 'var(--shadow-emerald-glow)' }}>
            <ShieldCheck size={32} style={{ color: '#fff' }} />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            {isTotpStep ? 'Verifikasi Dua Langkah Admin' : 'Masuk ke AJBku Admin'}
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {isTotpStep ? 'Masukkan kode TOTP dari aplikasi authenticator Anda sebelum session admin penuh dibuat.' : 'Akses khusus staf internal untuk operasional admin desktop. Bukan untuk klien atau workspace eksternal.'}
          </p>
          {!isTotpStep && (
            <div className="auth-role-list">
              {['ADMIN_INTAKE', 'ADMIN_OFFICE', 'FINANCE_ADMIN', 'PRINCIPAL', 'MODERATION_OFFICER'].map((role) => (
                <span
                  key={role}
                  style={{
                    padding: '0.35rem 0.65rem',
                    borderRadius: '999px',
                    background: 'rgba(15, 23, 42, 0.05)',
                    border: '1px solid var(--border-glass)',
                    color: 'var(--text-secondary)',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                  }}
                >
                  {role}
                </span>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#f87171', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            {error}
          </div>
        )}

        {!isTotpStep ? (
          <form onSubmit={handleCredentialsSubmit}>
            <div className="input-group">
              <label className="input-label" htmlFor="tenantCode">Kode Kantor</label>
              <div style={{ position: 'relative' }}>
                <Building size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input id="tenantCode" type="text" className="input-field" style={{ paddingLeft: '2.75rem' }} value={tenantCode} onChange={(e) => setTenantCodeLocal(e.target.value)} required />
              </div>
            </div>
            <div className="input-group">
              <label className="input-label" htmlFor="email">Email</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input id="email" type="email" className="input-field" style={{ paddingLeft: '2.75rem' }} value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
            </div>
            <div className="input-group">
              <label className="input-label" htmlFor="password">Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input id="password" type="password" className="input-field" style={{ paddingLeft: '2.75rem' }} value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%' }}>
              {loading ? 'Menghubungkan...' : 'Masuk Akun'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleTotpSubmit}>
            <div className="input-group">
              <label className="input-label" htmlFor="totpCode">Kode Authenticator</label>
              <div style={{ position: 'relative' }}>
                <Key size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input id="totpCode" type="text" maxLength={6} className="input-field" style={{ paddingLeft: '2.75rem', letterSpacing: '0.5em', textAlign: 'center', fontSize: '1.25rem', fontWeight: 'bold' }} value={totpCode} onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))} required autoFocus />
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn btn-accent-gold" style={{ width: '100%' }}>
              {loading ? 'Verifikasi...' : 'Verifikasi & Masuk'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ width: '100%', marginTop: '0.75rem' }}
              onClick={() => {
                cancelCredentialAuth();
                setTotpCode('');
                setError(null);
                void navigate({ to: '/auth/login', replace: true });
              }}
            >
              Kembali ke Login
            </button>
          </form>
        )}
      </div>
    </div>
  );
}


import React, { useState, useEffect } from 'react';
import { api, tokenManager } from '../api/client';
import { ShieldCheck, Lock, Mail, Building, Key } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: () => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [tenantCode, setTenantCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // TOTP Step states
  const [needsTotp, setNeedsTotp] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [tempTokenData, setTempTokenData] = useState<any>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill tenantCode from Electron store if available
  useEffect(() => {
    async function fetchSavedTenant() {
      const savedTenant = await tokenManager.get('savedTenantCode');
      if (savedTenant) {
        setTenantCode(savedTenant);
      }
    }
    fetchSavedTenant();
  }, []);

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantCode || !email || !password) {
      setError('Seluruh kolom wajib diisi');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Body payload conforming to NestJS login schema
      const res = await api.post('/api/v1/auth/login', {
        tenantCode,
        email,
        password,
      });

      const { accessToken, refreshToken, user, needsTotp: serverNeedsTotp } = res.data;

      // Save tenantCode to pre-fill on next run
      await window.electronAPI.storeToken('savedTenantCode', tenantCode);

      if (serverNeedsTotp) {
        // Cache tokens temporarily, wait for TOTP verification
        setTempTokenData({ accessToken, refreshToken, user });
        setNeedsTotp(true);
      } else {
        // Direct successful login
        await saveTokensAndLogin(accessToken, refreshToken, user);
      }
    } catch (err: any) {
      console.error(err);
      setError(
        err.response?.status === 401
          ? 'Kredensial atau Kode Kantor salah.'
          : 'Gagal terhubung ke server. Pastikan server aktif dan dapat diakses.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleTotpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!totpCode || totpCode.length !== 6) {
      setError('Kode TOTP harus terdiri dari 6 digit');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Verify TOTP via api
      const res = await api.post('/api/v1/auth/totp/verify', {
        code: totpCode,
      });

      if (res.data.verified) {
        const { accessToken, refreshToken, user } = tempTokenData;
        await saveTokensAndLogin(accessToken, refreshToken, user);
      } else {
        setError('Kode TOTP tidak valid');
      }
    } catch (err: any) {
      console.error(err);
      setError('Gagal verifikasi TOTP. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  const saveTokensAndLogin = async (access: string, refresh: string, user: any) => {
    // Write tokens to all layers (memory cache, Electron IPC, sessionStorage)
    // setSync first so the very next API call in this session immediately has a token
    tokenManager.setSync('accessToken', access);
    tokenManager.setSync('refreshToken', refresh);
    tokenManager.setSync('tenantId', user.tenantId);

    await tokenManager.set('accessToken', access);
    await tokenManager.set('refreshToken', refresh);
    await tokenManager.set('tenantId', user.tenantId);
    await tokenManager.set('isFullyAuthenticated', 'true');
    await tokenManager.set('savedTenantCode', tenantCode);

    // Set 15 minutes expiry timestamp
    const expiresAt = Date.now() + 15 * 60 * 1000;
    await tokenManager.set('tokenExpiresAt', String(expiresAt));

    onLoginSuccess();
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      width: '100vw',
      background: 'radial-gradient(circle at center, var(--bg-secondary) 0%, var(--bg-primary) 100%)',
      overflow: 'hidden'
    }}>
      <div className="glass-panel animate-fade-in" style={{
        width: '420px',
        padding: '2.5rem',
        boxShadow: 'var(--shadow-premium), var(--shadow-emerald-glow)',
        border: '1px solid var(--border-glass-active)'
      }}>
        
        {/* Logo and Greeting */}
        <div style={{ textAlign: 'center', marginBottom: '2.25rem' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, var(--color-emerald), var(--color-gold))',
            margin: '0 auto 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-emerald-glow)'
          }}>
            <ShieldCheck size={32} style={{ color: '#fff' }} />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            {needsTotp ? 'Verifikasi Keamanan' : 'Masuk ke AJBku'}
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {needsTotp 
              ? 'Masukkan kode TOTP dari Google Authenticator Anda' 
              : 'Portal Manajemen Operasional Notaris & PPAT'
            }
          </p>
        </div>

        {error && (
          <div style={{
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            color: '#f87171',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            fontSize: '0.85rem',
            marginBottom: '1.25rem',
            lineHeight: '1.4'
          }}>
            {error}
          </div>
        )}

        {/* Credentials Form (Step 1) */}
        {!needsTotp ? (
          <form onSubmit={handleCredentialsSubmit}>
            
            <div className="input-group">
              <label className="input-label" htmlFor="tenantCode">Kode Kantor (Tenant) *</label>
              <div style={{ position: 'relative' }}>
                <Building size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  id="tenantCode"
                  type="text" 
                  className="input-field" 
                  style={{ paddingLeft: '2.75rem' }} 
                  placeholder="Contoh: notaris-sejahtera-madiun" 
                  value={tenantCode}
                  onChange={(e) => setTenantCode(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="input-group">
              <label className="input-label" htmlFor="email">Email *</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  id="email"
                  type="email" 
                  className="input-field" 
                  style={{ paddingLeft: '2.75rem' }} 
                  placeholder="admin@notarissejahtera.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="input-group">
              <label className="input-label" htmlFor="password">Password *</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  id="password"
                  type="password" 
                  className="input-field" 
                  style={{ paddingLeft: '2.75rem' }} 
                  placeholder="••••••••••••" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
              {loading ? 'Menghubungkan...' : 'Masuk Akun'}
            </button>
            
          </form>
        ) : (
          /* TOTP Verification Form (Step 2) */
          <form onSubmit={handleTotpSubmit}>
            
            <div className="input-group">
              <label className="input-label" htmlFor="totpCode">Kode Authenticator (TOTP) *</label>
              <div style={{ position: 'relative' }}>
                <Key size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  id="totpCode"
                  type="text" 
                  maxLength={6}
                  className="input-field" 
                  style={{ paddingLeft: '2.75rem', letterSpacing: '0.5em', textAlign: 'center', fontSize: '1.25rem', fontWeight: 'bold' }} 
                  placeholder="123456" 
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                  required
                  autoFocus
                />
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn btn-accent-gold" style={{ width: '100%', marginTop: '1rem' }}>
              {loading ? 'Verifikasi...' : 'Verifikasi & Masuk'}
            </button>

            <button 
              type="button" 
              className="btn btn-secondary" 
              style={{ width: '100%', marginTop: '0.75rem' }}
              onClick={() => {
                setNeedsTotp(false);
                setTotpCode('');
                setTempTokenData(null);
                setError(null);
              }}
            >
              Kembali ke Login
            </button>
            
          </form>
        )}

        <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Lupa kode kantor? Hubungi administrator.
        </div>

      </div>
    </div>
  );
}

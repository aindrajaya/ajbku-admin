import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, getApiBaseUrl, getPublicAuthSession, sessionStorageBridge, type AuthUser } from '../api/client';

type AuthStatus = 'booting' | 'anonymous' | 'credential-authenticated' | 'authenticated';

interface PendingAuthState {
  tenantCode: string;
  user: AuthUser | null;
}

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  tenantCode: string;
  pendingAuth: PendingAuthState | null;
  setTenantCode: (value: string) => void;
  loginWithCredentials: (payload: { tenantCode: string; email: string; password: string }) => Promise<{ needsTotp: boolean }>;
  completeTotpLogin: (totpCode: string) => Promise<void>;
  cancelCredentialAuth: () => void;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function isElectron() {
  return typeof window !== 'undefined' && typeof window.electronAPI !== 'undefined';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('booting');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tenantCode, setTenantCodeState] = useState('');
  const [pendingAuth, setPendingAuth] = useState<PendingAuthState | null>(null);

  useEffect(() => {
    sessionStorageBridge.get('savedTenantCode').then((value) => {
      if (value) setTenantCodeState(value);
    });
  }, []);

  const refreshProfile = async () => {
        if (isElectron()) {
          const session = await window.electronAPI.auth.getSession({ baseUrl: getApiBaseUrl() });
      setUser(session.user ? ({ ...session.user, roles: session.user.roles as any } as AuthUser) : null);
      setTenantCodeState(session.tenantCode || '');
      setStatus(session.user ? 'authenticated' : 'anonymous');
      return;
    }

    const response = await api.get<AuthUser>('/api/v1/auth/me');
    setUser(response.data);
    if (response.data.tenantId) {
      await sessionStorageBridge.set('tenantId', response.data.tenantId);
    }
    if (response.data.officeId) {
      await sessionStorageBridge.set('officeId', response.data.officeId);
    }
    setStatus('authenticated');
  };

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        const session = await getPublicAuthSession();
        if (!active) return;

        setTenantCodeState(session.tenantCode || '');
        if (session.status === 'authenticated' && session.user) {
          setUser(session.user);
          setStatus('authenticated');
          return;
        }

        setUser(null);
        setStatus('anonymous');
      } catch {
        if (!active) return;
        setUser(null);
        setStatus('anonymous');
      }
    }

    void bootstrap();

    const handleLogout = async () => {
      if (isElectron()) {
        await window.electronAPI.auth.logout({ baseUrl: getApiBaseUrl() });
      } else {
        await sessionStorageBridge.clearAuth();
      }

      if (active) {
        setPendingAuth(null);
        setUser(null);
        setStatus('anonymous');
      }
    };

    window.addEventListener('ajbku-logout', handleLogout);
    const detach = isElectron()
      ? window.electronAPI.auth.onLogout(() => {
          window.dispatchEvent(new Event('ajbku-logout'));
        })
      : undefined;

    return () => {
      active = false;
      window.removeEventListener('ajbku-logout', handleLogout);
      detach?.();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      tenantCode,
      pendingAuth,
      setTenantCode: (value) => {
        setTenantCodeState(value);
        void sessionStorageBridge.set('savedTenantCode', value);
      },
      loginWithCredentials: async ({ tenantCode, email, password }) => {
        setTenantCodeState(tenantCode);
        await sessionStorageBridge.set('savedTenantCode', tenantCode);

        if (isElectron()) {
          const result = await window.electronAPI.auth.startLogin({
            tenantCode,
            email,
            password,
            baseUrl: getApiBaseUrl(),
          });

          if (!result.ok) {
            throw new Error(result.error || 'Login gagal.');
          }

          if (result.status === 'totp_required') {
            setPendingAuth({ tenantCode, user: result.user ? ({ ...result.user, roles: result.user.roles as any } as AuthUser) : null });
            setStatus('credential-authenticated');
            return { needsTotp: true };
          }

          setPendingAuth(null);
          setUser(result.session.user ? ({ ...result.session.user, roles: result.session.user.roles as any } as AuthUser) : null);
          setStatus(result.session.user ? 'authenticated' : 'anonymous');
          return { needsTotp: false };
        }

        const res = await api.post<{
          accessToken: string;
          refreshToken: string;
          user: AuthUser;
          needsTotp: boolean;
        }>('/api/v1/auth/login', {
          tenantCode,
          email,
          password,
        });

        const { accessToken, refreshToken, user, needsTotp } = res.data;
        if (needsTotp) {
          setPendingAuth({ tenantCode, user });
          setStatus('credential-authenticated');
          sessionStorageBridge.setSync('accessToken', accessToken);
          await sessionStorageBridge.set('accessToken', accessToken);
          await sessionStorageBridge.set('refreshToken', refreshToken);
          return { needsTotp: true };
        }

        await sessionStorageBridge.set('accessToken', accessToken);
        await sessionStorageBridge.set('refreshToken', refreshToken);
        await sessionStorageBridge.set('tenantId', user.tenantId);
        await sessionStorageBridge.set('tokenExpiresAt', String(Date.now() + 15 * 60 * 1000));
        if (user.officeId) {
          await sessionStorageBridge.set('officeId', user.officeId);
        }
        setUser(user);
        setPendingAuth(null);
        setStatus('authenticated');
        return { needsTotp: false };
      },
      completeTotpLogin: async (totpCode) => {
        if (!pendingAuth) {
          throw new Error('pending auth missing');
        }

        if (isElectron()) {
          const result = await window.electronAPI.auth.verifyTotp({
            otp: totpCode,
            baseUrl: getApiBaseUrl(),
          });

          if (!result.ok || !result.session?.user) {
            throw new Error(result.error || 'invalid-totp');
          }

          setUser({ ...result.session.user, roles: result.session.user.roles as any } as AuthUser);
          setTenantCodeState(result.session.tenantCode || pendingAuth.tenantCode);
          setPendingAuth(null);
          setStatus('authenticated');
          return;
        }

        const accessToken = await sessionStorageBridge.get('accessToken');
        if (!accessToken) {
          throw new Error('pending-access-token-missing');
        }

        const res = await api.post<{
          accessToken: string;
          refreshToken: string;
          verified: boolean;
          expiresIn?: number;
        }>('/api/v1/auth/totp/verify', {
          accessToken,
          otp: totpCode,
        });

        if (!res.data.verified) {
          throw new Error('invalid-totp');
        }

        await sessionStorageBridge.set('accessToken', res.data.accessToken || accessToken);
        await sessionStorageBridge.set('refreshToken', res.data.refreshToken);
        await sessionStorageBridge.set(
          'tokenExpiresAt',
          String(Date.now() + ((res.data.expiresIn || 15 * 60) * 1000))
        );
        await refreshProfile();
        setPendingAuth(null);
      },
      cancelCredentialAuth: () => {
        setPendingAuth(null);
        setStatus('anonymous');
      },
      logout: async () => {
        try {
          if (isElectron()) {
            await window.electronAPI.auth.logout({ baseUrl: getApiBaseUrl() });
          } else {
            await api.post('/api/v1/auth/logout');
          }
        } finally {
          await sessionStorageBridge.clearAuth();
          setPendingAuth(null);
          setUser(null);
          setStatus('anonymous');
        }
      },
      refreshProfile,
    }),
    [pendingAuth, status, tenantCode, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}

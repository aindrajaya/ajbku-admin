import axios from 'axios';

const BASE_URL_KEY = 'ajbku_api_base_url';
const DEFAULT_API_BASE_URL = 'https://net-lauren-aindrajaya-5a2990e1.koyeb.app';
// const DEFAULT_API_BASE_URL = 'http://localhost:3000';

export type AppRole =
  | 'PRINCIPAL'
  | 'SUPER_ADMIN'
  | 'TENANT_OWNER'
  | 'ADMIN_INTAKE'
  | 'ADMIN_OFFICE'
  | 'LEGAL_REVIEWER'
  | 'FINANCE_ADMIN'
  | 'NOTARY'
  | 'CLIENT'
  | 'EXTERNAL_PARTNER'
  | 'MODERATION_OFFICER';

type SessionKey =
  | 'accessToken'
  | 'refreshToken'
  | 'tokenExpiresAt'
  | 'tenantId'
  | 'officeId'
  | 'savedTenantCode'
  | 'theme';

const _memCache: Partial<Record<SessionKey, string>> = {};
const AUTH_KEYS: SessionKey[] = ['accessToken', 'refreshToken', 'tokenExpiresAt', 'tenantId', 'officeId'];

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  roles: AppRole[];
  tenantId: string;
  officeId?: string | null;
  profileId?: string | null;
}

export interface PublicAuthSession {
  status: 'anonymous' | 'authenticated';
  user: AuthUser | null;
  tenantCode: string;
  tokenExpiresAt?: number | null;
}

export interface AuthStateSnapshot {
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: string | null;
  tenantId: string | null;
  officeId: string | null;
}

export function getApiBaseUrl(): string {
  const saved = localStorage.getItem(BASE_URL_KEY);
  if (saved) {
    return saved.replace(/\/+$/, '');
  }

  const envBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, '');
  if (envBaseUrl) {
    return envBaseUrl;
  }

  return DEFAULT_API_BASE_URL;
}

export function setApiBaseUrl(url: string) {
  localStorage.setItem(BASE_URL_KEY, url.replace(/\/+$/, ''));
}

function isElectron() {
  return typeof window !== 'undefined' && typeof window.electronAPI !== 'undefined';
}

function camelize(str: string): string {
  return str.replace(/_([a-z0-9])/g, (_, ch) => ch.toUpperCase());
}

function camelizeKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(camelizeKeys);
  if (obj && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [camelize(k), camelizeKeys(v)])
    );
  }
  return obj;
}

function unwrapPayload<T>(raw: unknown): T {
  const payload =
    raw && typeof raw === 'object' && 'data' in (raw as Record<string, unknown>) && 'error' in (raw as Record<string, unknown>)
      ? (raw as Record<string, unknown>).data
      : raw;
  return camelizeKeys(payload) as T;
}

async function getElectronPublicSession() {
  const session = await window.electronAPI.auth.getSession({ baseUrl: getApiBaseUrl() });
  return {
    ...session,
    user: session.user
      ? {
          ...session.user,
          roles: session.user.roles as AppRole[],
        }
      : null,
  } as PublicAuthSession;
}

export const sessionStorageBridge = {
  async get(key: SessionKey): Promise<string | null> {
    if (_memCache[key]) return _memCache[key] ?? null;

    if (isElectron()) {
      if (key === 'savedTenantCode' || key === 'theme') {
        const value = await window.electronAPI.session.get(key);
        if (value) _memCache[key] = value;
        return value;
      }

      if (key === 'tenantId' || key === 'officeId' || key === 'tokenExpiresAt') {
        const session = await getElectronPublicSession();
        const value =
          key === 'tenantId'
            ? session.user?.tenantId || null
            : key === 'officeId'
              ? session.user?.officeId || null
              : session.tokenExpiresAt
                ? String(session.tokenExpiresAt)
                : null;
        if (value) _memCache[key] = value;
        return value;
      }

      return null;
    }

    const value = window.sessionStorage.getItem(`ajbku_${key}`);
    if (value) _memCache[key] = value;
    return value;
  },

  getSync(key: SessionKey): string | null {
    if (_memCache[key]) return _memCache[key] ?? null;
    if (isElectron()) return null;
    return window.sessionStorage.getItem(`ajbku_${key}`);
  },

  async set(key: SessionKey, value: string) {
    _memCache[key] = value;
    if (isElectron()) {
      if (key === 'savedTenantCode' || key === 'theme') {
        await window.electronAPI.session.set(key, value);
      }
      return;
    }
    window.sessionStorage.setItem(`ajbku_${key}`, value);
  },

  setSync(key: SessionKey, value: string) {
    _memCache[key] = value;
    if (!isElectron()) {
      window.sessionStorage.setItem(`ajbku_${key}`, value);
    }
  },

  async clearAuth() {
    AUTH_KEYS.forEach((key) => delete _memCache[key]);
    if (isElectron()) {
      await window.electronAPI.auth.logout({ baseUrl: getApiBaseUrl() });
      return;
    }

    AUTH_KEYS.forEach((key) => window.sessionStorage.removeItem(`ajbku_${key}`));
  },
};

const browserAxios = axios.create({
  headers: { 'Content-Type': 'application/json' },
});

let refreshPromise: Promise<string | null> | null = null;

async function refreshBrowserAuthToken(): Promise<string | null> {
  const refreshToken = await sessionStorageBridge.get('refreshToken');
  if (!refreshToken) return null;

  try {
    const response = await axios.post(`${getApiBaseUrl()}/api/v1/auth/refresh`, { refreshToken });
    const { accessToken: newAccess, refreshToken: newRefresh } = response.data;
    sessionStorageBridge.setSync('accessToken', newAccess);
    await sessionStorageBridge.set('accessToken', newAccess);
    await sessionStorageBridge.set('refreshToken', newRefresh);
    await sessionStorageBridge.set('tokenExpiresAt', String(Date.now() + 15 * 60 * 1000));
    return newAccess;
  } catch {
    await sessionStorageBridge.clearAuth();
    return null;
  }
}

browserAxios.interceptors.request.use(async (config) => {
  config.baseURL = getApiBaseUrl();
  const token = await sessionStorageBridge.get('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

browserAxios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest?._retry) {
      originalRequest._retry = true;

      if (!refreshPromise) {
        refreshPromise = refreshBrowserAuthToken().finally(() => {
          refreshPromise = null;
        });
      }

      const freshToken = await refreshPromise;
      if (freshToken) {
        originalRequest.headers.Authorization = `Bearer ${freshToken}`;
        return browserAxios(originalRequest);
      }

      window.dispatchEvent(new Event('ajbku-logout'));
    }

    return Promise.reject(error);
  }
);

async function electronRequest<T>(method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', url: string, payload?: { params?: any; body?: any }) {
  const response = await window.electronAPI.http.request({
    method,
    url,
    params: payload?.params,
    body: payload?.body,
    baseUrl: getApiBaseUrl(),
  });

  if (!response.ok) {
    const error: any = new Error(response.error || `Request failed with status ${response.status}.`);
    error.response = { status: response.status, data: response.data };
    throw error;
  }

  return { data: unwrapPayload<T>(response.data) };
}

export const api = {
  get: async <T = any>(url: string, params?: any): Promise<{ data: T }> => {
    if (isElectron()) {
      return electronRequest<T>('GET', url, { params });
    }
    const response = await browserAxios.get(url, { params });
    return { data: unwrapPayload<T>(response.data) };
  },
  post: async <T = any>(url: string, body?: any): Promise<{ data: T }> => {
    if (isElectron()) {
      return electronRequest<T>('POST', url, { body });
    }
    const response = await browserAxios.post(url, body);
    return { data: unwrapPayload<T>(response.data) };
  },
  patch: async <T = any>(url: string, body?: any): Promise<{ data: T }> => {
    if (isElectron()) {
      return electronRequest<T>('PATCH', url, { body });
    }
    const response = await browserAxios.patch(url, body);
    return { data: unwrapPayload<T>(response.data) };
  },
  put: async <T = any>(url: string, body?: any): Promise<{ data: T }> => {
    if (isElectron()) {
      return electronRequest<T>('PUT', url, { body });
    }
    const response = await browserAxios.put(url, body);
    return { data: unwrapPayload<T>(response.data) };
  },
  delete: async <T = any>(url: string): Promise<{ data: T }> => {
    if (isElectron()) {
      return electronRequest<T>('DELETE', url);
    }
    const response = await browserAxios.delete(url);
    return { data: unwrapPayload<T>(response.data) };
  },
};

export async function getAuthSnapshot(): Promise<AuthStateSnapshot> {
  if (isElectron()) {
    const session = await getElectronPublicSession();
    return {
      accessToken: null,
      refreshToken: null,
      tokenExpiresAt: session.tokenExpiresAt ? String(session.tokenExpiresAt) : null,
      tenantId: session.user?.tenantId || null,
      officeId: session.user?.officeId || null,
    };
  }

  const [accessToken, refreshToken, tokenExpiresAt, tenantId, officeId] = await Promise.all([
    sessionStorageBridge.get('accessToken'),
    sessionStorageBridge.get('refreshToken'),
    sessionStorageBridge.get('tokenExpiresAt'),
    sessionStorageBridge.get('tenantId'),
    sessionStorageBridge.get('officeId'),
  ]);

  return { accessToken, refreshToken, tokenExpiresAt, tenantId, officeId };
}

export async function getPublicAuthSession(): Promise<PublicAuthSession> {
  if (isElectron()) {
    return getElectronPublicSession();
  }

  const snapshot = await getAuthSnapshot();
  if (!snapshot.accessToken) {
    return { status: 'anonymous', user: null, tenantCode: sessionStorageBridge.getSync('savedTenantCode') || '' };
  }

  const me = await api.get<AuthUser>('/api/v1/auth/me');
  return {
    status: 'authenticated',
    user: me.data,
    tenantCode: (await sessionStorageBridge.get('savedTenantCode')) || '',
    tokenExpiresAt: snapshot.tokenExpiresAt ? Number(snapshot.tokenExpiresAt) : null,
  };
}

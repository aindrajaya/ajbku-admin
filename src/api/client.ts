import axios from 'axios';

const BASE_URL_KEY = 'ajbku_api_base_url';

export function getApiBaseUrl(): string {
  const saved = localStorage.getItem(BASE_URL_KEY);
  if (saved === 'http://localhost:3000') {
    return 'http://127.0.0.1:3000';
  }
  return saved || 'http://127.0.0.1:3000';
}

export function setApiBaseUrl(url: string) {
  localStorage.setItem(BASE_URL_KEY, url);
}

// ============================================================
// TOKEN MANAGER
// In-memory cache so that the Axios interceptor always has a
// synchronous-readable token without making an async IPC call.
//
// Storage strategy:
//   Electron  → IPC only (main process JSON file, never sessionStorage)
//   Browser   → sessionStorage fallback (for plain Vite dev server)
//
// Electron PERSISTS sessionStorage across restarts (leveldb in userData).
// Reading stale tokens from there causes 401s on every cold start.
// Therefore: in Electron, sessionStorage is never touched.
// ============================================================
const _memCache: Record<string, string> = {};

const AUTH_KEYS = ['accessToken', 'refreshToken', 'tokenExpiresAt', 'isFullyAuthenticated', 'tenantId'];

const tokenManager = {
  /** Return true if we are running inside Electron */
  isElectron(): boolean {
    return typeof window !== 'undefined' && typeof window.electronAPI !== 'undefined';
  },

  /** Read a token: memory → Electron IPC | memory → sessionStorage (browser only) */
  async get(key: string): Promise<string | null> {
    if (_memCache[key]) return _memCache[key];

    if (this.isElectron()) {
      // Electron: ONLY use IPC — never fall through to sessionStorage
      const val = await window.electronAPI.getStoredToken(key);
      if (val) {
        _memCache[key] = val;
        return val;
      }
      return null;
    }

    // Browser dev fallback only
    const ss = sessionStorage.getItem(`ajbku_${key}`);
    if (ss) {
      _memCache[key] = ss;
      return ss;
    }

    return null;
  },

  /** Write a token to memory + Electron IPC (or sessionStorage in browser) */
  async set(key: string, value: string): Promise<void> {
    _memCache[key] = value;

    if (this.isElectron()) {
      await window.electronAPI.storeToken(key, value);
    } else {
      sessionStorage.setItem(`ajbku_${key}`, value);
    }
  },

  /** Synchronous write: memory + sessionStorage (browser only) */
  setSync(key: string, value: string): void {
    _memCache[key] = value;
    if (!this.isElectron()) {
      sessionStorage.setItem(`ajbku_${key}`, value);
    }
  },

  /** Clear all auth tokens from every layer */
  async clearAll(): Promise<void> {
    AUTH_KEYS.forEach(k => {
      delete _memCache[k];
    });

    if (this.isElectron()) {
      await window.electronAPI.clearTokens();
    } else {
      AUTH_KEYS.forEach(k => sessionStorage.removeItem(`ajbku_${k}`));
    }
  },

  /** Synchronously read from memory only — safe for Axios interceptors */
  getSync(key: string): string | null {
    if (_memCache[key]) return _memCache[key];
    // In Electron, memory cache is the only sync layer (sessionStorage is not reliable)
    if (this.isElectron()) return null;
    return sessionStorage.getItem(`ajbku_${key}`) ?? null;
  },
};

export { tokenManager };


// ============================================================
// AXIOS INSTANCE
// ============================================================
const axiosInstance = axios.create({
  headers: { 'Content-Type': 'application/json' },
});

// REQUEST INTERCEPTOR — inject Bearer token
// Uses async tokenManager.get() so it always reads from Electron IPC
// when the in-memory cache is empty (e.g. after Vite HMR module reload).
// Axios fully supports async request interceptors.
axiosInstance.interceptors.request.use(
  async (config) => {
    config.baseURL = getApiBaseUrl();

    const token = await tokenManager.get('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.debug(`[AJBku] ✅ ${config.method?.toUpperCase()} ${config.url} → token OK (${token.slice(0, 20)}...)`);
    } else {
      console.warn(`[AJBku] ⚠️  ${config.method?.toUpperCase()} ${config.url} → NO TOKEN`);
    }

    return config;
  },
  (error) => Promise.reject(error)
);


// ============================================================
// AUTO REFRESH – singleton to prevent race conditions
// ============================================================
let refreshPromise: Promise<string | null> | null = null;

async function refreshAuthToken(): Promise<string | null> {
  const refreshToken = await tokenManager.get('refreshToken');
  if (!refreshToken) return null;

  try {
    const baseUrl = getApiBaseUrl();
    const response = await axios.post(`${baseUrl}/api/v1/auth/refresh`, { refreshToken });
    const { accessToken: newAccess, refreshToken: newRefresh } = response.data;

    tokenManager.setSync('accessToken', newAccess);
    await tokenManager.set('accessToken', newAccess);
    await tokenManager.set('refreshToken', newRefresh);
    await tokenManager.set('tokenExpiresAt', String(Date.now() + 15 * 60 * 1000));

    return newAccess;
  } catch (error) {
    console.error('[AJBku] Token refresh failed:', error);
    await tokenManager.clearAll();
    return null;
  }
}

// RESPONSE INTERCEPTOR — retry once with fresh token on 401
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      if (!refreshPromise) {
        refreshPromise = refreshAuthToken().finally(() => {
          refreshPromise = null;
        });
      }

      const newAccessToken = await refreshPromise;
      if (newAccessToken) {
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return axiosInstance(originalRequest);
      } else {
        window.dispatchEvent(new Event('ajbku-logout'));
      }
    }

    return Promise.reject(error);
  }
);

// ============================================================
// CAMELIZE TRANSFORM
// Backend MatterResponseDto (and some other DTOs) returns snake_case keys
// (e.g. workflow_status, land_city_code, matter_number).  This transformer
// converts every response recursively to camelCase so UI code can use a
// single consistent naming convention.  Already-camelCase keys are idempotent.
// ============================================================
function camelize(str: string): string {
  return str.replace(/_([a-z0-9])/g, (_, ch) => ch.toUpperCase());
}

function camelizeKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(camelizeKeys);
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [
        camelize(k),
        camelizeKeys(v),
      ])
    );
  }
  return obj;
}

function unwrapResponse<T>(response: any): { data: T } {
  const raw = response.data;
  // Envelope pattern: { data: <payload>, error: null }
  let payload: unknown;
  if (raw && typeof raw === 'object' && 'data' in raw && 'error' in raw) {
    payload = raw.data;
  } else {
    payload = raw;
  }
  return { data: camelizeKeys(payload) as T };
}

// ============================================================
// API CLIENT
// ============================================================
export const api = {
  get: async <T = any>(url: string, params?: any): Promise<{ data: T }> => {
    const response = await axiosInstance.get<any>(url, { params });
    return unwrapResponse<T>(response);
  },

  post: async <T = any>(url: string, body?: any): Promise<{ data: T }> => {
    const response = await axiosInstance.post<any>(url, body);
    return unwrapResponse<T>(response);
  },

  patch: async <T = any>(url: string, body?: any): Promise<{ data: T }> => {
    const response = await axiosInstance.patch<any>(url, body);
    return unwrapResponse<T>(response);
  },

  put: async <T = any>(url: string, body?: any): Promise<{ data: T }> => {
    const response = await axiosInstance.put<any>(url, body);
    return unwrapResponse<T>(response);
  },

  delete: async <T = any>(url: string): Promise<{ data: T }> => {
    const response = await axiosInstance.delete<any>(url);
    return unwrapResponse<T>(response);
  },
};

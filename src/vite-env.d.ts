/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface SaveDialogOptions {
  defaultFilename: string;
  filters: Array<{ name: string; extensions: string[] }>;
  buffer: ArrayBuffer | Uint8Array | number[] | string;
}

interface UpdaterState {
  status: 'idle' | 'checking' | 'downloading' | 'downloaded' | 'error' | 'dev-mode';
  message: string | null;
  version?: string;
  nextVersion?: string;
  progress?: number;
}

interface ElectronPublicSession {
  status: 'anonymous' | 'authenticated';
  user: {
    id: string;
    email: string;
    fullName: string;
    roles: string[];
    tenantId: string;
    officeId?: string | null;
    profileId?: string | null;
  } | null;
  tenantCode: string;
  tokenExpiresAt?: number | null;
}

interface Window {
  electronAPI: {
    session: {
      get: (key: string) => Promise<string | null>;
      set: (key: string, value: string) => Promise<boolean>;
      clear: () => Promise<boolean>;
    };
    dialog: {
      saveFile: (opts: SaveDialogOptions) => Promise<{ success: boolean; filePath?: string; error?: string }>;
    };
    documents: {
      fetchBinary: (url: string) => Promise<{ success: boolean; buffer?: ArrayBuffer; contentType?: string; error?: string }>;
      print: (opts: { buffer: ArrayBuffer; mimeType: string; fileName: string }) => Promise<{ success: boolean; error?: string }>;
    };
    shell: {
      openExternal: (url: string) => Promise<void>;
      openPath: (targetPath: string) => Promise<{ success: boolean; error?: string | null }>;
    };
    app: {
      getMeta: () => Promise<{ version: string; isPackaged: boolean; updater: UpdaterState }>;
      checkForUpdates: () => Promise<UpdaterState>;
      restartToUpdate: () => Promise<boolean>;
      onUpdaterState: (listener: (payload: UpdaterState) => void) => () => void;
    };
    auth: {
      startLogin: (payload: { tenantCode: string; email: string; password: string; baseUrl: string }) => Promise<any>;
      verifyTotp: (payload: { otp: string; baseUrl: string }) => Promise<any>;
      getSession: (payload: { baseUrl: string }) => Promise<ElectronPublicSession>;
      refreshSession: (payload: { baseUrl: string }) => Promise<ElectronPublicSession>;
      getRealtimeToken: (payload: { baseUrl: string }) => Promise<string | null>;
      logout: (payload: { baseUrl: string }) => Promise<boolean>;
      onLogout: (listener: () => void) => () => void;
      onSessionChanged: (listener: () => void) => () => void;
    };
    http: {
      request: (payload: {
        method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
        url: string;
        params?: Record<string, unknown>;
        body?: unknown;
        baseUrl: string;
      }) => Promise<{ ok: boolean; status: number; data: unknown; error?: string | null }>;
    };
  };
}

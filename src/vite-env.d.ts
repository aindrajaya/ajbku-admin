/// <reference types="vite/client" />

interface Window {
  electronAPI: {
    storeToken: (key: string, value: string) => Promise<boolean>;
    getStoredToken: (key: string) => Promise<string | null>;
    clearTokens: () => Promise<boolean>;
  };
}

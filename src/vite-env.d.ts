/// <reference types="vite/client" />

interface Window {
  electronAPI: {
    storeToken: (key: string, value: string) => Promise<boolean>;
    getStoredToken: (key: string) => Promise<string | null>;
    clearTokens: () => Promise<boolean>;
    exportFile: (opts: {
      defaultFilename: string;
      filters: Array<{ name: string; extensions: string[] }>;
      buffer: ArrayBuffer | Uint8Array | number[] | string;
    }) => Promise<{ success: boolean; filePath?: string; error?: string }>;
  };
}

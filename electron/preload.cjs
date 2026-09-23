const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  session: {
    get: (key) => ipcRenderer.invoke('session:get', key),
    set: (key, value) => ipcRenderer.invoke('session:set', { key, value }),
    clear: () => ipcRenderer.invoke('session:clear'),
  },
  auth: {
    startLogin: (payload) => ipcRenderer.invoke('auth:start-login', payload),
    verifyTotp: (payload) => ipcRenderer.invoke('auth:verify-totp', payload),
    getSession: (payload) => ipcRenderer.invoke('auth:get-session', payload),
    refreshSession: (payload) => ipcRenderer.invoke('auth:refresh-session', payload),
    getRealtimeToken: (payload) => ipcRenderer.invoke('auth:get-realtime-token', payload),
    logout: (payload) => ipcRenderer.invoke('auth:logout', payload),
    onLogout: (listener) => {
      const wrapped = () => listener();
      ipcRenderer.on('auth:logout', wrapped);
      return () => ipcRenderer.removeListener('auth:logout', wrapped);
    },
    onSessionChanged: (listener) => {
      const wrapped = () => listener();
      ipcRenderer.on('auth:session-changed', wrapped);
      return () => ipcRenderer.removeListener('auth:session-changed', wrapped);
    },
  },
  http: {
    request: (payload) => ipcRenderer.invoke('http:request', payload),
  },
  app: {
    getMeta: () => ipcRenderer.invoke('app:get-meta'),
    checkForUpdates: () => ipcRenderer.invoke('app:check-updates'),
    restartToUpdate: () => ipcRenderer.invoke('app:restart-to-update'),
    onUpdaterState: (listener) => {
      const wrapped = (_, payload) => listener(payload);
      ipcRenderer.on('updater:state', wrapped);
      return () => ipcRenderer.removeListener('updater:state', wrapped);
    },
  },
  shell: {
    openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),
    openPath: (targetPath) => ipcRenderer.invoke('shell:open-path', targetPath),
  },
  dialog: {
    saveFile: (opts) => ipcRenderer.invoke('dialog:save-file', opts),
  },
  documents: {
    fetchBinary: (url) => ipcRenderer.invoke('documents:fetch-binary', url),
    print: (opts) => ipcRenderer.invoke('documents:print', opts),
  },
});

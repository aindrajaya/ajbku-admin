const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Token management via electron-store equivalent in main process
  storeToken: (key, value) =>
    ipcRenderer.invoke('store:set', { key, value }),
  getStoredToken: (key) =>
    ipcRenderer.invoke('store:get', key),
  clearTokens: () =>
    ipcRenderer.invoke('store:clearTokens'),
  exportFile: (opts) =>
    ipcRenderer.invoke('export:file', opts),
});

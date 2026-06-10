const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

// Secure token storage matching electron-store interface
const storeFilePath = path.join(app.getPath('userData'), 'ajbku_store.json');

function readStore() {
  try {
    if (fs.existsSync(storeFilePath)) {
      const content = fs.readFileSync(storeFilePath, 'utf8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.error('Failed to read auth store:', error);
  }
  return {};
}

function writeStore(data) {
  try {
    fs.writeFileSync(storeFilePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error('Failed to write auth store:', error);
  }
}

// IPC Handlers matching PRD v1.1
ipcMain.handle('store:set', (event, { key, value }) => {
  const store = readStore();
  store[key] = value;
  writeStore(store);
  return true;
});

ipcMain.handle('store:get', (event, key) => {
  const store = readStore();
  return store[key] || null;
});

ipcMain.handle('store:clearTokens', () => {
  const store = readStore();
  // Clear only security tokens
  delete store.accessToken;
  delete store.refreshToken;
  delete store.tokenExpiresAt;
  delete store.isFullyAuthenticated;
  writeStore(store);
  return true;
});

ipcMain.handle('export:file', async (event, opts) => {
  const { filePath, canceled } = await dialog.showSaveDialog({
    defaultPath: opts.defaultFilename,
    filters: opts.filters,
  });

  if (canceled || !filePath) return { success: false };

  try {
    fs.writeFileSync(filePath, Buffer.from(opts.buffer));
    return { success: true, filePath };
  } catch (error) {
    console.error('Failed to write file:', error);
    return { success: false, error: error.message };
  }
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'AJBku.id - Platform Operasional Notaris & PPAT',
    backgroundColor: '#0b0f19',
  });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

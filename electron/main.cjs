const { app, BrowserWindow, ipcMain, dialog, shell, session, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store').default;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const APP_RUNTIME_NAME = isDev ? 'AJBku Admin Dev' : 'AJBku Admin';
const DEV_SERVER_URL = 'http://localhost:5175';
const API_BASE_URL = 'https://api.ajbku.id';
const DEV_SERVER_ORIGINS = `${DEV_SERVER_URL} http://127.0.0.1:5175`;

function logAuthDiagnostic(event, details = {}) {
  console.info(`[auth] ${event}`, details);
}

function ensureDirectory(targetPath) {
  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true });
  }
}

function configureAppStoragePaths() {
  const appDataRoot = app.getPath('appData');
  const localDataRoot = process.env.LOCALAPPDATA || app.getPath('temp');
  const userDataPath = path.join(appDataRoot, APP_RUNTIME_NAME);
  const sessionDataPath = path.join(localDataRoot, APP_RUNTIME_NAME, 'SessionData');

  ensureDirectory(userDataPath);
  ensureDirectory(sessionDataPath);

  app.setPath('userData', userDataPath);
  app.setPath('sessionData', sessionDataPath);
  app.setName(APP_RUNTIME_NAME);
}

configureAppStoragePaths();

const storeFilePath = path.join(app.getPath('userData'), 'ajbku-admin-store.json');

function createStore() {
  const options = {
    name: 'ajbku-admin-store',
    projectName: 'ajbku-dashboard',
    cwd: app.getPath('userData'),
    defaults: {
      prefs: {},
    },
  };

  try {
    return new Store(options);
  } catch (error) {
    if (!(error instanceof SyntaxError)) {
      throw error;
    }

    if (fs.existsSync(storeFilePath)) {
      const backupPath = `${storeFilePath}.corrupt-${Date.now()}`;

      try {
        fs.renameSync(storeFilePath, backupPath);
        console.warn(
          `Corrupted electron-store moved to: ${backupPath}`,
        );
      } catch (backupError) {
        console.warn(
          'Failed to back up corrupted store:',
          backupError,
        );

        fs.unlinkSync(storeFilePath);
      }
    }

    return new Store(options);
  }
}

const store = createStore();

const secureSessionPath = path.join(app.getPath('userData'), 'secure-session.bin');

let mainWindow = null;
let updaterState = {
  status: 'idle',
  message: null,
  version: app.getVersion(),
};
let autoUpdater = null;
let authSession = null;
let pendingAuthChallenge = null;

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

function getAutoUpdater() {
  if (isDev) {
    return null;
  }
  if (!autoUpdater) {
    autoUpdater = require('electron-updater').autoUpdater;
  }
  return autoUpdater;
}

function buildApiUrl(baseUrl, requestPath, params) {
  const rawPath = String(requestPath || '').trim();

  if (!rawPath) {
    throw new Error('API request path is required.');
  }

  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
  const allowedOrigin = new URL(normalizedBaseUrl).origin;

  const target = /^https?:\/\//i.test(rawPath)
    ? new URL(rawPath)
    : new URL(
        rawPath.replace(/^\/+/, ''),
        `${normalizedBaseUrl}/`,
      );

  if (target.origin !== allowedOrigin) {
    throw new Error(
      `External API origin is not allowed: ${target.origin}`,
    );
  }

  if (params && typeof params === 'object') {
    Object.entries(params).forEach(([key, value]) => {
      if (
        value === undefined ||
        value === null ||
        value === ''
      ) {
        return;
      }

      target.searchParams.set(key, String(value));
    });
  }

  return target.toString();
}

function unwrapApiPayload(raw) {
  if (
    raw &&
    typeof raw === 'object' &&
    Object.prototype.hasOwnProperty.call(raw, 'data') &&
    Object.prototype.hasOwnProperty.call(raw, 'error')
  ) {
    return raw.data;
  }

  return raw;
}

function extractApiErrorMessage(raw, fallbackMessage) {
  const payload = unwrapApiPayload(raw);

  if (payload && typeof payload === 'object' && payload.message) {
    return String(payload.message);
  }

  if (raw && typeof raw === 'object' && raw.error) {
    if (typeof raw.error === 'string') {
      return raw.error;
    }

    if (typeof raw.error === 'object' && raw.error.message) {
      return String(raw.error.message);
    }
  }

  return fallbackMessage;
}

function hasResponseBody(raw) {
  if (raw === null || raw === undefined) {
    return false;
  }

  if (typeof raw === 'string') {
    return raw.trim().length > 0;
  }

  return true;
}

function isSerializableUser(user) {
  return !!(
    user &&
    typeof user === 'object' &&
    typeof user.id === 'string' &&
    typeof user.email === 'string'
  );
}

function sanitizeStoredSession(sessionValue) {
  if (
    !sessionValue ||
    typeof sessionValue !== 'object' ||
    typeof sessionValue.accessToken !== 'string' ||
    !isSerializableUser(sessionValue.user)
  ) {
    return null;
  }

  return {
    accessToken: sessionValue.accessToken,
    refreshToken: typeof sessionValue.refreshToken === 'string' ? sessionValue.refreshToken : null,
    tenantCode: typeof sessionValue.tenantCode === 'string' ? sessionValue.tenantCode : '',
    apiBaseUrl: typeof sessionValue.apiBaseUrl === 'string' ? sessionValue.apiBaseUrl : API_BASE_URL,
    user: sessionValue.user,
    tokenExpiresAt:
      typeof sessionValue.tokenExpiresAt === 'number' && Number.isFinite(sessionValue.tokenExpiresAt)
        ? sessionValue.tokenExpiresAt
        : null,
  };
}

function readSecureSession() {
  try {
    if (!fs.existsSync(secureSessionPath)) {
      return null;
    }

    const raw = fs.readFileSync(secureSessionPath);
    if (!raw.length) {
      return null;
    }

    const decrypted = safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(raw) : raw.toString('utf8');
    return JSON.parse(decrypted);
  } catch (error) {
    console.warn('Failed to read secure session', error);
    return null;
  }
}

function writeSecureSession(nextSession) {
  try {
    if (!nextSession) {
      if (fs.existsSync(secureSessionPath)) {
        fs.unlinkSync(secureSessionPath);
      }
      return;
    }

    const serialized = JSON.stringify(nextSession);
    const payload = safeStorage.isEncryptionAvailable()
      ? safeStorage.encryptString(serialized)
      : Buffer.from(serialized, 'utf8');
    fs.writeFileSync(secureSessionPath, payload);
  } catch (error) {
    console.warn('Failed to write secure session', error);
  }
}

function setAuthSession(nextSession) {
  authSession = nextSession;
  writeSecureSession(nextSession);
}

function clearAuthSession() {
  authSession = null;
  pendingAuthChallenge = null;
  writeSecureSession(null);
}

function getPublicSession() {
  if (!authSession?.accessToken || !authSession?.user) {
    return {
      status: 'anonymous',
      user: null,
      tenantCode: store.get('prefs.savedTenantCode') || '',
      tokenExpiresAt: null,
    };
  }

  return {
    status: 'authenticated',
    user: authSession.user,
    tenantCode: authSession.tenantCode || '',
    tokenExpiresAt: authSession.tokenExpiresAt || null,
  };
}

function notifyRendererLogout() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('auth:logout');
  }
}

async function rawJsonFetch(targetUrl, options = {}) {
  const response = await fetch(targetUrl, options);
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : await response.text();
  return { response, data };
}

async function refreshAuthSession(baseUrl) {
  if (!authSession?.refreshToken) {
    logAuthDiagnostic('refresh-skipped', {
      reason: 'missing-refresh-token',
    });
    clearAuthSession();
    return null;
  }

  try {
    const requestUrl = `${baseUrl}/api/v1/auth/refresh`;
    const { response, data } = await rawJsonFetch(requestUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: authSession.refreshToken }),
    });
    const payload = unwrapApiPayload(data);

    logAuthDiagnostic('refresh-response', {
      url: requestUrl,
      method: 'POST',
      status: response.status,
      hasBody: hasResponseBody(data),
      accessTokenReturned: typeof payload?.accessToken === 'string',
    });

    if (!response.ok) {
      throw new Error(extractApiErrorMessage(data, `Refresh failed with status ${response.status}.`));
    }

    if (typeof payload?.accessToken !== 'string') {
      throw new Error('Refresh response did not include an access token.');
    }

    authSession = {
      ...authSession,
      accessToken: payload.accessToken,
      refreshToken: typeof payload.refreshToken === 'string' ? payload.refreshToken : authSession.refreshToken,
      tokenExpiresAt: Date.now() + (((payload.expiresIn) || 15 * 60) * 1000),
      apiBaseUrl: baseUrl,
    };
    writeSecureSession(authSession);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('auth:session-changed');
    }
    logAuthDiagnostic('refresh-stored', {
      tokenStored: typeof authSession.accessToken === 'string',
      tokenReadBack: !!sanitizeStoredSession(readSecureSession())?.accessToken,
    });
    return authSession;
  } catch (error) {
    logAuthDiagnostic('refresh-failed', {
      message: error instanceof Error ? error.message : String(error),
    });
    clearAuthSession();
    notifyRendererLogout();
    return null;
  }
}

async function ensureFreshAuthSession(baseUrl) {
  if (!authSession) {
    return null;
  }

  if (!authSession.tokenExpiresAt || Date.now() < authSession.tokenExpiresAt - 30_000) {
    return authSession;
  }

  return refreshAuthSession(baseUrl || authSession.apiBaseUrl);
}

async function performAuthorizedApiRequest({ method, url, params, body, retrying }) {
  const resolvedBaseUrl = API_BASE_URL;
  if (!resolvedBaseUrl) {
    return { ok: false, status: 401, error: 'API base URL is missing.', data: null };
  }

  await ensureFreshAuthSession(resolvedBaseUrl);
  const headers = { 'Content-Type': 'application/json' };
  if (authSession?.accessToken) {
    headers.Authorization = `Bearer ${authSession.accessToken}`;
  }

  const targetUrl = buildApiUrl(resolvedBaseUrl, url, params);
  const { response, data } = await rawJsonFetch(targetUrl, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (response.status === 401 && authSession?.refreshToken && !retrying) {
    const refreshed = await refreshAuthSession(resolvedBaseUrl);
    if (refreshed) {
      return performAuthorizedApiRequest({ method, url, params, body, retrying: true });
    }
  }

  if (response.status === 401) {
    clearAuthSession();
    notifyRendererLogout();
  }

  return {
    ok: response.ok,
    status: response.status,
    data,
    error: response.ok
      ? null
      : extractApiErrorMessage(data, `Request failed with status ${response.status}.`),
  };
}

function publishUpdaterState(nextState) {
  updaterState = { ...updaterState, ...nextState };
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('updater:state', updaterState);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 1000,
    minHeight: 700,
    show: false,
    title: 'AJBku.id - Platform Operasional Notaris & PPAT',
    backgroundColor: '#0b0f19',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const current = new URL(mainWindow.webContents.getURL());
    const next = new URL(url);
    if (current.origin !== next.origin) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (isDev) {
    mainWindow.loadURL(DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function setupSecurityHeaders() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const csp = isDev
      ? `default-src 'self' ${DEV_SERVER_ORIGINS}; ` +
        `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${DEV_SERVER_ORIGINS}; ` +
        `style-src 'self' 'unsafe-inline' ${DEV_SERVER_ORIGINS} https://fonts.googleapis.com; ` +
        "font-src 'self' data: https://fonts.gstatic.com; " +
        `img-src 'self' data: blob: ${DEV_SERVER_ORIGINS} https:; ` +
        "connect-src 'self' http://127.0.0.1:3000 http://localhost:3000 http://localhost:5175 http://127.0.0.1:5175 ws://localhost:5175 ws://127.0.0.1:5175 https: ws: wss:; " +
        `frame-src 'self' blob: ${DEV_SERVER_ORIGINS} https:; ` +
        "object-src 'none'; base-uri 'self'; form-action 'self';"
      : "default-src 'self'; " +
        "script-src 'self'; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "font-src 'self' data: https://fonts.gstatic.com; " +
        "img-src 'self' data: blob: https:; " +
        "connect-src 'self' https://api.ajbku.id https://storage.ajbku.id wss:; " +
        "frame-src 'self' blob: https:; " +
        "object-src 'none'; base-uri 'self'; form-action 'self';";

    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
      },
    });
  });
}

function setupIpcHandlers() {
  ipcMain.handle('session:get', (_, key) => store.get(`prefs.${key}`) ?? null);
  ipcMain.handle('session:set', (_, { key, value }) => {
    store.set(`prefs.${key}`, value);
    return true;
  });
  ipcMain.handle('session:clear', () => {
    store.delete('prefs');
    return true;
  });

  ipcMain.handle(
    'auth:start-login',
    async (_, { tenantCode, email, password }) => {
      try {
        const baseUrl = API_BASE_URL;
        const requestUrl = `${baseUrl}/api/v1/auth/login`;

        store.set(
          'prefs.savedTenantCode',
          tenantCode,
        );

        const { response, data } = await rawJsonFetch(
          requestUrl,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              tenantCode,
              email,
              password,
            }),
          },
        );
        const payload = unwrapApiPayload(data);

        logAuthDiagnostic('login-response', {
          url: requestUrl,
          method: 'POST',
          status: response.status,
          hasBody: hasResponseBody(data),
          accessTokenReturned: typeof payload?.accessToken === 'string',
          userReturned: isSerializableUser(payload?.user),
          needsTotp: payload?.needsTotp === true,
          apiError: response.ok ? null : extractApiErrorMessage(data, 'Login gagal.'),
        });

        if (!response.ok) {
          return {
            ok: false,
            status: response.status,
            error: extractApiErrorMessage(data, 'Login gagal.'),
          };
        }

        if (payload?.needsTotp) {
          pendingAuthChallenge = {
            accessToken: payload.accessToken,
            refreshToken: payload.refreshToken,
            tenantCode,
            user: payload.user,
            apiBaseUrl: baseUrl,
          };

          return {
            ok: true,
            status: 'totp_required',
            user: payload.user,
            tenantCode,
          };
        }

        if (typeof payload?.accessToken !== 'string' || !isSerializableUser(payload?.user)) {
          logAuthDiagnostic('login-invalid-payload', {
            url: requestUrl,
            method: 'POST',
            status: response.status,
            accessTokenReturned: typeof payload?.accessToken === 'string',
            userReturned: isSerializableUser(payload?.user),
          });
          return {
            ok: false,
            status: response.status,
            error: 'Respons login server tidak lengkap.',
          };
        }

        setAuthSession({
          accessToken: payload.accessToken,
          refreshToken: payload.refreshToken,
          tenantCode,
          apiBaseUrl: baseUrl,
          user: payload.user,
          tokenExpiresAt:
            Date.now() +
            (((payload.expiresIn) || 15 * 60) * 1000),
        });

        pendingAuthChallenge = null;
        const storedSession = sanitizeStoredSession(readSecureSession());

        logAuthDiagnostic('login-stored-session', {
          tokenStored: !!storedSession?.accessToken,
          tokenReadBack: !!storedSession?.accessToken,
          sessionRestorable: !!storedSession?.user,
        });

        return {
          ok: true,
          status: 'authenticated',
          session: getPublicSession(),
        };
      } catch (error) {
        logAuthDiagnostic('login-request-failed', {
          message: error instanceof Error ? error.message : String(error),
          code: error?.code || null,
          responseStatus: error?.response?.status || null,
          hasResponseBody: hasResponseBody(error?.response?.data),
        });

        return {
          ok: false,
          status: 0,
          error:
            'Tidak dapat terhubung ke server. Periksa koneksi internet atau status server.',
        };
      }
    },
  );

  ipcMain.handle('auth:verify-totp', async (_, { otp }) => {
    if (!pendingAuthChallenge) {
      logAuthDiagnostic('totp-missing-challenge', {
        reason: 'pending-challenge-missing',
      });
      return { ok: false, error: 'Pending auth challenge is missing.' };
    }

    const requestUrl = `${API_BASE_URL}/api/v1/auth/totp/verify`;
    const { response, data } = await rawJsonFetch(requestUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessToken: pendingAuthChallenge.accessToken,
        otp,
      }),
    });
    const payload = unwrapApiPayload(data);

    logAuthDiagnostic('totp-response', {
      url: requestUrl,
      method: 'POST',
      status: response.status,
      hasBody: hasResponseBody(data),
      verified: payload?.verified === true,
      accessTokenReturned: typeof payload?.accessToken === 'string',
      apiError: response.ok ? null : extractApiErrorMessage(data, 'Kode TOTP tidak valid.'),
    });

    if (!response.ok || !payload?.verified) {
      return {
        ok: false,
        status: response.status,
        error: extractApiErrorMessage(data, 'Kode TOTP tidak valid.'),
      };
    }

    setAuthSession({
      accessToken: payload.accessToken || pendingAuthChallenge.accessToken,
      refreshToken: payload.refreshToken || pendingAuthChallenge.refreshToken,
      tenantCode: pendingAuthChallenge.tenantCode,
      apiBaseUrl: API_BASE_URL,
      user: pendingAuthChallenge.user,
      tokenExpiresAt: Date.now() + (((payload.expiresIn) || 15 * 60) * 1000),
    });
    pendingAuthChallenge = null;
    const storedSession = sanitizeStoredSession(readSecureSession());
    logAuthDiagnostic('totp-stored-session', {
      tokenStored: !!storedSession?.accessToken,
      tokenReadBack: !!storedSession?.accessToken,
      sessionRestorable: !!storedSession?.user,
    });
    return {
      ok: true,
      session: getPublicSession(),
    };
  });

  ipcMain.handle('auth:get-session', async () => {
    if (authSession) {
      await ensureFreshAuthSession(API_BASE_URL);
    }
    const sessionState = getPublicSession();
    logAuthDiagnostic('session-restored', {
      status: sessionState.status,
      hasUser: !!sessionState.user,
      tenantCode: sessionState.tenantCode || '',
      completed: true,
    });
    return sessionState;
  });

  ipcMain.handle('auth:get-realtime-token', async () => {
    await ensureFreshAuthSession(API_BASE_URL);
    return authSession?.accessToken || null;
  });

  ipcMain.handle('auth:refresh-session', async () => {
    await refreshAuthSession(API_BASE_URL);
    return getPublicSession();
  });

  ipcMain.handle('auth:logout', async () => {
    if (authSession?.accessToken) {
      try {
        await rawJsonFetch(`${API_BASE_URL}/api/v1/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authSession.accessToken}`,
          },
        });
      } catch (error) {
        console.warn('Logout request failed', error);
      }
    }
    clearAuthSession();
    return true;
  });

  ipcMain.handle('http:request', async (_, payload) => performAuthorizedApiRequest(payload));

  ipcMain.handle('app:get-meta', () => ({
    version: app.getVersion(),
    isPackaged: app.isPackaged,
    updater: updaterState,
  }));

  ipcMain.handle('app:check-updates', async () => {
    const updater = getAutoUpdater();
    if (!updater) {
      publishUpdaterState({
        status: 'dev-mode',
        message: 'Auto-updater disabled during development.',
      });
      return updaterState;
    }

    publishUpdaterState({
      status: 'checking',
      message: 'Memeriksa pembaruan aplikasi...',
    });
    await updater.checkForUpdates();
    return updaterState;
  });

  ipcMain.handle('app:restart-to-update', () => {
    const updater = getAutoUpdater();
    if (!updater) {
      return false;
    }
    updater.quitAndInstall();
    return true;
  });

  ipcMain.handle('shell:open-external', (_, url) => shell.openExternal(url));

  ipcMain.handle('shell:open-path', async (_, targetPath) => {
    const result = await shell.openPath(targetPath);
    return { success: result === '', error: result || null };
  });

  ipcMain.handle('dialog:save-file', async (_, opts) => {
    const { filePath, canceled } = await dialog.showSaveDialog({
      defaultPath: opts.defaultFilename,
      filters: opts.filters,
    });

    if (canceled || !filePath) return { success: false };

    try {
      const rawBuffer = opts.buffer instanceof ArrayBuffer
        ? Buffer.from(new Uint8Array(opts.buffer))
        : Buffer.from(opts.buffer);
      fs.writeFileSync(filePath, rawBuffer);
      return { success: true, filePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('documents:fetch-binary', async (_, rawUrl) => {
    try {
      const parsedUrl = new URL(rawUrl);
      if (!['https:', 'http:'].includes(parsedUrl.protocol)) {
        throw new Error('Unsupported document URL protocol.');
      }

      const response = await fetch(parsedUrl.toString());
      if (!response.ok) {
        throw new Error(`Document fetch failed with status ${response.status}.`);
      }

      const bytes = await response.arrayBuffer();
      return {
        success: true,
        buffer: bytes,
        contentType: response.headers.get('content-type') || 'application/octet-stream',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  });
}

function setupAutoUpdater() {
  const updater = getAutoUpdater();
  if (!updater) {
    return;
  }

  updater.autoDownload = true;
  updater.on('checking-for-update', () => {
    publishUpdaterState({ status: 'checking', message: 'Memeriksa pembaruan...' });
  });
  updater.on('update-available', (info) => {
    publishUpdaterState({
      status: 'downloading',
      message: 'Mengunduh update...',
      nextVersion: info.version,
    });
  });
  updater.on('update-not-available', () => {
    publishUpdaterState({ status: 'idle', message: 'Aplikasi sudah versi terbaru.' });
  });
  updater.on('download-progress', (progress) => {
    publishUpdaterState({
      status: 'downloading',
      message: `Mengunduh update... ${Math.round(progress.percent)}%`,
      progress: progress.percent,
    });
  });
  updater.on('update-downloaded', (info) => {
    publishUpdaterState({
      status: 'downloaded',
      message: 'Update siap dipasang. Restart aplikasi untuk melanjutkan.',
      nextVersion: info.version,
    });
  });
  updater.on('error', (error) => {
    publishUpdaterState({
      status: 'error',
      message: error.message,
    });
  });
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(() => {
  const rawSavedSession = readSecureSession();
  const savedSession = sanitizeStoredSession(rawSavedSession);

  if (
    savedSession?.apiBaseUrl &&
    savedSession.apiBaseUrl !== API_BASE_URL
  ) {
    console.warn(
      'Removing session associated with old API URL:',
      savedSession.apiBaseUrl,
    );

    clearAuthSession();
  } else if (!savedSession && rawSavedSession) {
    logAuthDiagnostic('session-cleared', {
      reason: 'invalid-stored-session-shape',
    });
    clearAuthSession();
  } else {
    authSession = savedSession;
  }
  setupSecurityHeaders();
  setupIpcHandlers();
  setupAutoUpdater();
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

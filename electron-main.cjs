const { app, BrowserWindow, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

let mainWindow = null;
const SERVER_PORT = 3000;

// Set production environment
process.env.NODE_ENV = 'production';
process.env.PORT = String(SERVER_PORT);

// Safe user data directory for SQLite database & uploaded photos
const userDataDir = app.getPath('userData');
process.env.SCOUT_DATA_DIR = userDataDir;

// Ensure persistent folders exist in AppData
const photosDir = path.join(userDataDir, 'data', 'photos');
if (!fs.existsSync(photosDir)) {
  try {
    fs.mkdirSync(photosDir, { recursive: true });
  } catch (e) {
    console.error('Failed to create photos dir:', e);
  }
}

// Copy initial seed scout.db if not already in AppData
const targetDb = path.join(userDataDir, 'scout.db');
const possibleSeedDbs = [
  path.join(__dirname, 'scout.db'),
  path.join(__dirname, 'dist', 'scout.db'),
  path.join(process.resourcesPath || '', 'app', 'scout.db'),
];

for (const seedDb of possibleSeedDbs) {
  if (!fs.existsSync(targetDb) && fs.existsSync(seedDb)) {
    try {
      fs.copyFileSync(seedDb, targetDb);
      break;
    } catch (e) {
      console.error('Failed to copy initial database:', e);
    }
  }
}

// Start the embedded backend server
try {
  const possibleServerPaths = [
    path.join(__dirname, 'dist', 'server.cjs'),
    path.join(__dirname, 'server.cjs'),
    path.join(process.resourcesPath || '', 'app', 'dist', 'server.cjs'),
  ];

  let serverStarted = false;
  for (const sPath of possibleServerPaths) {
    if (fs.existsSync(sPath)) {
      require(sPath);
      serverStarted = true;
      console.log('Started server from:', sPath);
      break;
    }
  }

  if (!serverStarted) {
    console.warn('Server file not found in predefined paths, attempting dist/server.cjs require');
    require(path.join(__dirname, 'dist', 'server.cjs'));
  }
} catch (err) {
  console.error('Error starting backend server:', err);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    title: 'نظام إدارة الكشافة - مدرسة القديس يوسف بالعبور',
    autoHideMenuBar: true,
    show: false,
    backgroundColor: '#0f172a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const appUrl = `http://127.0.0.1:${SERVER_PORT}`;

  // Poll server health until fully ready
  let attempts = 0;
  const maxAttempts = 50; // 50 * 200ms = 10s max wait

  function checkServerReady() {
    attempts++;
    const req = http.get(`${appUrl}/api/health`, (res) => {
      if (res.statusCode === 200) {
        mainWindow.loadURL(appUrl);
        mainWindow.once('ready-to-show', () => {
          mainWindow.show();
        });
      } else if (attempts < maxAttempts) {
        setTimeout(checkServerReady, 200);
      } else {
        mainWindow.loadURL(appUrl);
        mainWindow.show();
      }
    });

    req.on('error', () => {
      if (attempts < maxAttempts) {
        setTimeout(checkServerReady, 200);
      } else {
        // Fallback: load anyway and show window
        mainWindow.loadURL(appUrl);
        mainWindow.show();
      }
    });

    req.setTimeout(500, () => {
      req.destroy();
    });
  }

  // Handle load failure with a friendly recovery screen
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.warn('Page load failed:', errorCode, errorDescription);
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL(appUrl);
      }
    }, 1500);
  });

  checkServerReady();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Ensure single running instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();

    // DevTools shortcut (F12) for troubleshooting
    globalShortcut.register('F12', () => {
      if (mainWindow) {
        mainWindow.webContents.toggleDevTools();
      }
    });

    // Refresh shortcut (F5 / Ctrl+R)
    globalShortcut.register('F5', () => {
      if (mainWindow) {
        mainWindow.reload();
      }
    });
  });
}

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

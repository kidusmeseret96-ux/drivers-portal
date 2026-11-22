const { app, BrowserWindow, Menu, protocol, shell } = require('electron');
const fs = require('fs');
const path = require('path');

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

let mainWindow = null;

function createWindow() {
  const iconPath = path.join(__dirname, 'build', 'icon.png');
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: 'Adama Heavy Truck Drivers Edir — RouteLedger',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    autoHideMenuBar: true,
    backgroundColor: '#0F172A',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.loadURL('app://routeledger/index.html');

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    if (process.platform === 'win32') {
      app.setAppUserModelId('com.adama.drivers.routeledger');
    }

    const distDir = path.resolve(__dirname, 'dist');
    const distRootWithSep = distDir.endsWith(path.sep) ? distDir : `${distDir}${path.sep}`;

    protocol.handle('app', async (request) => {
      try {
        const parsed = new URL(request.url);
        let relPath = decodeURIComponent(parsed.pathname || '/').replace(/^\/+/, '');
        if (!relPath) {
          relPath = 'index.html';
        }

        const resolvedPath = path.resolve(distDir, relPath);
        if (resolvedPath !== distDir && !resolvedPath.startsWith(distRootWithSep)) {
          return new Response('Forbidden', { status: 403 });
        }

        let targetFile = resolvedPath;
        const isExistingFile =
          fs.existsSync(targetFile) && fs.statSync(targetFile).isFile();

        if (!isExistingFile) {
          const ext = path.extname(relPath);
          if (!ext || ext === '.html') {
            targetFile = path.join(distDir, 'index.html');
          } else {
            return new Response('Not Found', { status: 404 });
          }
        }

        const ext = path.extname(targetFile).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        const data = await fs.promises.readFile(targetFile);
        return new Response(data, {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'no-cache',
          },
        });
      } catch (err) {
        console.error('Desktop protocol error:', err);
        return new Response('Internal Server Error', { status: 500 });
      }
    });

    Menu.setApplicationMenu(null);
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
}

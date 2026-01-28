const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const net = require('net');

let mainWindow;
let backendProcess;
let backendPort;

const isDev = !app.isPackaged;

async function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

async function startBackend() {
  backendPort = await findFreePort();
  
  let backendPath;
  if (isDev) {
    // En desarrollo, el backend se ejecuta por separado
    backendPort = 8000;
    console.log('Dev mode: expecting backend at http://127.0.0.1:8000');
    return;
  } else {
    // En producción, usar el backend empaquetado
    backendPath = path.join(process.resourcesPath, 'backend', 'main.exe');
  }
  
  console.log(`Starting backend at port ${backendPort}...`);
  
  backendProcess = spawn(backendPath, [], {
    env: {
      ...process.env,
      PORT: backendPort.toString(),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  
  backendProcess.stdout.on('data', (data) => {
    console.log(`Backend: ${data}`);
  });
  
  backendProcess.stderr.on('data', (data) => {
    console.error(`Backend error: ${data}`);
  });
  
  backendProcess.on('close', (code) => {
    console.log(`Backend process exited with code ${code}`);
  });
  
  // Esperar a que el backend esté listo
  await waitForBackend();
}

async function waitForBackend(maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`http://127.0.0.1:${backendPort}/health`);
      if (response.ok) {
        console.log('Backend is ready');
        return;
      }
    } catch (e) {
      // Backend not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('Backend failed to start');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: path.join(__dirname, '../public/icon.png'),
  });

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

app.whenReady().then(async () => {
  try {
    await startBackend();
    createWindow();
  } catch (error) {
    console.error('Failed to start:', error);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('before-quit', () => {
  if (backendProcess) {
    backendProcess.kill();
  }
});

// IPC handlers
ipcMain.handle('get-backend-url', () => {
  return `http://127.0.0.1:${backendPort}`;
});

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const net = require('net');

let mainWindow;
let backendProcess;
let backendPort;

const isDev = !app.isPackaged;
const isDebug = process.env.ELECTRON_DEBUG === '1';

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
    backendPath = path.join(process.resourcesPath, 'backend', 'main', 'main.exe');
  }
  
  // Verificar que el ejecutable existe
  const fs = require('fs');
  if (!fs.existsSync(backendPath)) {
    const msg = `Backend no encontrado en:\n${backendPath}\n\nContenido de resources:\n${fs.readdirSync(process.resourcesPath).join('\n')}`;
    console.error(msg);
    dialog.showErrorBox('Error de inicio', msg);
    throw new Error('Backend executable not found');
  }
  
  console.log(`Starting backend at port ${backendPort}...`);
  console.log(`Backend path: ${backendPath}`);
  
  let backendOutput = '';
  let backendError = '';
  
  backendProcess = spawn(backendPath, [], {
    env: {
      ...process.env,
      PORT: backendPort.toString(),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  
  backendProcess.stdout.on('data', (data) => {
    const str = data.toString();
    backendOutput += str;
    console.log(`Backend: ${str}`);
  });
  
  backendProcess.stderr.on('data', (data) => {
    const str = data.toString();
    backendError += str;
    console.error(`Backend error: ${str}`);
  });
  
  backendProcess.on('close', (code) => {
    console.log(`Backend process exited with code ${code}`);
    if (code !== 0 && code !== null) {
      dialog.showErrorBox('Backend crashed', `Exit code: ${code}\n\nOutput:\n${backendOutput.slice(-1000)}\n\nErrors:\n${backendError.slice(-1000)}`);
    }
  });
  
  // Esperar a que el backend esté listo
  await waitForBackend();
}

async function waitForBackend(maxAttempts = 30) {
  let lastError = '';
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`http://127.0.0.1:${backendPort}/health`);
      if (response.ok) {
        console.log('Backend is ready');
        return;
      }
    } catch (e) {
      lastError = e.message;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`Backend failed to start after ${maxAttempts} attempts.\nLast error: ${lastError}\nPort: ${backendPort}\nCheck if backend crashed - see backendOutput below.`);
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

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    const msg = `Fallo cargando la UI (did-fail-load)\n\n` +
      `URL: ${validatedURL}\n` +
      `Code: ${errorCode}\n` +
      `Desc: ${errorDescription}`;
    console.error(msg);
    dialog.showErrorBox('Error de UI', msg);
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    const msg = `El proceso de render ha fallado (render-process-gone)\n\n` +
      `Reason: ${details.reason}\n` +
      `Exit code: ${details.exitCode}`;
    console.error(msg);
    dialog.showErrorBox('Error de UI', msg);
  });

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    // level: 0=log,1=warn,2=error
    if (level >= 2) {
      const msg = `Error en UI (console-message)\n\n${message}\n\n${sourceId}:${line}`;
      console.error(msg);
      dialog.showErrorBox('Error de UI', msg);
    }
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    if (isDebug) {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
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
    dialog.showErrorBox('Error de inicio', `La aplicación no pudo arrancar:\n\n${error.message}`);
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

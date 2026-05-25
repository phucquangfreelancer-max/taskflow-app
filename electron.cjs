const { app, BrowserWindow, ipcMain, Tray, Menu } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

let mainWindow;
let serverProcess;
let tray;

function waitForServer(url, retries = 40, delay = 1000) {
  return new Promise((resolve, reject) => {
    const attempt = () => {
      http.get(url, () => resolve()).on('error', () => {
        if (retries-- > 0) setTimeout(attempt, delay);
        else reject(new Error('Server không khởi động được'));
      });
    };
    attempt();
  });
}

app.whenReady().then(async () => {
  serverProcess = spawn('cmd', ['/c', 'npm run dev'], {
    cwd: __dirname,
    env: { ...process.env },
    shell: false,
  });
  serverProcess.stdout.on('data', (d) => console.log('[server]', d.toString()));
  serverProcess.stderr.on('data', (d) => console.error('[server err]', d.toString()));

  const iconPath = path.join(__dirname, 'icon.png');

  mainWindow = new BrowserWindow({
    width: 420,
    height: 580,
    frame: false,
    icon: iconPath,
    transparent: true,            // GIỮ transparent để bo góc đẹp
    backgroundColor: '#00000000',
    autoHideMenuBar: true,
    resizable: false,
    roundedCorners: true,
    show: false,                  // FIX: ẩn trước, chỉ show khi ready
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // FIX: show cửa sổ ngay khi nội dung đầu tiên đã render xong
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on('closed', () => { mainWindow = null; });

  // Load loading screen
  mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8">
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      html { background: transparent; }
      body {
        background: #111113;
        border-radius: 20px;
        width: 100vw; height: 100vh;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        font-family: -apple-system, 'Segoe UI', sans-serif;
        -webkit-app-region: drag;
        user-select: none;
      }
      .logo {
        width: 56px; height: 56px;
        background: rgba(99,102,241,0.2);
        border: 1px solid rgba(99,102,241,0.3);
        border-radius: 16px;
        display: flex; align-items: center; justify-content: center;
        margin-bottom: 16px;
        font-size: 28px; color: #818cf8;
      }
      h1 { color: #fff; font-size: 20px; font-weight: 900; margin-bottom: 4px; }
      p  { color: #64748b; font-size: 12px; margin-bottom: 32px; }
      .spinner {
        width: 24px; height: 24px;
        border: 2px solid rgba(99,102,241,0.2);
        border-top-color: #6366f1;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin { to { transform: rotate(360deg); } }
    </style>
    </head>
    <body>
      <div class="logo">✓</div>
      <h1>TaskFlow</h1>
      <p>Đang khởi động...</p>
      <div class="spinner"></div>
    </body>
    </html>
  `));

  // Chờ server rồi chuyển sang app thật
  try {
    await waitForServer('http://localhost:3000');
  } catch (e) {
    console.error('[electron]', e.message);
  }

  mainWindow.loadURL('http://localhost:3000');

  // Tray
  try {
    tray = new Tray(iconPath);
    tray.setToolTip('TaskFlow');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Mở TaskFlow', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } },
      { type: 'separator' },
      { label: 'Thoát', click: () => app.quit() },
    ]));
    tray.on('click', () => {
      if (!mainWindow) return;
      if (mainWindow.isVisible()) { mainWindow.hide(); }
      else { mainWindow.show(); mainWindow.loadURL('http://localhost:3000'); mainWindow.focus(); }
    });
  } catch (e) {
    console.error('[tray]', e.message);
  }
});

ipcMain.on('set-ignore-mouse',       (e, ignore) => { if (mainWindow) mainWindow.setIgnoreMouseEvents(ignore, { forward: true }); });
ipcMain.on('resize-window',          (e, w, h)   => { if (mainWindow) { mainWindow.setResizable(true); mainWindow.setSize(w, h); mainWindow.setResizable(false); mainWindow.center(); } });
ipcMain.on('minimize-window',        ()          => { if (mainWindow) mainWindow.hide(); });
ipcMain.on('minimize-window-taskbar',()          => { if (mainWindow) mainWindow.minimize(); });
ipcMain.on('close-window',           ()          => { if (mainWindow) mainWindow.close(); });
ipcMain.on('toggle-autostart',       (e, on)     => { app.setLoginItemSettings({ openAtLogin: on, path: process.execPath }); });

app.on('window-all-closed', () => { if (serverProcess) serverProcess.kill(); app.quit(); });

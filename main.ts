import { app, BrowserWindow, ipcMain } from 'electron';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import Store from 'electron-store';
const store = new Store();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const store = new Store();

// IPC 핸들러 등록
ipcMain.handle('store-get', (_event, key: string) => {
   return store.get(key);
});

ipcMain.handle('store-set', (_event, key: string, value: unknown) => {
   store.set(key, value);
});

ipcMain.handle('store-delete', (_event, key: string) => {
   store.delete(key);
});

// ── 아래는 기존 BrowserWindow 생성 코드 유지 ──
const createWindow = () => {
   const win = new BrowserWindow({
      width: 600,
      height: 700,
      webPreferences: {
         preload: path.join(__dirname, 'preload.js'),
         contextIsolation: true,
         nodeIntegration: false,
      },
   });

   if (process.env.VITE_DEV_SERVER_URL) {
      win.loadURL(process.env.VITE_DEV_SERVER_URL);
   } else {
      win.loadFile(path.join(__dirname, '../dist/index.html'));
   }
};

app.whenReady().then(() => {
   createWindow();
   app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
   });
});

app.on('window-all-closed', () => {
   if (process.platform !== 'darwin') app.quit();
});

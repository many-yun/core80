import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import Store from 'electron-store';

const store = new Store<{ logs: any[] }>();

function createWindow() {
   const win = new BrowserWindow({
      width: 1000,
      height: 800,
      webPreferences: {
         preload: path.join(__dirname, 'preload.js'),
      },
   });

   win.loadURL('http://localhost:5173'); // dev
}

app.whenReady().then(createWindow);

/* ✅ 로그 불러오기 */
ipcMain.handle('get-logs', () => {
   return store.get('logs');
});

/* ✅ 로그 저장하기 */
ipcMain.handle('set-logs', (_, logs) => {
   store.set('logs', logs);
});

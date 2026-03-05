import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
   getLogs: () => ipcRenderer.invoke('get-logs'),
   setLogs: (logs) => ipcRenderer.invoke('set-logs', logs),
});

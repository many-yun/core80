import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronStore', {
   get: (key: string): Promise<unknown> => ipcRenderer.invoke('store-get', key),
   set: (key: string, value: unknown): Promise<void> => ipcRenderer.invoke('store-set', key, value),
   delete: (key: string): Promise<void> => ipcRenderer.invoke('store-delete', key),
});

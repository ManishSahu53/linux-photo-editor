const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    saveFile: (dataUrl, defaultFilename) => ipcRenderer.invoke('save-file', dataUrl, defaultFilename)
});

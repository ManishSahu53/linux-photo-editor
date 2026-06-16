const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    saveFile: (dataUrl, defaultFilename) => ipcRenderer.invoke('save-file', dataUrl, defaultFilename),
    getFileToOpen: () => ipcRenderer.invoke('get-file-to-open'),
    readImageFile: (filePath) => ipcRenderer.invoke('read-image-file', filePath),
    onOpenFile: (callback) => ipcRenderer.on('open-file', (event, filePath) => callback(filePath))
});

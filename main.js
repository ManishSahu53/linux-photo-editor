const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        title: "photo-editor-llinux",
        icon: path.join(__dirname, 'assets/app_icon.png'),
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    win.loadFile(path.join(__dirname, 'index.html'));
}

// IPC Save File Handler
ipcMain.handle('save-file', async (event, dataUrl, defaultFilename) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const { filePath, canceled } = await dialog.showSaveDialog(win, {
        title: 'Save Image',
        defaultPath: path.join(app.getPath('downloads'), defaultFilename),
        filters: [
            { name: 'PNG Images', extensions: ['png'] },
            { name: 'All Files', extensions: ['*'] }
        ]
    });

    if (canceled || !filePath) {
        return { success: false, reason: 'canceled' };
    }

    // Convert DataURL (base64) to binary buffer
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
    try {
        fs.writeFileSync(filePath, base64Data, 'base64');
        return { success: true, filePath };
    } catch (err) {
        return { success: false, reason: err.message };
    }
});

app.whenReady().then(() => {
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

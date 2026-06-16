const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');

let filePathArg = null;

// Handle command line arguments to open files
function parseArgs(args, workingDirectory) {
    const cleanArgs = args.filter(arg => !arg.startsWith('--') && arg !== '.' && !path.basename(arg).includes('electron'));
    const fileToOpen = cleanArgs.length > 1 ? cleanArgs[cleanArgs.length - 1] : null;
    if (fileToOpen) {
        const absolutePath = path.isAbsolute(fileToOpen) ? fileToOpen : path.resolve(workingDirectory || process.cwd(), fileToOpen);
        if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile()) {
            return absolutePath;
        }
    }
    return null;
}

filePathArg = parseArgs(process.argv, process.cwd());

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        const myWindow = BrowserWindow.getAllWindows()[0];
        if (myWindow) {
            if (myWindow.isMinimized()) myWindow.restore();
            myWindow.focus();
            
            const fileToOpen = parseArgs(commandLine, workingDirectory);
            if (fileToOpen) {
                myWindow.webContents.send('open-file', fileToOpen);
            }
        }
    });
}

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

// IPC handler for fetching the initial file to open
ipcMain.handle('get-file-to-open', () => {
    return filePathArg;
});

// IPC handler for reading local files securely
ipcMain.handle('read-image-file', async (event, filePath) => {
    try {
        const ext = path.extname(filePath).toLowerCase();
        let mime = 'image/png';
        if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg';
        else if (ext === '.webp') mime = 'image/webp';
        else if (ext === '.gif') mime = 'image/gif';
        else if (ext === '.svg') mime = 'image/svg+xml';
        
        const data = fs.readFileSync(filePath);
        return { success: true, dataUrl: `data:${mime};base64,${data.toString('base64')}`, filename: path.basename(filePath) };
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

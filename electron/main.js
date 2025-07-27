/**
 * TableTalk Electron Main Process
 * 
 * This file:
 * 1. Starts the TableTalk server in the background
 * 2. Opens a browser window to display the app
 * 3. Handles app lifecycle (quit when window closes)
 */

const { app, BrowserWindow, shell, dialog, Menu, clipboard } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const net = require('net');
const fs = require('fs');

// Production-ready startup - minimal logging
console.log(`[ELECTRON] TableTalk starting...`);

// Configuration
const CONFIG = {
    SERVER_PORT: 3001,
    WINDOW_WIDTH: 1200,
    WINDOW_HEIGHT: 800,
    DEV_MODE: process.argv.includes('--dev')
};

let mainWindow;
let currentPort;
let networkUrls = [];

/**
 * Check if a port is available
 * @param {number} port - Port number to check
 * @returns {Promise<boolean>} - True if port is available
 */
function isPortAvailable(port) {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.listen(port, () => {
            server.once('close', () => resolve(true));
            server.close();
        });
        server.on('error', () => resolve(false));
    });
}

/**
 * Find an available port starting from the default
 * @param {number} startPort - Port to start checking from
 * @returns {Promise<number>} - Available port number
 */
async function findAvailablePort(startPort = CONFIG.SERVER_PORT) {
    for (let port = startPort; port < startPort + 10; port++) {
        if (await isPortAvailable(port)) {
            return port;
        }
    }
    throw new Error('No available ports found');
}

/**
 * Start the TableTalk server in the main process
 * @param {number} port - Port to run the server on
 * @returns {Promise<boolean>} - Success status
 */
function startServerWithPath(port, serverInfo) {
    return new Promise((resolve, reject) => {
        console.log(`[ELECTRON] Starting TableTalk server on port ${port}...`);
        console.log(`[ELECTRON] Using server path: ${serverInfo.serverPath}`);
        console.log(`[ELECTRON] Working directory: ${serverInfo.workingDir}`);
        
        try {
            // Set environment variables for the server
            process.env.PORT = port.toString();
            process.env.ELECTRON_MODE = 'true';
            process.env.SERVER_WORKING_DIR = serverInfo.workingDir;
            
            // Set the client path for the server to use
            let clientPath;
            if (CONFIG.DEV_MODE) {
                clientPath = path.join(__dirname, '..', 'client', 'dist');
            } else {
                // In packaged mode, client files are in the dist/client directory
                clientPath = path.join(__dirname, 'dist', 'client');
            }
            process.env.ELECTRON_CLIENT_PATH = clientPath;
            console.log(`[ELECTRON] Setting client path: ${clientPath}`);
            
            // Verify client path exists and is accessible
            try {
                const clientStat = require('fs').statSync(clientPath);
                if (clientStat.isDirectory()) {
                    console.log(`[ELECTRON] ✅ Client path is a valid directory`);
                    // List some contents for debugging
                    const clientContents = require('fs').readdirSync(clientPath);
                    console.log(`[ELECTRON] Client directory contents: ${clientContents.slice(0, 5).join(', ')}${clientContents.length > 5 ? '...' : ''}`);
                } else {
                    console.log(`[ELECTRON] ⚠️ Client path exists but is not a directory`);
                }
            } catch (e) {
                console.log(`[ELECTRON] ❌ Client path not accessible: ${e.message}`);
                // Try alternative paths
                const altClientPath = path.join(__dirname, '..', 'dist', 'client');
                console.log(`[ELECTRON] Trying alternative client path: ${altClientPath}`);
                try {
                    const altStat = require('fs').statSync(altClientPath);
                    if (altStat.isDirectory()) {
                        process.env.ELECTRON_CLIENT_PATH = altClientPath;
                        console.log(`[ELECTRON] ✅ Using alternative client path`);
                    }
                } catch (e2) {
                    console.log(`[ELECTRON] ❌ Alternative client path also failed: ${e2.message}`);
                }
            }
            
            // Import and start the server in the same process
            console.log(`[ELECTRON] Requiring server module...`);
            
            // Add the server's node_modules to the module path
            const serverNodeModules = path.join(serverInfo.workingDir, 'node_modules');
            console.log(`[ELECTRON] Checking server node_modules at: ${serverNodeModules}`);
            
            try {
                const stat = require('fs').statSync(serverNodeModules);
                if (stat.isDirectory()) {
                    console.log(`[ELECTRON] ✅ Server node_modules is a valid directory`);
                    require('module')._nodeModulePaths.unshift(serverNodeModules);
                } else {
                    console.log(`[ELECTRON] ⚠️ Server node_modules exists but is not a directory`);
                }
            } catch (e) {
                console.log(`[ELECTRON] ⚠️ Server node_modules not accessible: ${e.message}`);
            }
            
            // Don't change working directory for asar files - just set environment
            console.log(`[ELECTRON] Setting up server environment without changing cwd`);
            console.log(`[ELECTRON] Server working dir (env only): ${serverInfo.workingDir}`);
            
            // Set up module resolution for the server
            const Module = require('module');
            const originalResolveFilename = Module._resolveFilename;
            
            // Override module resolution to help find server dependencies
            Module._resolveFilename = function(request, parent, isMain) {
                try {
                    return originalResolveFilename.call(this, request, parent, isMain);
                } catch (err) {
                    // If not found, try looking in the server's node_modules
                    if (serverNodeModules && require('fs').existsSync(serverNodeModules)) {
                        try {
                            const serverModulePath = path.join(serverNodeModules, request);
                            if (require('fs').existsSync(serverModulePath)) {
                                return serverModulePath;
                            }
                        } catch (e) {
                            // Continue to original error
                        }
                    }
                    throw err;
                }
            };
            
            try {
                require(serverInfo.serverPath);
                console.log(`[ELECTRON] Server loaded successfully`);
                
                // Give the server a moment to start
                setTimeout(() => {
                    // Restore original module resolution
                    Module._resolveFilename = originalResolveFilename;
                    console.log(`[ELECTRON] Server startup completed`);
                    resolve(true);
                }, 3000);
                
            } catch (requireError) {
                // Restore original module resolution on error
                Module._resolveFilename = originalResolveFilename;
                throw requireError;
            }
            
        } catch (error) {
            console.error(`[ELECTRON] Failed to start server:`, error);
            console.error(`[ELECTRON] Error stack:`, error.stack);
            reject(error);
        }
    });
}

/**
 * Create the main application window directly for debugging
 */
function createMainWindowDirect() {
    console.log(`[ELECTRON] Creating debug window...`);
    
    mainWindow = new BrowserWindow({
        width: CONFIG.WINDOW_WIDTH,
        height: CONFIG.WINDOW_HEIGHT,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, 'assets', 'icon.ico'),
        show: true,
        center: true,
        title: 'TableTalk - Debug Window'
    });
    
    // Load a simple HTML page instead of the server
    mainWindow.loadURL('data:text/html,<html><body><h1>TableTalk Debug Window</h1><p>If you can see this, the Electron window is working!</p></body></html>');
    
    mainWindow.webContents.openDevTools();
    
    mainWindow.on('closed', () => {
        mainWindow = null;
        console.log(`[ELECTRON] Main window closed`);
    });
}

/**
 * Create the main application window
 * @param {number} port - Port the server is running on
 */
function createMainWindow(port) {
    console.log(`[ELECTRON] Creating main window for port ${port}...`);
    
    mainWindow = new BrowserWindow({
        width: CONFIG.WINDOW_WIDTH,
        height: CONFIG.WINDOW_HEIGHT,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, 'assets', 'icon.ico'),
        show: false, // Don't show until ready
        center: true,
        resizable: true,
        minimizable: true,
        maximizable: true,
        titleBarStyle: 'default',
        title: 'TableTalk - TTRPG Chat',
        alwaysOnTop: false,
        skipTaskbar: false,
        // Add additional properties for Windows visibility
        x: undefined, // Let Electron choose position
        y: undefined,
        movable: true,
        closable: true,
        focusable: true,
        // Ensure window is not hidden
        opacity: 1,
        transparent: false,
        frame: true
    });
    
    // Load the TableTalk app
    const serverUrl = `http://localhost:${port}`;
    console.log(`[ELECTRON] Loading URL: ${serverUrl}`);
    
    mainWindow.loadURL(serverUrl);
    
    // Show window when ready
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        mainWindow.focus();
        
        // Only open dev tools in development mode
        if (CONFIG.DEV_MODE) {
            mainWindow.webContents.openDevTools();
        }
    });
    
    // Handle external links
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });
    
    // Handle window closed
    mainWindow.on('closed', () => {
        mainWindow = null;
        console.log(`[ELECTRON] Main window closed`);
    });
    
    // Handle load failures
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
        console.error(`[ELECTRON] Failed to load ${validatedURL}: ${errorDescription}`);
        
        // Show an error dialog
        dialog.showErrorBox(
            'Connection Error', 
            `Failed to connect to TableTalk server.\n\nError: ${errorDescription}\n\nThe application will close.`
        );
        
        app.quit();
    });
}

/**
 * Get network interfaces for connection URLs
 * @param {number} port - Server port
 * @returns {Array} - Array of connection URLs
 */
function getNetworkUrls(port) {
    const os = require('os');
    const networkInterfaces = os.networkInterfaces();
    const urls = [];
    
    urls.push({ type: 'Local', url: `http://localhost:${port}` });
    
    for (const name of Object.keys(networkInterfaces)) {
        const netInterface = networkInterfaces[name];
        if (netInterface) {
            for (const net of netInterface) {
                if (net.family === 'IPv4' && !net.internal) {
                    urls.push({ type: 'Network', url: `http://${net.address}:${port}` });
                }
            }
        }
    }
    
    return urls;
}

/**
 * Create application menu with connection info
 * @param {number} port - Server port
 */
function createApplicationMenu(port) {
    currentPort = port;
    networkUrls = getNetworkUrls(port);
    
    const template = [
        {
            label: 'TableTalk',
            submenu: [
                {
                    label: 'About TableTalk',
                    click: () => {
                        dialog.showMessageBox(mainWindow, {
                            type: 'info',
                            title: 'About TableTalk',
                            message: 'TableTalk v1.0.0',
                            detail: 'A desktop TTRPG chat application for your gaming sessions.\n\nBuilt with Electron and Socket.IO'
                        });
                    }
                },
                { type: 'separator' },
                {
                    label: 'Quit',
                    accelerator: 'CmdOrCtrl+Q',
                    click: () => app.quit()
                }
            ]
        },
        {
            label: 'Connection',
            submenu: [
                {
                    label: 'Show Connection Info',
                    accelerator: 'CmdOrCtrl+I',
                    click: () => {
                        const urls = getNetworkUrls(currentPort);
                        const urlList = urls.map(u => `${u.type}: ${u.url}`).join('\n');
                        const qrUrl = `http://localhost:${currentPort}/qr-code.svg`;
                        
                        dialog.showMessageBox(mainWindow, {
                            type: 'info',
                            title: 'Player Connection Info',
                            message: 'Share these URLs with your players:',
                            detail: `${urlList}\n\nQR Code: ${qrUrl}\n\nPlayers can use any of these URLs to join your game.`
                        });
                    }
                },
                {
                    label: 'Copy Local URL',
                    click: () => {
                        const localUrl = `http://localhost:${currentPort}`;
                        clipboard.writeText(localUrl);
                        
                        dialog.showMessageBox(mainWindow, {
                            type: 'info',
                            title: 'Copied!',
                            message: 'Local URL copied to clipboard',
                            detail: localUrl
                        });
                    }
                },
                {
                    label: 'Copy Network URL',
                    click: () => {
                        const urls = getNetworkUrls(currentPort);
                        const networkUrl = urls.find(u => u.type === 'Network');
                        
                        if (networkUrl) {
                            clipboard.writeText(networkUrl.url);
                            dialog.showMessageBox(mainWindow, {
                                type: 'info',
                                title: 'Copied!',
                                message: 'Network URL copied to clipboard',
                                detail: networkUrl.url
                            });
                        } else {
                            dialog.showMessageBox(mainWindow, {
                                type: 'warning',
                                title: 'No Network Connection',
                                message: 'No network URL available',
                                detail: 'Make sure you are connected to a network to share with other devices.'
                            });
                        }
                    }
                },
                {
                    label: 'Open QR Code',
                    click: () => {
                        const qrUrl = `http://localhost:${currentPort}/qr-code.svg`;
                        shell.openExternal(qrUrl);
                    }
                }
            ]
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        },
        {
            label: 'Window',
            submenu: [
                { role: 'minimize' },
                { role: 'close' }
            ]
        }
    ];
    
    // On macOS, adjust the menu for platform conventions
    if (process.platform === 'darwin') {
        template[0].submenu.unshift({ role: 'about' });
        template[0].submenu.push(
            { type: 'separator' },
            { role: 'services' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' }
        );
        
        // Window menu on macOS
        template[3].submenu = [
            { role: 'close' },
            { role: 'minimize' },
            { role: 'zoom' },
            { type: 'separator' },
            { role: 'front' }
        ];
    }
    
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

// Test window removed for production build

/**
 * Initialize the application - production version
 */
async function initializeApp() {
    console.log(`[ELECTRON] Starting TableTalk...`);
    
    try {
        // Find an available port
        const port = await findAvailablePort();
        console.log(`[ELECTRON] Using port: ${port}`);
        
        // Get server file path
        const serverInfo = await getServerPath();
        
        // Start the server
        await startServerProduction(port, serverInfo);
        console.log(`[ELECTRON] Server started successfully`);
        
        // Create the main window
        createMainWindow(port);
        
        // Create the application menu with connection info
        createApplicationMenu(port);
        
        console.log(`[ELECTRON] TableTalk ready!`);
        
    } catch (error) {
        console.error(`[ELECTRON] Startup failed:`, error);
        
        // Show error dialog
        dialog.showErrorBox(
            'TableTalk Startup Error', 
            `TableTalk failed to start.\n\nError: ${error.message}\n\nPlease try again or contact support.`
        );
        
        app.quit();
    }
}

/**
 * Get server file path - simplified for production
 */
async function getServerPath() {
    const fs = require('fs');
    
    if (CONFIG.DEV_MODE) {
        const devPath = path.join(__dirname, '..', 'server', 'dist', 'server', 'server.js');
        if (fs.existsSync(devPath)) {
            return {
                serverPath: devPath,
                workingDir: path.dirname(devPath)
            };
        } else {
            throw new Error('Development server not found. Please run "npm run build" in the server directory.');
        }
    }
    
    // In packaged mode - use the standard path we know works
    const serverPath = path.join(__dirname, 'dist', 'server', 'server', 'server.js');
    if (fs.existsSync(serverPath)) {
        return {
            serverPath: serverPath,
            workingDir: path.dirname(serverPath)
        };
    } else {
        throw new Error('Server files not found in application bundle.');
    }
}

/**
 * Start server - production version
 */
function startServerProduction(port, serverInfo) {
    return new Promise((resolve, reject) => {
        try {
            // Set environment variables
            process.env.PORT = port.toString();
            process.env.ELECTRON_MODE = 'true';
            process.env.ELECTRON_CLIENT_PATH = path.join(__dirname, 'dist', 'client');
            
            // Load the server
            require(serverInfo.serverPath);
            
            // Give the server time to start
            setTimeout(() => {
                resolve(true);
            }, 2000);
            
        } catch (error) {
            console.error(`[ELECTRON] Server startup failed:`, error);
            reject(error);
        }
    });
}

/**
 * Clean up when the app is quitting
 */
function cleanup() {
    console.log(`[ELECTRON] Cleaning up...`);
    // Server runs in the same process, so cleanup happens automatically
}

// App event handlers
app.whenReady().then(initializeApp);

app.on('window-all-closed', () => {
    // On macOS, keep the app running even when all windows are closed
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    // On macOS, re-create a window when the dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
        initializeApp();
    }
});

app.on('before-quit', cleanup);
app.on('will-quit', cleanup);

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error(`[ELECTRON] Uncaught exception:`, error);
    cleanup();
    app.quit();
});

process.on('unhandledRejection', (reason, promise) => {
    console.error(`[ELECTRON] Unhandled rejection at:`, promise, 'reason:', reason);
});
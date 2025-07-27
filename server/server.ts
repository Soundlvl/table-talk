// server/server.ts
import http from 'http';
import { Server } from 'socket.io';
import fs from 'fs';
import path from 'path';
import os from 'os';
import qrcode from 'qrcode';
import * as utils from './utils'; // Import all exports from utils
import { GameTables, ServerIoType, Utils } from './types';
import { onNewConnection } from './handlers/connectionHandler'; // Import the connection handler

let qrCodeSvg: string | null = null; // To store the generated QR code SVG

// --- Security Check ---
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'TTadmin';
if (ADMIN_PASSWORD === 'TTadmin') {
    console.warn(`
    \n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    \n[!!! SECURITY WARNING !!!] 
    You are using the default administrator password ("TTadmin"). 
    It is highly recommended to set a custom, secure password for the 
    admin panel by setting the ADMIN_PASSWORD environment variable.
    
    Open a command prompt or terminal and navigate to the directory where
    you run this server. 
        
        cd /path/to/your/project/directory

    Then set the environment variable like this:

        MAC OS Example: ADMIN_PASSWORD="your_secure_password_here" ./table-talk-server
        Windows Example: set ADMIN_PASSWORD=your_new_secure_password table-talk-server.exe 

    \n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    `);
} else {
    console.log('[SECURITY] Custom administrator password is set.');
}


// --- Rate Limiter (replaces express-rate-limit) ---
const ipRequestCounts = new Map<string, { count: number; startTime: number }>();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 500;

setInterval(() => {
    const now = Date.now();
    for (const [ip, data] of ipRequestCounts.entries()) {
        if (now - data.startTime > RATE_LIMIT_WINDOW_MS) {
            ipRequestCounts.delete(ip);
        }
    }
}, RATE_LIMIT_WINDOW_MS);

// --- MIME Types for serving files ---
const mimeTypes: { [key: string]: string } = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
};


// --- Static Client Serving Logic ---
const getClientBuildPath = () => {
    // Debug: Log the current directory and environment
    console.log(`[DEBUG] __dirname: ${__dirname}`);
    console.log(`[DEBUG] process.cwd(): ${process.cwd()}`);
    console.log(`[DEBUG] ELECTRON_MODE: ${process.env.ELECTRON_MODE}`);
    
    if ((process as any).pkg) {
        // In a packaged app, assets are bundled relative to the snapshot root.
        // When the script runs, __dirname is /snapshot/server/dist/server.
        // We need to navigate up to the snapshot root, then to the client/dist asset folder.
        return path.resolve(__dirname, '..', '..', '..', 'client', 'dist');
    }
    
    // Check if running under Electron
    if (process.env.ELECTRON_MODE === 'true') {
        // When running from Electron, use the client path provided by Electron
        if (process.env.ELECTRON_CLIENT_PATH) {
            console.log(`[SERVER] Using Electron-provided client path: ${process.env.ELECTRON_CLIENT_PATH}`);
            return process.env.ELECTRON_CLIENT_PATH;
        }
        // Fallback to relative path resolution
        const projectRoot = path.resolve(process.cwd(), '..');
        return path.join(projectRoot, 'client', 'dist');
    }
    
    const isRunningFromDist = __dirname.replace(/\\/g, '/').includes('/server/dist');
    const projectRoot = isRunningFromDist
        ? path.resolve(__dirname, '..', '..', '..')
        : path.resolve(__dirname, '..');
    return path.join(projectRoot, 'client', 'dist');
};

const clientBuildPath = getClientBuildPath();

if (!fs.existsSync(clientBuildPath)) {
    console.error('\n\x1b[31m[FATAL ERROR] Client build path not found!\x1b[0m');
    console.error(`Attempted to find client files at: \x1b[33m${clientBuildPath}\x1b[0m`);
    console.error('This means the server cannot serve the web interface.');
    console.error('\nTroubleshooting steps:');
    console.error('  1. Make sure you have run `npm install` and `npm run build` in the `client` directory.');
    console.error('  2. If you have modified the project structure, please update the path logic in `server/server.ts`.\n');
    (process as any).exit(1);
} else {
    console.log(`[SERVER] Serving client files from: ${clientBuildPath}`);
}


// --- HTTP Request Listener (replaces Express app) ---
const requestListener = (req: http.IncomingMessage, res: http.ServerResponse) => {
    // 1. Rate Limiting
    const clientIp = req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    let ipData = ipRequestCounts.get(clientIp);

    if (!ipData) {
        ipData = { count: 0, startTime: now };
    }
    ipData.count++;
    ipRequestCounts.set(clientIp, ipData);

    if (ipData.count > MAX_REQUESTS_PER_WINDOW) {
        if (now - ipData.startTime < RATE_LIMIT_WINDOW_MS) {
            res.writeHead(429, { 'Content-Type': 'text/plain' });
            res.end('Too many requests, please try again later.');
            return;
        } else {
            ipData.count = 1;
            ipData.startTime = now;
            ipRequestCounts.set(clientIp, ipData);
        }
    }

    if(req.method !== 'GET') {
        res.writeHead(405, { 'Content-Type': 'text/plain' });
        res.end('Method Not Allowed');
        return;
    }

    const reqUrl = req.url || '/';
    console.log(`[REQUEST] ${req.method} ${reqUrl} from ${clientIp}`);

    // 2. Handle Routes
    // QR Code Route
    if (reqUrl === '/qr-code.svg') {
        if (qrCodeSvg) {
            res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
            res.end(qrCodeSvg);
        } else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('QR code not available.');
        }
        return;
    }

    // Uploads Route
    if (reqUrl.startsWith('/uploads/')) {
        // The URL path should be split by '/' as per URL standards.
        // path.normalize() is not used on the URL string because it can convert '/' to '\\' on Windows,
        // which would break the logic. We filter for '..' to prevent directory traversal attacks.
        const parts = decodeURIComponent(reqUrl).split('/').filter(p => p && p !== '..');
        
        console.log(`[UPLOADS] Attempting to serve: ${reqUrl}`);

        // After splitting '/uploads/tableId/file.ext', parts will be ['uploads', 'tableId', 'file.ext']
        if (parts.length >= 2 && parts[0] === 'uploads') {
            const tableId = parts[1];
            console.log(`[UPLOADS] Parsed Table ID: ${tableId}`);
            const gameState = gameTables.get(tableId);

            if (!gameState || !gameState.folderName) {
                console.error(`[UPLOADS] Failed: Table or folderName not found for tableId ${tableId}.`);
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Table or resource not found.');
                return;
            }

            const uploadsDir = path.join(utils.TABLES_DIR, gameState.folderName, 'uploads');
            // Construct the final path using path.join, which correctly handles OS-specific separators.
            // parts.slice(2) will contain the rest of the path, e.g., ['image.png'] or ['avatars', 'avatar.png']
            const requestedFile = path.join(uploadsDir, ...parts.slice(2));
            console.log(`[UPLOADS] Resolved file path: ${requestedFile}`);

            // Security check: ensure the resolved path is still within the intended uploads directory
            if (!requestedFile.startsWith(uploadsDir)) {
                console.error(`[UPLOADS] Forbidden: Attempt to access path outside of uploads directory.`);
                res.writeHead(403, { 'Content-Type': 'text/plain' });
                res.end('Forbidden');
                return;
            }
            serveFileFromPath(res, requestedFile, () => {
                console.error(`[UPLOADS] File not found at path: ${requestedFile}`);
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('File not found.');
            });
            return;
        }
    }

    // Static Client Files Route
    let filePath = path.join(clientBuildPath, reqUrl === '/' ? 'index.html' : decodeURIComponent(reqUrl));

    serveFileFromPath(res, filePath, () => {
        // Fallback for SPA: serve index.html
        const indexPath = path.join(clientBuildPath, 'index.html');
        serveFileFromPath(res, indexPath, () => {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Server error: index.html not found.');
        });
    });
};

function serveFileFromPath(res: http.ServerResponse, filePath: string, onError: () => void) {
    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code == 'ENOENT') {
                onError();
            } else {
                console.error(`[SERVER] Error reading file ${filePath}: ${error.code}`);
                res.writeHead(500);
                res.end('Sorry, check with the site admin for error: ' + error.code + ' ..\n');
            }
        } else {
            console.log(`[SERVER] Serving file ${filePath} with type ${contentType}`);
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
}

// --- Server Initialization ---
const server = http.createServer(requestListener);
const PORT: string | number = process.env.PORT || 3001;

const io: ServerIoType = new Server(server, {
    cors: {
        origin: "*", // Allow all origins for development flexibility
        methods: ["GET", "POST"],
        credentials: true
    },
    maxHttpBufferSize: 6e6
});

if (!fs.existsSync(utils.TABLES_DIR)) {
    fs.mkdirSync(utils.TABLES_DIR, { recursive: true });
}

const gameTables: GameTables = new Map();
const connectionContext = {
    io,
    gameTables,
    utils: { ...utils } as Utils,
    ADMIN_PASSWORD,
};

// Main server initialization logic.
utils.loadAllTables(gameTables).then(() => {
    io.on('connection', (socket) => {
        onNewConnection(socket, connectionContext);
    });

    server.listen(PORT as number, '0.0.0.0', async () => {
        const networkInterfaces = os.networkInterfaces();
        const urls: { type: string, url: string }[] = [];

        urls.push({ type: 'Local', url: `http://localhost:${PORT}` });

        for (const name of Object.keys(networkInterfaces)) {
            const netInterface = networkInterfaces[name];
            if (netInterface) {
                for (const net of netInterface) {
                    if (net.family === 'IPv4' && !net.internal) {
                        urls.push({ type: 'Network', url: `http://${net.address}:${PORT}` });
                    }
                }
            }
        }

        const networkUrl = urls.find(u => u.type === 'Network')?.url;
        let terminalQr: string | null = null;
        
        if (networkUrl) {
            try {
                // Generate SVG for the web route
                qrCodeSvg = await qrcode.toString(networkUrl, { type: 'svg', color: { dark: '#000', light: '#FFF' }, margin: 1 });
                // Generate string for the terminal
                terminalQr = await qrcode.toString(networkUrl, { type: 'terminal', small: true });
            } catch (err) {
                console.error("[QRCODE] Failed to generate QR code:", err);
            }
        }
        
        console.log('\n\n\x1b[32m%s\x1b[0m', '✅ Table Talk Server is running!');
        console.log('='.repeat(50));
        console.log('Your players can connect using these URLs:');
        urls.forEach(u => console.log(`  - \x1b[1m${u.type}:\x1b[0m \x1b[36m${u.url}\x1b[0m`));
        
        if (networkUrl) {
            console.log('\nOr scan this QR code with a mobile device:');
            if (terminalQr) {
                console.log(terminalQr);
            }
            console.log('You can also open the QR code in your browser:');
            console.log(`  - \x1b[1mQR Code URL:\x1b[0m \x1b[36mhttp://localhost:${PORT}/qr-code.svg\x1b[0m`);
        }
        
        console.log('='.repeat(50));
        console.log('\x1b[33m%s\x1b[0m', '[IMPORTANT] If players on other devices cannot connect:');
        console.log('  1. Ensure all devices are on the SAME Wi-Fi network.');
        console.log('  2. Your PC\'s firewall may be blocking the connection. If you see');
        console.log('     a firewall prompt when starting the server, you must "Allow access".');
        console.log('='.repeat(50));
        console.log('Press \x1b[1mCtrl+C\x1b[0m to stop the server.');
    });
}).catch(error => {
    console.error("[SERVER] Critical error on startup: Failed to load tables.", error);
    (process as any).exit(1);
});
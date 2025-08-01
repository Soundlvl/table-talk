/**
 * TableTalk Electron Preload Script
 * 
 * This script runs in the renderer process and can safely expose
 * APIs to the web content if needed in the future.
 */

const { contextBridge } = require('electron');

// Expose a minimal API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
    // Version info
    getVersion: () => process.versions.electron,
    
    // Environment info
    isElectron: () => true,
    
    // Platform info
    getPlatform: () => process.platform
});

// Only log in development mode
if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
    console.log('[PRELOAD] TableTalk preload script loaded');
}
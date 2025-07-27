const { compile } = require('nexe');
const path = require('path');
const fs = require('fs');

console.log('--- Nexe Build Script Starting ---');

// --- Configuration ---
// The main file that TypeScript compiles into the 'dist' folder.
const inputFile = path.resolve(__dirname, './dist/server.js'); 
// The final executable will be placed in the 'release' folder.
const outputFile = './release/table-talk-server-win.exe';
const iconFile = './assets/icon.ico';

// --- Pre-flight Check ---
// First, check if the input file actually exists in the 'dist' directory.
if (!fs.existsSync(inputFile)) {
    console.error('❌ ERROR: Input file not found at: ' + inputFile);
    console.error('Please make sure you have run "npm run build" first to compile your TypeScript into the "dist" folder.');
    process.exit(1); // Exit with an error
}

console.log('✅ Input file found. Starting Nexe compilation...');
console.log('This can take several minutes on the first run, as it needs to download a Node.js binary.');

// --- Run Nexe ---
compile({
    input: inputFile,
    output: outputFile,
    
     build: true, 
    ico: iconFile,
    verbose: true // Ask Nexe to be "talkative"
}).then(() => {
    console.log('✅ Nexe build complete! The executable is in the "release" folder.');
}).catch(err => {
    console.error('❌ Nexe build failed:');
    console.error(err);
    process.exit(1); // Exit with an error
});
/**
 * Advanced PKG build script with icon injection
 * This attempts to solve the icon problem by using PKG's advanced options
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🎯 Starting PKG build with icon injection...');

// Configuration
const CONFIG = {
    iconPath: path.resolve(__dirname, 'assets/icon.ico'),
    inputFile: path.resolve(__dirname, 'dist/server.js'),
    outputDir: path.resolve(__dirname, 'release'),
    appName: 'table-talk-server'
};

// Verify prerequisites
function checkPrerequisites() {
    console.log('✅ Checking prerequisites...');
    
    if (!fs.existsSync(CONFIG.iconPath)) {
        console.error(`❌ Icon file not found: ${CONFIG.iconPath}`);
        process.exit(1);
    }
    
    if (!fs.existsSync(CONFIG.inputFile)) {
        console.error(`❌ Input file not found: ${CONFIG.inputFile}`);
        console.error('Please run "npm run build" first');
        process.exit(1);
    }
    
    // Ensure output directory exists
    if (!fs.existsSync(CONFIG.outputDir)) {
        fs.mkdirSync(CONFIG.outputDir, { recursive: true });
    }
    
    console.log('✅ Prerequisites OK');
}

// Method 1: Try PKG with --icon flag (sometimes works)
function tryPkgWithIcon() {
    console.log('🔧 Attempting PKG with --icon flag...');
    
    try {
        const outputPath = path.join(CONFIG.outputDir, `${CONFIG.appName}-win.exe`);
        const cmd = `npx pkg "${CONFIG.inputFile}" --targets node18-win-x64 --output "${outputPath}" --icon "${CONFIG.iconPath}"`;
        
        console.log(`Running: ${cmd}`);
        execSync(cmd, { stdio: 'inherit' });
        
        if (fs.existsSync(outputPath)) {
            console.log('✅ PKG with --icon succeeded!');
            return outputPath;
        }
    } catch (error) {
        console.log('❌ PKG with --icon failed');
        console.log(error.message);
    }
    
    return null;
}

// Method 2: Try PKG with custom config
function tryPkgWithCustomConfig() {
    console.log('🔧 Attempting PKG with custom configuration...');
    
    // Create temporary package.json with specific icon config
    const tempConfig = {
        pkg: {
            targets: ['node18-win-x64'],
            outputPath: CONFIG.outputDir,
            options: ['--icon', CONFIG.iconPath, '--no-bytecode', '--no-signature'],
            assets: [
                '../client/dist/**/*',
                'node_modules/@dice-roller/rpg-dice-roller/lib/**/*',
                'node_modules/@dice-roller/rpg-dice-roller/package.json',
                'node_modules/@dice-roller/rpg-dice-roller/types/**/*',
                'node_modules/mathjs/**/*',
                'node_modules/complex.js/**/*',
                'node_modules/decimal.js/**/*',
                'node_modules/fraction.js/**/*',
                'node_modules/seedrandom/**/*',
                'node_modules/tiny-emitter/**/*',
                'node_modules/typed-function/**/*'
            ]
        }
    };
    
    try {
        const tempConfigPath = path.join(__dirname, 'temp-pkg-config.json');
        fs.writeFileSync(tempConfigPath, JSON.stringify(tempConfig, null, 2));
        
        const cmd = `npx pkg "${CONFIG.inputFile}" --config "${tempConfigPath}"`;
        console.log(`Running: ${cmd}`);
        execSync(cmd, { stdio: 'inherit' });
        
        // Clean up temp config
        fs.unlinkSync(tempConfigPath);
        
        const outputPath = path.join(CONFIG.outputDir, `${CONFIG.appName}-win.exe`);
        if (fs.existsSync(outputPath)) {
            console.log('✅ PKG with custom config succeeded!');
            return outputPath;
        }
    } catch (error) {
        console.log('❌ PKG with custom config failed');
        console.log(error.message);
    }
    
    return null;
}

// Method 3: Build without icon as fallback
function buildWithoutIcon() {
    console.log('🔧 Building without icon as fallback...');
    
    try {
        const outputPath = path.join(CONFIG.outputDir, `${CONFIG.appName}-win-no-icon.exe`);
        const cmd = `npx pkg "${CONFIG.inputFile}" --targets node18-win-x64 --output "${outputPath}"`;
        
        console.log(`Running: ${cmd}`);
        execSync(cmd, { stdio: 'inherit' });
        
        if (fs.existsSync(outputPath)) {
            console.log('✅ Build without icon succeeded!');
            return outputPath;
        }
    } catch (error) {
        console.log('❌ Build without icon failed');
        console.log(error.message);
    }
    
    return null;
}

// Main execution
function main() {
    checkPrerequisites();
    
    console.log('🚀 Trying multiple PKG icon methods...\n');
    
    // Try each method in order
    let result = tryPkgWithIcon();
    if (!result) {
        result = tryPkgWithCustomConfig();
    }
    if (!result) {
        result = buildWithoutIcon();
    }
    
    if (result) {
        console.log(`\n🎉 Build completed successfully!`);
        console.log(`📁 Output: ${result}`);
        console.log(`📏 Size: ${Math.round(fs.statSync(result).size / 1024 / 1024)} MB`);
        
        // Test if the executable works
        console.log('\n🧪 Testing executable...');
        try {
            execSync(`"${result}" --version`, { timeout: 5000 });
            console.log('✅ Executable test passed!');
        } catch (error) {
            console.log('⚠️  Executable test failed, but file was created');
        }
    } else {
        console.log('\n❌ All build methods failed');
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { main, CONFIG };
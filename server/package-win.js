// This script builds the Windows executable using 'pkg' and then modifies its resources with 'resedit-js'.
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const resedit = require('resedit-js');

async function main() {
    console.log('--- Starting Windows Build Process ---');

    const scriptDir = __dirname;

    // --- Configuration ---
    const packageJson = require(path.join(scriptDir, 'package.json'));
    const pkgConfig = packageJson.pkg || {};
    const buildConfigPath = path.join(scriptDir, 'build.json');
    
    if (!fs.existsSync(buildConfigPath)) {
        console.error(`\n❌ Build configuration file not found at: ${buildConfigPath}`);
        console.error('Please ensure "build.json" exists in the server directory.');
        process.exit(1);
    }
    const buildConfig = require(buildConfigPath);

    const outputDir = path.resolve(scriptDir, pkgConfig.outputPath || 'release');
    const outputFilename = 'table-talk-server-win.exe';
    const outputPath = path.join(outputDir, outputFilename);
    const target = 'node18-win-x64';

    // Ensure the output directory exists
    await fs.promises.mkdir(outputDir, { recursive: true });

    // --- Step 1: Package the application with 'pkg' ---
    console.log('\n[Step 1/2] Packaging application with pkg...');
    const pkgCommand = `npx pkg . --targets ${target} --output "${outputPath}"`;
    console.log(`> ${pkgCommand}`);

    try {
        await runCommand(pkgCommand, { cwd: scriptDir });
        console.log('✅ Packaging complete.');
    } catch (error) {
        console.error('\n❌ Packaging failed. See output above for details.');
        process.exit(1);
    }

    // --- Step 2: Modify executable resources with 'resedit-js' ---
    console.log('\n[Step 2/2] Modifying executable resources with resedit-js...');

    try {
        const exeFile = fs.readFileSync(outputPath);
        let pe = resedit.PE.from(exeFile);
        
        // Set Version Info
        if (buildConfig.version) {
            console.log('  - Setting version info...');
            const vi = resedit.Resource.VersionInfo.fromObject(buildConfig.version);
            pe.setResource(resedit.ResourceType.VERSION_INFO, 1, 1033, vi.toBuffer());
        }
        
        // Set Icon
        const iconPath = path.resolve(scriptDir, buildConfig.icon);
        if (buildConfig.icon && fs.existsSync(iconPath)) {
            console.log(`  - Setting icon from: ${iconPath}`);
            const iconFile = fs.readFileSync(iconPath);
            const icon = resedit.Data.IconFile.from(iconFile);
            pe.setResource(resedit.ResourceType.ICON_GROUP, 1, 1033, resedit.Resource.IconGroupEntry.fromIcons(icon.icons).toBuffer());
            icon.icons.forEach((item, i) => {
                pe.setResource(resedit.ResourceType.ICON, i + 1, 1033, item.data);
            });
        } else if (buildConfig.icon) {
            console.log(`  - Warning: Icon file not found at '${iconPath}'. Skipping icon setup.`);
        }

        const newExeFile = pe.generate();
        fs.writeFileSync(outputPath, Buffer.from(newExeFile));
        console.log('✅ Resources modified successfully.');

    } catch (error) {
        console.error('\n❌ Modifying resources failed.', error);
        process.exit(1);
    }

    console.log('\n--- Windows Build Process Complete ---');
    console.log(`🎉 Executable ready at: ${outputPath}`);
}

function runCommand(command, options = {}) {
    return new Promise((resolve, reject) => {
        const childProcess = exec(command, options, (error, _stdout, _stderr) => {
            if (error) {
                reject(error);
                return;
            }
            resolve();
        });

        childProcess.stdout.pipe(process.stdout);
        childProcess.stderr.pipe(process.stderr);
    });
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
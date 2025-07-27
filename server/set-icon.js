const rcedit = require('node-rcedit');
const path = require('path');
const fs = require('fs');

async function setIcon() {
  const exePath = path.join(__dirname, 'release', 'table-talk-server.exe');
  const iconPath = path.join(__dirname, 'assets', 'icon.ico');
  
  // Check if exe exists
  if (!fs.existsSync(exePath)) {
    console.error(`Executable not found: ${exePath}`);
    console.log('Available files in release directory:');
    if (fs.existsSync(path.join(__dirname, 'release'))) {
      fs.readdirSync(path.join(__dirname, 'release')).forEach(file => {
        console.log(`  ${file}`);
      });
    }
    return;
  }
  
  // Check if icon exists
  if (!fs.existsSync(iconPath)) {
    console.error(`Icon not found: ${iconPath}`);
    return;
  }
  
  try {
    console.log('Setting icon for executable...');
    await rcedit(exePath, {
      'icon': iconPath,
      'version-string': {
        'FileDescription': 'Table Talk Application',
        'ProductName': 'Table Talk',
        'CompanyName': 'Kevin McSharry',
        'FileVersion': '1.0.0',
        'ProductVersion': '1.0.0',
        'OriginalFilename': 'table-talk-server.exe',
        'InternalName': 'table-talk-server'
      }
    });
    console.log('✅ Icon set successfully!');
  } catch (err) {
    console.error('❌ Error setting icon:', err.message);
  }
}

setIcon();
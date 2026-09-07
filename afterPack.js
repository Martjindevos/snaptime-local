const fs = require('fs');
const path = require('path');

exports.default = async function(context) {
  const appOutDir = context.appOutDir;
  const installerSrc = path.join(__dirname, 'installer.sh');
  const installerDest = path.join(appOutDir, '..', 'installer.sh');

  console.log('Copying installer.sh to app directory...');

  if (fs.existsSync(installerSrc)) {
    fs.copyFileSync(installerSrc, installerDest);
    fs.chmodSync(installerDest, 0o755);
    console.log('✓ installer.sh added');
  } else {
    console.log('⚠ installer.sh not found');
  }
};

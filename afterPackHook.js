const { execSync } = require('child_process');
const path = require('path');

exports.default = async (context) => {
  const appPath = path.join(context.appOutDir, 'SnapTime Local.app');
  console.log('Pre-signing: removing resource forks...');
  
  try {
    execSync(`find "${appPath}" -type f -exec xattr -c {} + 2>/dev/null || true`);
    execSync(`find "${appPath}" -type f -perm /111 | while read f; do cp "$f" /tmp/rf_clean && cp /tmp/rf_clean "$f"; done 2>/dev/null || true`);
    console.log('✓ Forks cleaned');
  } catch (e) {
    console.log('Note:', e.message);
  }
};

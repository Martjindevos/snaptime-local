const { execSync } = require('child_process');
const path = require('path');

exports.default = async (context) => {
  const appPath = path.join(context.appOutDir, 'SnapTime Local.app');
  console.log('Cleaning resource forks...');
  
  execSync(`
    find "${appPath}" -type f -perm /111 | while read f; do
      cp "$f" "/tmp/exec_fix"
      cp "/tmp/exec_fix" "$f"
    done
  `, { stdio: 'inherit' });
  
  console.log('Re-signing with timestamp...');
  execSync(`
    find "${appPath}" -type f -perm /111 | while read f; do
      codesign -f --timestamp=http://timestamp.apple.com/ts01 -s "Developer ID Application: Martijn de Vos (TBJV88YTJK)" "$f" 2>/dev/null || true
    done
  `, { stdio: 'inherit' });
};

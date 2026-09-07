# SnapTime Local - Installation Guide

## Quick Install

1. Download `SnapTime Local-1.0.2.dmg`
2. Download `installer.sh`
3. Double-click the DMG to mount it
4. Drag `installer.sh` into the mounted SnapTime Local volume
5. Open Terminal and run:
   ```bash
   /Volumes/SnapTime\ Local/installer.sh
   ```

The installer will:
- Copy SnapTime Local to /Applications
- Remove quarantine restrictions  
- Start the app automatically

## Manual Install (if installer doesn't work)

1. Copy `SnapTime Local.app` from DMG to `/Applications`
2. Open Terminal and run:
   ```bash
   xattr -d com.apple.quarantine /Applications/SnapTime\ Local.app
   ```
3. Start the app from Applications folder

## First Launch

On first launch, macOS may show a security warning. Click "Open" to allow the app to run.

## Troubleshooting

**"SnapTime Local is beschadigd"** error:
- Run: `xattr -d com.apple.quarantine /Applications/SnapTime\ Local.app`
- Then start the app again

**Permission denied when running installer:**
- Make sure the installer script is executable
- Try: `chmod +x /Volumes/SnapTime\ Local/installer.sh`

## Updates

After the first installation, the app will check for updates automatically and install them in the background.

---

**Need help?** Check the GitHub releases page for the latest version.

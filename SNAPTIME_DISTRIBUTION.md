# SnapTime Local - Distribution Guide

## For Photographers

### Installation (Mac only)

1. **Download** `SnapTime.zip` from your photographer
2. **Unzip** the file - your Mac will do this automatically, or double-click if needed
3. **Drag** the `SnapTime.app` icon to your **Applications** folder (or any location you prefer)
4. **Double-click** `SnapTime.app` to launch

### First Run

- First time launch takes ~30 seconds to start (npm dev server initializing)
- You'll see the app window appear with no terminal
- SnapTime logo appears in your dock
- Close the terminal if it appears (shouldn't happen, but just in case)

### Normal Usage

- Double-click `SnapTime.app` any time to launch
- App runs completely in the background
- No terminal knowledge required
- All your photos and data are stored within the app

### Troubleshooting

**App won't start?**
- Try double-clicking again
- Wait 60 seconds on first launch
- Restart your Mac if needed

**Need to reinstall?**
- Delete the old `SnapTime.app`
- Unzip the fresh copy from `SnapTime.zip`

### System Requirements

- macOS 10.13 or newer
- Intel or Apple Silicon (M1, M2, M3, M4, etc.)
- ~500MB free disk space

---

## For Photographer (You)

### How to Distribute

1. **Send `SnapTime.zip`** (196KB) to other photographers via:
   - WeTransfer, iCloud Drive, Google Drive, etc.
   - Email if file size allows
   - USB drive for in-person handoff

2. **Each photographer** unpacks and runs it locally on their Mac

3. **No server needed** - completely standalone app
4. **No npm install required** - everything bundled
5. **No terminal knowledge required** - just double-click

### What's Included

The `SnapTime.app` bundle contains:
- All necessary launcher scripts
- App metadata (Info.plist)
- SnapTime logo and icons

When photographers launch it, it automatically:
- Starts `npm run dev` in background
- Hides the terminal completely
- Loads the React app UI
- Connects to Nikon camera via NX Tether (already configured on their system)

### System Architecture

```
SnapTime.app (single file photographers receive)
├── Contents/
│   ├── MacOS/
│   │   └── launcher (bash script that starts npm dev + hides terminal)
│   ├── Resources/
│   │   └── AppIcon.png (SnapTime logo)
│   └── Info.plist (app metadata)
```

When app runs, it needs:
- The full `/Users/martijn/Desktop/photographer-app` directory on their Mac
- Node.js installed (they should already have this)
- npm packages (runs `npm run dev` which uses existing node_modules)

**Important:** Each photographer needs to run `npm install` ONCE after they receive the code:
```bash
cd /Users/martijn/Desktop/photographer-app
npm install
```

Then they can use `SnapTime.app` to launch it.

---

## Sending Full App to Photographers

If sending to colleagues, send them:
1. **All files** from `/Users/martijn/Desktop/photographer-app/` EXCEPT:
   - `node_modules/` (too large, they'll install)
   - `dist/` (rebuilt each run)
   - `release/` (old builds)

2. **Include these folders:**
   - `src/` (source code)
   - `public/` (assets)
   - All config files (vite.config.ts, tsconfig.json, etc.)
   - package.json, package-lock.json

3. **Instructions for them:**
   ```
   1. Download and extract the project folder
   2. Open Terminal, navigate to project: cd /path/to/photographer-app
   3. Install dependencies: npm install
   4. Copy SnapTime.app to your Applications folder
   5. Double-click SnapTime.app to launch
   ```

---

## Notes

- Each photographer's SnapTime app runs independently
- Photos are stored locally on their Mac
- No data syncing between photographers
- Each needs their own Nikon camera + NX Tether setup
- localStorage stores session data on their computer only

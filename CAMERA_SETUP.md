# SnapTime Camera Setup Guide for macOS

## Issue: Camera Not Detected

If your Nikon/Canon/Sony camera is connected but SnapTime shows "Camera access blocked by system PTP service", follow these steps.

## Why This Happens

On macOS, the system's PTP (Photo Transfer Protocol) daemon holds exclusive USB access to cameras. This prevents gphoto2 from accessing the camera directly. We need to disable these system services once.

## Solution: One-Time Setup

### Option 1: Automatic Setup (Recommended)

1. Connect your camera to your Mac
2. Open SnapTime
3. Click "Capture" on any student
4. When prompted for your admin password, enter it
5. The system will disable PTP services automatically
6. Camera access is now enabled for this session and future sessions

### Option 2: Manual Setup

1. Open Terminal
2. Navigate to the SnapTime folder: `cd ~/Desktop/photographer-app`
3. Run the setup script: `bash setup-camera.sh`
4. Enter your admin password when prompted
5. The script will disable PTP services and verify camera access

### Option 3: Manual Commands

If you prefer to run the commands yourself, open Terminal and run:

```bash
sudo launchctl disable system/com.apple.ptpcamerad
sudo launchctl disable system/com.apple.cameracaptured
sudo killall -9 ptpcamerad
sudo killall -9 cameracaptured
sleep 1
gphoto2 --auto-detect
```

## Verification

After setup, verify your camera is accessible:

```bash
gphoto2 --auto-detect
```

You should see your camera listed, for example:
```
Model                          Poort           
----------------------------------------------------------
Nikon D50 (PTP mode)           usb:000,002
```

## Troubleshooting

**Camera still not detected after setup:**
- Restart your Mac and try again
- Check that your camera is properly connected via USB
- Try a different USB port
- Verify your camera supports PTP mode (usually the default)

**Errors about "Can't claim USB device":**
- The setup may not have completed successfully
- Try running the setup script again
- The PTP services may have restarted - restart your Mac

## What This Disables

This setup disables macOS system services that normally manage camera connections:
- `com.apple.ptpcamerad` - PTP camera daemon
- `com.apple.cameracaptured` - Camera capture service

These services can be re-enabled by running:
```bash
sudo launchctl enable system/com.apple.ptpcamerad
sudo launchctl enable system/com.apple.cameracaptured
sudo launchctl bootout system/com.apple.ptpcamerad
sudo launchctl bootout system/com.apple.cameracaptured
```

Then restart your Mac.

## Supported Cameras

SnapTime works with any camera that gphoto2 supports, including:
- Nikon (D50, D90, D3X, Z series, etc.)
- Canon (EOS series, PowerShot, etc.)
- Sony (Alpha series, RX series, etc.)
- Fujifilm (X-T series, GFX series, etc.)
- And hundreds of other models

Check `gphoto2 --list-cameras` to see if your camera is supported.

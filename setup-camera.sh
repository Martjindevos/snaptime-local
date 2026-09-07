#!/bin/bash

# SnapTime Camera Setup Script for macOS
# Run this once to enable Nikon camera access with gphoto2
# Usage: ./setup-camera.sh

echo "SnapTime Camera Setup"
echo "====================="
echo ""
echo "This script will disable macOS system PTP services that block"
echo "direct camera access. You'll need to enter your admin password."
echo ""

sudo launchctl disable system/com.apple.ptpcamerad
sudo launchctl disable system/com.apple.cameracaptured

echo "Stopping camera services..."
sudo killall -9 ptpcamerad 2>/dev/null || true
sudo killall -9 cameracaptured 2>/dev/null || true

sleep 1

echo ""
echo "Verifying camera access..."
gphoto2 --auto-detect

echo ""
echo "Setup complete! Your camera should now be accessible."
echo "You can now run SnapTime and take photos seamlessly."

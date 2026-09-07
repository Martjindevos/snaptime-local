#!/bin/bash

# SnapTime Local Installer
# Copies app to /Applications and removes quarantine flag

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
APP_NAME="SnapTime Local.app"
SOURCE_APP="$SCRIPT_DIR/$APP_NAME"
DEST_APP="/Applications/$APP_NAME"

echo "Installing SnapTime Local..."

# Check if source app exists
if [ ! -d "$SOURCE_APP" ]; then
  echo "Error: $APP_NAME not found in $SCRIPT_DIR"
  exit 1
fi

# Copy to Applications
echo "Copying app to /Applications..."
cp -r "$SOURCE_APP" "$DEST_APP"

# Remove quarantine attribute
echo "Removing quarantine flag..."
xattr -d com.apple.quarantine "$DEST_APP" 2>/dev/null || true

# Start the app
echo "Starting SnapTime Local..."
sleep 1
open "$DEST_APP"

echo "✓ Installation complete!"

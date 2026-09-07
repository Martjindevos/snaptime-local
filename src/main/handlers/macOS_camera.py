#!/usr/bin/env python3
"""macOS native camera capture using ImageCaptureCore framework"""

import json
import sys
from pathlib import Path
from time import sleep
from Foundation import NSString, NSArray
import ImageCaptureCore

def capture_photo(student_id, school_name, class_name, photo_path):
    """Capture photo from connected camera on macOS"""
    try:
        # Create output directory structure
        today_str = __import__('datetime').datetime.now().strftime('%Y%m%d')
        output_dir = Path(photo_path) / f"{school_name}_{today_str}" / class_name
        output_dir.mkdir(parents=True, exist_ok=True)

        # Determine filename
        base_file = output_dir / f"{student_id}.jpg"
        counter = 0
        while base_file.exists():
            base_file = output_dir / f"{student_id}_{counter}.jpg"
            counter += 1

        output_path = str(base_file)

        # Get device browser and find camera
        browser = ImageCaptureCore.ICDeviceBrowser.alloc().init()
        browser.start()
        sleep(1)

        devices = browser.cameras()
        if not devices:
            return {"success": False, "error": "No camera detected"}

        camera = devices[0]

        # Request download of last image from camera
        # Note: ImageCaptureCore captures to a temp location, then we process it
        delegate = CaptureDelegate.alloc().init()
        delegate.setOutputPath_(NSString.stringWithUTF8String_(output_path))

        camera.setDelegate_(delegate)
        camera.requestDownloadFile_toFile_options_delegate_didDownloadSelector_contextInfo_(
            camera.mediaFiles()[0],  # Last photo
            NSString.stringWithUTF8String_(output_path),
            None,
            delegate,
            "didDownloadFile:status:contextInfo:",
            None
        )

        # Wait for capture
        sleep(3)
        browser.stop()

        if Path(output_path).exists():
            return {"success": True, "photoPath": output_path}
        else:
            return {"success": False, "error": "Failed to capture image"}

    except Exception as e:
        return {"success": False, "error": str(e)}

def detect_camera():
    """Detect connected camera"""
    try:
        browser = ImageCaptureCore.ICDeviceBrowser.alloc().init()
        browser.start()
        sleep(1)

        devices = browser.cameras()
        browser.stop()

        return {"connected": len(devices) > 0, "capturing": False}
    except:
        return {"connected": False, "capturing": False}

# Objective-C delegate for camera capture
class CaptureDelegate:
    def setOutputPath_(self, path):
        self.outputPath = path

    def didDownloadFile_status_contextInfo_(self, file, status, info):
        print(f"Download complete: {self.outputPath}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        cmd = sys.argv[1]
        if cmd == "detect":
            result = detect_camera()
        elif cmd == "capture":
            result = capture_photo(sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5])
        print(json.dumps(result))
    else:
        print(json.dumps({"error": "Usage: python3 macOS_camera.py [detect|capture] [args]"}))

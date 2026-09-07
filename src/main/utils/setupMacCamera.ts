import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

const SETUP_FLAG_FILE = path.join(process.env.HOME || '/tmp', '.snaptime-camera-setup')

export function isCameraSetupComplete(): boolean {
  return fs.existsSync(SETUP_FLAG_FILE)
}

export function setupMacCamera(): boolean {
  try {
    console.log('Setting up macOS camera access...')

    // Disable PTP services (requires admin password once)
    const commands = [
      'sudo launchctl disable system/com.apple.ptpcamerad',
      'sudo launchctl disable system/com.apple.cameracaptured',
      'sudo killall -9 ptpcamerad 2>/dev/null || true',
      'sudo killall -9 cameracaptured 2>/dev/null || true',
      'sudo killall -9 mscamerad-xpc 2>/dev/null || true',
    ]

    for (const cmd of commands) {
      try {
        execSync(cmd, { stdio: 'pipe' })
      } catch (e) {
        // Commands may fail if already disabled, that's ok
      }
    }

    // Wait a moment for services to stop
    execSync('sleep 2')

    // Verify gphoto2 can access camera
    try {
      const result = execSync('gphoto2 --auto-detect', { encoding: 'utf-8' })
      if (result.includes('Nikon') || result.includes('Canon') || result.includes('Sony')) {
        console.log('✓ Camera detected successfully')

        // Mark setup as complete
        fs.writeFileSync(SETUP_FLAG_FILE, 'setup_complete\n')
        return true
      }
    } catch (e) {
      console.error('Camera not detected after setup')
      return false
    }
  } catch (error) {
    console.error('Camera setup failed:', error)
    return false
  }

  return false
}

export function showSetupPrompt(dialog: any, mainWindow: any): void {
  if (isCameraSetupComplete()) {
    return // Already set up
  }

  const response = dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Camera Setup Required',
    message: 'First-time camera setup needed',
    detail: 'The app needs to disable system camera services to access your camera. This requires your admin password (one time only). Continue?',
    buttons: ['Continue', 'Skip for now'],
    defaultId: 0,
  })

  if (response === 0) {
    const success = setupMacCamera()
    if (success) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Camera Ready',
        message: '✓ Camera is ready to use!',
        detail: 'You can now capture photos seamlessly.',
      })
    } else {
      dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'Camera Setup Failed',
        message: 'Could not access camera. Please check connection.',
      })
    }
  }
}

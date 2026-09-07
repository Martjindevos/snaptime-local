import { spawn } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { CameraStatus } from '../../types'

const DEFAULT_NX_TETHER_PATH = path.join(os.homedir(), 'Pictures/NX Tether')

export async function migrateStudentPhotos(params: {
  schoolName: string
  oldClassName: string
  newClassName: string
  studentId: string
  photoPath: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { schoolName, oldClassName, newClassName, studentId, photoPath } = params
    const today = new Date()
    const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`

    const oldClassPath = path.join(photoPath.replace('~', os.homedir()), `${schoolName}_${dateStr}`, oldClassName)
    const newClassPath = path.join(photoPath.replace('~', os.homedir()), `${schoolName}_${dateStr}`, newClassName)

    if (!fs.existsSync(oldClassPath)) {
      return { success: true } // No photos to migrate
    }

    if (!fs.existsSync(newClassPath)) {
      fs.mkdirSync(newClassPath, { recursive: true })
    }

    // Find all photos for this student
    const files = fs.readdirSync(oldClassPath)
    const studentPhotos = files.filter(f => f.startsWith(`${studentId}`) && (f.endsWith('.jpg') || f.endsWith('.jpeg')))

    for (const photo of studentPhotos) {
      const oldPath = path.join(oldClassPath, photo)
      const newPath = path.join(newClassPath, photo)

      if (!fs.existsSync(newPath)) {
        fs.copyFileSync(oldPath, newPath)
        console.log('[migrateStudentPhotos] Migrated:', oldPath, 'to', newPath)
      }
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

export async function detectCamera(): Promise<CameraStatus> {
  return { connected: true, capturing: false }
}

export async function capturePhoto(
  studentId: string,
  schoolName: string,
  className: string,
  photoPath: string,
  nxTetherPath?: string,
  sessionStartDate?: string
): Promise<{ success: boolean; photoPath?: string; error?: string }> {
  return new Promise((resolve) => {
    try {
      const NX_PATH = nxTetherPath ? nxTetherPath.replace('~', os.homedir()) : DEFAULT_NX_TETHER_PATH
      const beforeTime = Date.now()

      console.log('[capturePhoto] Opening NX Tether for student:', studentId)

      // Open NX Tether app
      spawn('sh', ['-c', 'open "/Applications/Nikon Software/NXTether/NXTether.app"'], {
        detached: true,
        stdio: 'ignore'
      })

      // Wait 1 second for app to open, then send keystroke
      setTimeout(() => {
        console.log('[capturePhoto] Sending trigger keystroke')
        const appleScript = `tell application "NXTether"
  activate
end tell
delay 0.5
tell application "System Events"
  keystroke "z" using {command down, control down}
end tell`

        spawn('osascript', ['-e', appleScript])
      }, 1000)

      // Wait for photo to appear in NX Tether folder
      let attempts = 0
      const checkInterval = setInterval(() => {
        attempts++
        const photo = findLatestPhoto(NX_PATH, beforeTime)

        if (attempts === 1) {
          try {
            const files = fs.readdirSync(NX_PATH)
            console.log('[capturePhoto] NX_PATH:', NX_PATH)
            console.log('[capturePhoto] Files in folder:', files)
          } catch (e) {
            console.log('[capturePhoto] Cannot read folder:', e)
          }
        }

        console.log(`[capturePhoto] Checking for photo (attempt ${attempts}): ${photo ? 'FOUND' : 'not found'}`)

        if (photo) {
          clearInterval(checkInterval)
          console.log('[capturePhoto] Moving photo from:', photo)
          console.log('[capturePhoto] To folder:', photoPath)
          const result = movePhotoToFolder(photo, studentId, schoolName, className, photoPath, sessionStartDate)
          console.log('[capturePhoto] Move result:', result)
          resolve(result)
        } else if (attempts > 120) {
          // 60 seconds timeout
          clearInterval(checkInterval)
          console.log('[capturePhoto] Timeout after 60 seconds')
          resolve({ success: false, error: 'Photo timeout - check NX Tether folder' })
        }
      }, 500)
    } catch (error) {
      resolve({ success: false, error: String(error) })
    }
  })
}

function findLatestPhoto(folderPath: string, afterTime: number): string | null {
  try {
    if (!fs.existsSync(folderPath)) return null
    let latestFile: { path: string; mtime: number } | null = null

    const searchDir = (dir: string) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true })
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name)
          if (entry.isDirectory()) {
            searchDir(fullPath)
          } else if (entry.isFile() && (entry.name.toLowerCase().endsWith('.jpg') || entry.name.toLowerCase().endsWith('.jpeg')) && !entry.name.toLowerCase().endsWith('.nef')) {
            const stat = fs.statSync(fullPath)
            // Only process JPG files < 10MB (exclude NEF copies that are 26+ MB)
            if (stat.mtimeMs > afterTime && stat.size < 25000000) {
              if (!latestFile || stat.mtimeMs > latestFile.mtime) {
                latestFile = { path: fullPath, mtime: stat.mtimeMs }
              }
            }
          }
        }
      } catch (e) {
        console.error('Error searching directory:', e)
      }
    }

    searchDir(folderPath)
    return latestFile?.path || null
  } catch (e) {
    console.error('Error finding photo:', e)
    return null
  }
}

export function movePhotoToFolder(
  sourcePath: string,
  studentId: string,
  schoolName: string,
  className: string,
  photoPath: string,
  sessionStartDate?: string
): { success: boolean; photoPath?: string; error?: string } {
  try {
    // Check if source file exists
    if (!fs.existsSync(sourcePath)) {
      console.log('[movePhotoToFolder] Source file does not exist:', sourcePath)
      return { success: false, error: 'Source file not found' }
    }

    // Use session start date if provided, otherwise use today's date
    let dateStr: string
    if (sessionStartDate) {
      // Convert "2026-09-05" format to "20260905"
      dateStr = sessionStartDate.replace(/-/g, '')
    } else {
      const today = new Date()
      dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`
    }
    const classPath = path.join(photoPath.replace('~', os.homedir()), `${schoolName}_${dateStr}`, className)

    if (!fs.existsSync(classPath)) {
      fs.mkdirSync(classPath, { recursive: true })
    }

    let filename = `${studentId}.jpg`
    let destPath = path.join(classPath, filename)

    if (!fs.existsSync(destPath)) {
      fs.copyFileSync(sourcePath, destPath)
      console.log('[movePhotoToFolder] Saved:', destPath)
      try {
        fs.unlinkSync(sourcePath)
        console.log('[movePhotoToFolder] Deleted source:', sourcePath)
      } catch (e) {
        console.log('[movePhotoToFolder] Could not delete source')
      }
      return { success: true, photoPath: destPath }
    }

    let counter = 1
    while (true) {
      filename = `${studentId}_${counter}.jpg`
      destPath = path.join(classPath, filename)
      if (!fs.existsSync(destPath)) break
      counter++
    }

    fs.copyFileSync(sourcePath, destPath)
    console.log('[movePhotoToFolder] Saved:', destPath)
    try {
      fs.unlinkSync(sourcePath)
      console.log('[movePhotoToFolder] Deleted source:', sourcePath)
    } catch (e) {
      console.log('[movePhotoToFolder] Could not delete source')
    }
    return { success: true, photoPath: destPath }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

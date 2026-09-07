import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

const NIKON_TRANSFER_PATH = path.join(os.homedir(), 'Pictures/Nikon Transfer 2')

export function captureWithNikonTransfer(
  studentId: string,
  schoolName: string,
  className: string,
  photoPath: string
): { success: boolean; photoPath?: string; error?: string } {
  try {
    // Get current time to know which photos are new
    const beforeTime = Date.now()

    // Trigger Nikon Transfer to download photos
    triggerNikonTransferDownload()

    // Wait a bit for transfer
    const startWait = Date.now()
    while (Date.now() - startWait < 10000) {
      const latestPhoto = findLatestPhoto(beforeTime)
      if (latestPhoto) {
        // Found new photo - move it to our folder
        return movePhotoToFolder(latestPhoto, studentId, schoolName, className, photoPath)
      }
      sleep(500)
    }

    return { success: false, error: 'No new photo detected after 10 seconds' }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

function triggerNikonTransferDownload(): void {
  const applescript = `
    tell application id "jp.co.nikon.NikonTransfer2"
      activate
      delay 1
    end tell
  `

  try {
    execSync(`osascript -e '${applescript.replace(/'/g, "'\\''")}'`, { stdio: 'pipe' })
  } catch {
    // Transfer might already be open, that's okay
  }
}

function findLatestPhoto(afterTime: number): string | null {
  try {
    // Check all session folders
    const sessionDirs = fs.readdirSync(NIKON_TRANSFER_PATH).filter(f => /^\d{3}$/.test(f))

    for (const sessionDir of sessionDirs.sort().reverse()) {
      const sessionPath = path.join(NIKON_TRANSFER_PATH, sessionDir)
      const files = fs.readdirSync(sessionPath)

      for (const file of files.reverse()) {
        if (file.endsWith('.JPG')) {
          const filePath = path.join(sessionPath, file)
          const stat = fs.statSync(filePath)

          if (stat.mtimeMs > afterTime) {
            return filePath
          }
        }
      }
    }
  } catch (error) {
    console.error('Error finding latest photo:', error)
  }

  return null
}

function movePhotoToFolder(
  sourcePath: string,
  studentId: string,
  schoolName: string,
  className: string,
  photoPath: string
): { success: boolean; photoPath?: string; error?: string } {
  try {
    const today = new Date()
    const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`
    const classPath = path.join(photoPath, `${schoolName}_${dateStr}`, className)

    if (!fs.existsSync(classPath)) {
      fs.mkdirSync(classPath, { recursive: true })
    }

    let filename = `${studentId}.jpg`
    let destPath = path.join(classPath, filename)
    let counter = 0

    while (fs.existsSync(destPath)) {
      filename = `${studentId}_${counter}.jpg`
      destPath = path.join(classPath, filename)
      counter++
    }

    // Copy the photo
    fs.copyFileSync(sourcePath, destPath)

    return { success: true, photoPath: destPath }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

function sleep(ms: number): void {
  const start = Date.now()
  while (Date.now() - start < ms) {
    // Busy wait
  }
}

export function detectNikonTransfer(): { connected: boolean; capturing: boolean } {
  try {
    // Check if Nikon Transfer folder exists
    const exists = fs.existsSync(NIKON_TRANSFER_PATH)
    return { connected: exists, capturing: false }
  } catch {
    return { connected: false, capturing: false }
  }
}

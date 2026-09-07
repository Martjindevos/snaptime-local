const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')

let mainWindow

function createWindow() {
  const preloadPath = path.resolve(__dirname, '../preload/index.js')
  console.log('Preload path:', preloadPath)

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    show: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath,
    },
  })

  const htmlPath = path.join(__dirname, '../renderer/index.html')
  console.log('HTML path:', htmlPath)
  console.log('__dirname:', __dirname)
  console.log('HTML exists:', require('fs').existsSync(htmlPath))
  const loadWithTimeout = (url: string, timeout: number = 2000): Promise<void> => {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timeout')), timeout)
      mainWindow.loadURL(url).then(() => {
        clearTimeout(timer)
        resolve()
      }).catch((err) => {
        clearTimeout(timer)
        reject(err)
      })
    })
  }

  loadWithTimeout('http://localhost:5174', 1000).catch(() => {
    console.log('Port 5174 failed, trying 5173')
    return loadWithTimeout('http://localhost:5173', 1000)
  }).catch(() => {
    console.log('Both dev ports failed, loading file')
    mainWindow.loadFile(htmlPath)
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.on('ready', () => {
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (!mainWindow) createWindow()
})

// IPC handlers
const { detectCamera, capturePhoto, movePhotoToFolder } = require('./handlers/cameraHandler')
const fs = require('fs')

ipcMain.handle('select-folder', async () => null)
ipcMain.handle('parse-xlsx', async () => ({}))
ipcMain.handle('create-project', async () => ({ success: true }))

ipcMain.handle('detect-camera', async () => {
  return await detectCamera()
})

ipcMain.handle('capture-photo', async (event, studentId, schoolName, className, photoPath, nxTetherPath) => {
  console.log('[IPC] capture-photo called:', { studentId, schoolName, className, photoPath, nxTetherPath })
  try {
    const result = await capturePhoto(studentId, schoolName, className, photoPath, nxTetherPath)
    console.log('[IPC] capture-photo result:', result)
    return result
  } catch (err) {
    console.error('[IPC] capture-photo error:', err)
    return { success: false, error: String(err) }
  }
})

ipcMain.handle('read-photo', async (event, filePath) => {
  try {
    return fs.readFileSync(filePath)
  } catch (error) {
    return null
  }
})

ipcMain.handle('list-nxtether-photos', async (event, nxTetherPath) => {
  try {
    const path = require('path')
    const os = require('os')
    const folderPath = nxTetherPath.replace('~', os.homedir())

    if (!fs.existsSync(folderPath)) return []

    const files = fs.readdirSync(folderPath)
    console.log('[list-nxtether-photos] All files in folder:', files)

    const photos = files
      .filter(f => {
        const lower = f.toLowerCase()
        const isJpg = lower.endsWith('.jpg') || lower.endsWith('.jpeg')
        const isNef = lower.endsWith('.nef')
        const included = isJpg && !isNef
        console.log('[list-nxtether-photos] File:', f, '- JPG:', isJpg, 'NEF:', isNef, '- Include:', included)
        return included
      })
      .map(f => {
        const filePath = path.join(folderPath, f)
        const stat = fs.statSync(filePath)
        return {
          path: filePath,
          time: stat.mtimeMs,
          size: stat.size
        }
      })
      .filter(f => f.size < 25000000) // Only files < 10MB (real JPGs, exclude NEF copies)
      .sort((a, b) => a.time - b.time)
      .map(p => p.path)

    console.log('[list-nxtether-photos] Filtered photos:', photos)
    return photos
  } catch (error) {
    console.error('Error listing NX Tether photos:', error)
    return []
  }
})

ipcMain.handle('move-photo-to-folder', async (event, sourcePath, studentId, schoolName, className, photoDestPath) => {
  try {
    console.log('[IPC move-photo-to-folder] Called with:', { sourcePath, studentId, schoolName, className, photoDestPath })

    if (!fs.existsSync(sourcePath)) {
      console.log('[IPC move-photo-to-folder] Source does not exist:', sourcePath)
      return { success: false, error: 'Source file not found' }
    }

    // Get original photo time from source file (when camera took it)
    const sourceStat = fs.statSync(sourcePath)
    const photoTime = new Date(sourceStat.mtimeMs)

    const today = new Date()
    const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`
    const classPath = path.join(photoDestPath.replace('~', require('os').homedir()), `${schoolName}_${dateStr}`, className)

    if (!fs.existsSync(classPath)) {
      fs.mkdirSync(classPath, { recursive: true })
    }

    let filename = `${studentId}.jpg`
    let destPath = path.join(classPath, filename)

    if (!fs.existsSync(destPath)) {
      fs.copyFileSync(sourcePath, destPath)
      console.log('[IPC move-photo-to-folder] Saved:', destPath)

      try {
        fs.unlinkSync(sourcePath)
        console.log('[IPC move-photo-to-folder] Deleted from source:', sourcePath)
      } catch (e) {
        console.log('[IPC move-photo-to-folder] Could not delete source')
      }

      return { success: true, photoPath: destPath, photoTime }
    }

    let counter = 1
    while (true) {
      filename = `${studentId}_${counter}.jpg`
      destPath = path.join(classPath, filename)
      if (!fs.existsSync(destPath)) break
      counter++
    }

    fs.copyFileSync(sourcePath, destPath)
    console.log('[IPC move-photo-to-folder] Saved:', destPath)

    try {
      fs.unlinkSync(sourcePath)
      console.log('[IPC move-photo-to-folder] Deleted from source:', sourcePath)
    } catch (e) {
      console.log('[IPC move-photo-to-folder] Could not delete source')
    }

    return { success: true, photoPath: destPath, photoTime }
  } catch (error) {
    console.error('[IPC move-photo-to-folder] Error:', error)
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('list-student-photos', async (event, photoDestPath, schoolName, className, studentId) => {
  try {
    const path = require('path')
    const os = require('os')
    const photoPath = photoDestPath.replace('~', os.homedir())
    const today = new Date()
    const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`
    const classPath = path.join(photoPath, `${schoolName}_${dateStr}`, className)

    console.log('[list-student-photos] Looking for:', { photoPath, schoolName, className, studentId, classPath })

    if (!fs.existsSync(classPath)) {
      console.log('[list-student-photos] Folder does not exist')
      return []
    }

    const files = fs.readdirSync(classPath)
    console.log('[list-student-photos] Files in folder:', files)

    const studentPhotos = files
      .filter(f => f.startsWith(studentId) && /\.(jpg|jpeg|png)$/i.test(f))
      .map(f => {
        const filePath = path.join(classPath, f)
        const stat = fs.statSync(filePath)
        return { photoPath: filePath, photoTime: new Date(stat.mtimeMs) }
      })
      .sort((a, b) => new Date(a.photoTime).getTime() - new Date(b.photoTime).getTime())

    console.log('[list-student-photos] Found photos:', studentPhotos)
    return studentPhotos
  } catch (error) {
    console.error('[list-student-photos] Error:', error)
    return []
  }
})

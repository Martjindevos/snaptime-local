const { app, BrowserWindow, ipcMain, dialog, Menu, shell, clipboard } = require('electron')
const path = require('path')
const fs = require('fs')
const { autoUpdater } = require('electron-updater')

let mainWindow

// Session file storage (includes working session + history)
const sessionPath = path.join(app.getPath('userData'), 'session.json')
const saveSession = (data: any) => {
  try {
    fs.writeFileSync(sessionPath, JSON.stringify(data, null, 2))
  } catch (err) {
    console.error('[Session] Failed to save:', err)
  }
}

const loadSession = () => {
  try {
    if (fs.existsSync(sessionPath)) {
      return JSON.parse(fs.readFileSync(sessionPath, 'utf-8'))
    }
  } catch (err) {
    console.error('[Session] Failed to load:', err)
  }
  return null
}

const saveSessionHistory = (sessions: any, archivedSessions: any) => {
  try {
    const data = loadSession() || {}
    data.sessions = sessions
    data.archivedSessions = archivedSessions
    fs.writeFileSync(sessionPath, JSON.stringify(data, null, 2))
  } catch (err) {
    console.error('[SessionHistory] Failed to save:', err)
  }
}

function buildAppMenu() {
  console.log('[Menu] Building app menu...')
  const template = [
    {
      label: 'SnapTime Local',
      submenu: [
        {
          label: 'Settings...',
          accelerator: 'CmdOrCtrl+,',
          click: () => mainWindow?.webContents.send('open-settings'),
        },
        {
          label: 'Enter License Key...',
          click: () => mainWindow?.webContents.send('open-license'),
        },
        {
          label: 'Check Duplicates...',
          click: () => mainWindow?.webContents.send('open-duplicates-checker'),
        },
        { type: 'separator' },
        { label: 'Quit SnapTime Local', role: 'quit' },
      ],
    },
    { role: 'windowMenu' },
  ]
  try {
    Menu.setApplicationMenu(Menu.buildFromTemplate(template))
    console.log('[Menu] Menu set successfully')
  } catch (error) {
    console.error('[Menu] Error setting menu:', error)
  }
}

function createWindow() {
  const fs = require('fs')
  let appPath = app.getAppPath()

  // In dev mode, app.getAppPath() returns dist/main, need dist/preload and dist/renderer
  // In prod mode (packaged), app.getAppPath() returns app root, already has dist subfolder
  let preloadPath = path.join(appPath, 'dist/preload/index.js')
  let htmlPath = path.join(appPath, 'dist/renderer/index.html')

  if (!fs.existsSync(preloadPath)) {
    // Dev mode: adjust from dist/main up to dist
    preloadPath = path.join(appPath, '../preload/index.js')
    htmlPath = path.join(appPath, '../renderer/index.html')
  }

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
  mainWindow.webContents.on('console-message', (level, message) => {
    console.log(`[Renderer] ${message}`)
  })

  console.log('HTML path:', htmlPath)
  console.log('App path:', app.getAppPath())
  console.log('HTML exists:', fs.existsSync(htmlPath))
  let loadFailed = false
  const failHandler = () => {
    if (!loadFailed) {
      loadFailed = true
      console.log('URL load failed, trying file:', htmlPath)
      mainWindow.webContents.removeListener('did-fail-load', failHandler)
      mainWindow.loadFile(htmlPath).catch((err) => {
        console.error('Failed to load HTML file:', err)
        dialog.showErrorBox('Startup Error', `Could not load: ${htmlPath}\n\n${err.message}`)
        mainWindow.close()
      })
    }
  }

  mainWindow.webContents.on('did-fail-load', failHandler)
  mainWindow.loadURL('http://localhost:5174').catch(() => {
    console.log('Port 5174 loadURL failed')
  })

  mainWindow.webContents.on('crashed', () => {
    console.error('[Electron] Renderer process crashed')
    dialog.showErrorBox('Crash', 'Application crashed. Please restart.')
  })

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('[Electron] Renderer process gone:', details)
  })

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('[Electron] Failed to load:', errorCode, errorDescription, validatedURL)
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.on('ready', () => {
  buildAppMenu()
  createWindow()

  // Check for updates
  autoUpdater.checkForUpdatesAndNotify()
  // Check for updates every hour
  setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify()
  }, 60 * 60 * 1000)
})

autoUpdater.on('update-available', () => {
  mainWindow?.webContents.send('update-available')
})

autoUpdater.on('update-downloaded', () => {
  mainWindow?.webContents.send('update-downloaded')
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (!mainWindow) createWindow()
})

// IPC handlers
const { detectCamera, capturePhoto, movePhotoToFolder, migrateStudentPhotos } = require('./handlers/cameraHandler')
import { DropboxUploader } from './handlers/dropboxHandler'
import { ensureLocationChannel, joinViaClientUri } from './handlers/teamspeakHandler'
import { getLicenseStatus, validateSnapTimeLicense } from './handlers/licenseHandler'
const os = require('os')

// Dropbox instance (initialized with user settings)
let dropboxUploader: any = null

// Load Dropbox settings from localStorage equivalent (stored in app data)
const settingsPath = path.join(os.homedir(), '.snaptime', 'settings.json')
const DEFAULT_TEAMSPEAK_SETTINGS = {
  enabled: false,
  host: '',
  clientPort: 9987,
  queryPort: 10011,
  queryUser: 'serveradmin',
  queryPassword: '',
  serverId: 1,
}

function loadSettings() {
  let loaded: any = { dropboxToken: '', dropboxEnabled: false }
  try {
    if (fs.existsSync(settingsPath)) {
      loaded = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
    }
  } catch (e) {
    console.log('[Settings] Could not load settings:', e)
  }
  // Merge in defaults for keys older settings.json files won't have yet
  loaded.teamspeak = { ...DEFAULT_TEAMSPEAK_SETTINGS, ...(loaded.teamspeak || {}) }

  // Stamp the trial start once, on first ever load - must be persisted immediately
  // so relaunching the app can't reset the trial clock.
  if (!loaded.installedAt) {
    loaded.installedAt = Date.now()
    loaded.licenseKey = loaded.licenseKey || ''
    loaded.licenseValid = loaded.licenseValid || false
    saveSettings(loaded)
  }

  return loaded
}

function saveSettings(settings: any) {
  try {
    const dir = path.dirname(settingsPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
  } catch (e) {
    console.error('[Settings] Could not save settings:', e)
  }
}

// Only deletes the local copy when the user has explicitly opted out of local storage
// (keepLocalCopy === false). Default/missing value keeps existing save-to-disk behavior untouched.
function deleteLocalCopyIfDisabled(localPhotoPath: string, logPrefix: string) {
  const settings = loadSettings()
  if (settings.keepLocalCopy === false) {
    try {
      fs.unlinkSync(localPhotoPath)
      console.log(`${logPrefix} Local copy deleted (local storage disabled):`, localPhotoPath)
    } catch (e) {
      console.error(`${logPrefix} Could not delete local copy:`, e)
    }
  }
}

// Initialize Dropbox on app start
const settings = loadSettings()
console.log('[Init] Loaded settings:', { token: settings.dropboxToken ? 'exists' : 'missing', enabled: settings.dropboxEnabled })
dropboxUploader = new DropboxUploader({
  accessToken: settings.dropboxToken,
  enabled: settings.dropboxEnabled,
})
console.log('[Init] DropboxUploader initialized, isEnabled:', dropboxUploader.isEnabled())

ipcMain.handle('select-folder', async () => null)
ipcMain.handle('parse-xlsx', async () => ({}))
ipcMain.handle('create-project', async () => ({ success: true }))

ipcMain.handle('detect-camera', async () => {
  return await detectCamera()
})

ipcMain.handle('capture-photo', async (event, studentId, schoolName, className, photoPath, nxTetherPath, sessionStartDate) => {
  console.log('[IPC] capture-photo called:', { studentId, schoolName, className, photoPath, nxTetherPath, sessionStartDate })
  try {
    const result = await capturePhoto(studentId, schoolName, className, photoPath, nxTetherPath, sessionStartDate)
    console.log('[IPC] capture-photo result:', result)

    if (result.success && result.photoPath && dropboxUploader && dropboxUploader.isEnabled()) {
      const localPhotoPath = result.photoPath
      dropboxUploader.uploadPhoto(localPhotoPath, studentId, schoolName, className)
        .then((uploadResult: any) => {
          if (uploadResult.success) {
            console.log('[IPC] capture-photo Dropbox upload successful:', uploadResult.remoteePath)
            deleteLocalCopyIfDisabled(localPhotoPath, '[IPC capture-photo]')
          } else {
            console.warn('[IPC] capture-photo Dropbox upload failed:', uploadResult.error)
          }
        })
        .catch((err: any) => {
          console.error('[IPC] capture-photo Dropbox upload error:', err)
        })
    }

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

ipcMain.handle('move-photo-to-folder', async (event, sourcePath, studentId, schoolName, className, photoDestPath, sessionStartDate) => {
  try {
    console.log('[IPC move-photo-to-folder] Called with:', { sourcePath, studentId, schoolName, className, photoDestPath, sessionStartDate })

    if (!fs.existsSync(sourcePath)) {
      console.log('[IPC move-photo-to-folder] Source does not exist:', sourcePath)
      return { success: false, error: 'Source file not found' }
    }

    // Get original photo time from source file (when camera took it)
    const sourceStat = fs.statSync(sourcePath)
    const photoTime = new Date(sourceStat.mtimeMs)

    // Use session start date if provided, otherwise use today's date
    let dateStr: string
    if (sessionStartDate) {
      // Convert "2026-09-05" format to "20260905"
      dateStr = sessionStartDate.replace(/-/g, '')
    } else {
      const today = new Date()
      dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`
    }
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
    } else {
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
    }

    // If Dropbox is enabled, upload in background (non-blocking)
    if (dropboxUploader && dropboxUploader.isEnabled()) {
      dropboxUploader.uploadPhoto(destPath, studentId, schoolName, className)
        .then((result: any) => {
          if (result.success) {
            console.log('[IPC move-photo-to-folder] Dropbox upload successful:', result.remoteePath)
            deleteLocalCopyIfDisabled(destPath, '[IPC move-photo-to-folder]')
          } else {
            console.warn('[IPC move-photo-to-folder] Dropbox upload failed:', result.error)
          }
        })
        .catch((err: any) => {
          console.error('[IPC move-photo-to-folder] Dropbox upload error:', err)
        })
    }

    return { success: true, photoPath: destPath, photoTime }
  } catch (error) {
    console.error('[IPC move-photo-to-folder] Error:', error)
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('migrate-student-photos', async (event, params) => {
  try {
    console.log('[IPC migrate-student-photos] Called:', params)
    const result = await migrateStudentPhotos(params)
    console.log('[IPC migrate-student-photos] Result:', result)
    return result
  } catch (error) {
    console.error('[IPC migrate-student-photos] Error:', error)
    return { success: false, error: String(error) }
  }
})

// Dropbox settings and management IPC handlers
ipcMain.handle('get-dropbox-settings', async () => {
  const settings = loadSettings()
  return {
    enabled: settings.dropboxEnabled,
    hasToken: !!settings.dropboxToken,
    tokenPreview: settings.dropboxToken ? settings.dropboxToken.substring(0, 10) + '...' : '',
    keepLocalCopy: settings.keepLocalCopy !== false,
  }
})

ipcMain.handle('set-keep-local-copy', async (event, keepLocalCopy: boolean) => {
  try {
    const settings = loadSettings()
    settings.keepLocalCopy = keepLocalCopy
    saveSettings(settings)
    console.log('[IPC] keepLocalCopy set to:', keepLocalCopy)
    return { success: true }
  } catch (error) {
    console.error('[IPC set-keep-local-copy] Error:', error)
    return { success: false, error: String(error) }
  }
})

// TeamSpeak settings and connect IPC handlers
ipcMain.handle('get-teamspeak-settings', async () => {
  const settings = loadSettings()
  return settings.teamspeak
})

ipcMain.handle('set-teamspeak-settings', async (event, teamspeakSettings: any) => {
  try {
    const settings = loadSettings()
    settings.teamspeak = { ...DEFAULT_TEAMSPEAK_SETTINGS, ...teamspeakSettings }
    saveSettings(settings)
    console.log('[IPC] TeamSpeak settings saved')
    return { success: true }
  } catch (error) {
    console.error('[IPC set-teamspeak-settings] Error:', error)
    return { success: false, error: String(error) }
  }
})

// Ensures a channel named after `locationName` exists on the configured server,
// then opens the local TeamSpeak client and joins it there.
ipcMain.handle('connect-teamspeak-channel', async (event, locationName: string) => {
  try {
    const settings = loadSettings()
    if (!settings.teamspeak.enabled) {
      return { success: false, error: 'TeamSpeak not enabled' }
    }
    const result = await ensureLocationChannel(settings.teamspeak, locationName)
    if (!result.success) {
      console.warn('[IPC connect-teamspeak-channel] Could not ensure channel:', result.error)
      return result
    }
    joinViaClientUri(settings.teamspeak, locationName)
    console.log('[IPC connect-teamspeak-channel] Joined channel:', locationName)
    return { success: true }
  } catch (error) {
    console.error('[IPC connect-teamspeak-channel] Error:', error)
    return { success: false, error: String(error) }
  }
})

// Session persistence via file storage
ipcMain.handle('save-session', async (event, sessionData: any) => {
  try {
    saveSession(sessionData)
    console.log('[Session IPC] Saved')
    return { success: true }
  } catch (err) {
    console.error('[Session IPC] Save failed:', err)
    return { success: false, error: String(err) }
  }
})

ipcMain.handle('load-session', async () => {
  try {
    const data = loadSession()
    console.log('[Session IPC] Loaded:', !!data)
    return { success: true, data }
  } catch (err) {
    console.error('[Session IPC] Load failed:', err)
    return { success: false, error: String(err) }
  }
})

ipcMain.handle('save-session-history', async (event, sessions: any, archivedSessions: any) => {
  try {
    saveSessionHistory(sessions, archivedSessions)
    console.log('[SessionHistory IPC] Saved')
    return { success: true }
  } catch (err) {
    console.error('[SessionHistory IPC] Save failed:', err)
    return { success: false, error: String(err) }
  }
})

// License / trial IPC handlers
ipcMain.handle('get-license-status', async () => {
  const settings = loadSettings()
  return getLicenseStatus(settings)
})

ipcMain.handle('open-license-purchase-page', async () => {
  shell.openExternal('https://www.snaptime.nl/license/kopen')
})

ipcMain.handle('activate-license', async (event, licenseKey: string) => {
  try {
    const result = await validateSnapTimeLicense(licenseKey)
    if (!result.valid) {
      return { success: false, error: result.error || 'Invalid license key' }
    }
    const settings = loadSettings()
    settings.licenseKey = licenseKey
    settings.licenseValid = true
    settings.licenseActivatedAt = Date.now()
    if (result.expiresAt) {
      settings.licenseExpiresAt = result.expiresAt
    }
    saveSettings(settings)
    console.log('[IPC] License activated')
    return { success: true }
  } catch (error) {
    console.error('[IPC activate-license] Error:', error)
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('set-dropbox-token', async (event, token: string) => {
  try {
    const settings = loadSettings()
    settings.dropboxToken = token
    settings.dropboxEnabled = !!token

    // Verify token works
    const tempUploader = new DropboxUploader({
      accessToken: token,
      enabled: true,
    })
    const isValid = await tempUploader.verifyConnection()

    if (!isValid) {
      return { success: false, error: 'Invalid token - could not connect to Dropbox' }
    }

    // Token is valid, save and reinitialize
    saveSettings(settings)
    dropboxUploader = new DropboxUploader({
      accessToken: token,
      enabled: true,
    })

    console.log('[IPC] Dropbox token set successfully')
    return { success: true }
  } catch (error) {
    console.error('[IPC set-dropbox-token] Error:', error)
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('disable-dropbox', async () => {
  try {
    const settings = loadSettings()
    settings.dropboxEnabled = false
    settings.dropboxToken = ''
    saveSettings(settings)

    dropboxUploader = new DropboxUploader({
      accessToken: '',
      enabled: false,
    })

    console.log('[IPC] Dropbox disabled')
    return { success: true }
  } catch (error) {
    console.error('[IPC disable-dropbox] Error:', error)
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('verify-dropbox', async () => {
  try {
    if (!dropboxUploader || !dropboxUploader.isEnabled()) {
      return { success: false, error: 'Dropbox not configured' }
    }
    const isValid = await dropboxUploader.verifyConnection()
    return { success: isValid }
  } catch (error) {
    console.error('[IPC verify-dropbox] Error:', error)
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('list-student-photos', async (event, photoDestPath, schoolName, className, studentId, sessionStartDate) => {
  try {
    const path = require('path')
    const os = require('os')
    const photoPath = photoDestPath.replace('~', os.homedir())
    let dateStr: string
    if (sessionStartDate) {
      // Convert "2026-09-05" format to "20260905"
      dateStr = sessionStartDate.replace(/-/g, '')
    } else {
      const today = new Date()
      dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`
    }
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

// Update handlers
ipcMain.handle('restart-app', () => {
  autoUpdater.quitAndInstall()
})

ipcMain.handle('check-for-updates', async () => {
  const result = await autoUpdater.checkForUpdates()
  return result
})

ipcMain.handle('read-clipboard', async () => {
  try {
    const text = clipboard.readText()
    return { success: true, text }
  } catch (error) {
    console.error('[IPC read-clipboard] Error:', error)
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('check-duplicates', async (event, schoolName: string, students: any) => {
  try {
    const duplicates: { [key: string]: Array<{ className: string; photoCount: number; student: any }> } = {}

    // Find duplicate student IDs across classes
    for (const className of Object.keys(students)) {
      for (const student of students[className] || []) {
        if (!duplicates[student.id]) {
          duplicates[student.id] = []
        }
        duplicates[student.id].push({
          className,
          photoCount: 0,
          student
        })
      }
    }

    // Filter to only show actual duplicates
    const actualDuplicates = Object.entries(duplicates)
      .filter(([id, entries]) => entries.length > 1)
      .map(([id, entries]) => ({ id, entries }))

    return { success: true, duplicates: actualDuplicates }
  } catch (error) {
    console.error('[IPC check-duplicates] Error:', error)
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('delete-student', async (event, schoolName: string, className: string, studentId: string) => {
  try {
    const photoDestPath = (process.env.PHOTO_PATH || '~/Desktop/PhotographerOutput').trim()
    // Load students
    const studentsPath = path.join(photoDestPath, schoolName, 'students.json')
    let students: any = {}
    if (fs.existsSync(studentsPath)) {
      students = JSON.parse(fs.readFileSync(studentsPath, 'utf-8'))
    }

    // Remove student
    if (students[className]) {
      students[className] = students[className].filter((s: any) => s.id !== studentId)
      fs.writeFileSync(studentsPath, JSON.stringify(students, null, 2))
    }

    return { success: true }
  } catch (error) {
    console.error('[IPC delete-student] Error:', error)
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('reload-students', async (event, schoolName: string) => {
  try {
    const photoDestPath = (process.env.PHOTO_PATH || '~/Desktop/PhotographerOutput').trim()
    const studentsPath = path.join(photoDestPath, schoolName, 'students.json')
    let students: any = {}
    if (fs.existsSync(studentsPath)) {
      students = JSON.parse(fs.readFileSync(studentsPath, 'utf-8'))
    }
    return { success: true, students }
  } catch (error) {
    console.error('[IPC reload-students] Error:', error)
    return { success: false, error: String(error) }
  }
})

import { useState, useRef, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { StudentsByClass } from '../../../types'

const DEFAULT_PHOTO_PATH = '~/Desktop/PhotographerOutput'

interface SessionRecord {
  schoolName: string
  className: string
  date: string
  photoCounts: { [id: string]: number }
  photoCount: number
}

interface Props {
  onComplete: (schoolName: string, photoPath: string, students: StudentsByClass, className?: string, isResume?: boolean, sessionStartDate?: string) => void
  sessions?: SessionRecord[]
  onFinishSession?: (index: number) => void
  archivedSessions?: SessionRecord[]
  settingsOpen: boolean
  onSettingsOpenChange: (open: boolean) => void
}

interface SavedSession {
  schoolName: string
  className: string
  photoPath: string
  students: StudentsByClass
  timestamp: number
}

interface DropboxSettings {
  enabled: boolean
  hasToken: boolean
  tokenPreview: string
  keepLocalCopy: boolean
}

interface TeamSpeakSettings {
  enabled: boolean
  host: string
  clientPort: number
  queryPort: number
  queryUser: string
  queryPassword: string
  serverId: number
}

export default function Import({ onComplete, sessions: sessionsProp = [], onFinishSession, archivedSessions: archivedProp = [], settingsOpen, onSettingsOpenChange: setSettingsOpen }: Props) {
  const [schoolName, setSchoolName] = useState('')
  const [fileName, setFileName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [nxTetherPath, setNxTetherPath] = useState('')
  const [photoDestPath, setPhotoDestPath] = useState('')
  const [debugLog, setDebugLog] = useState<string[]>([])
  const [dropboxSettings, setDropboxSettings] = useState<DropboxSettings | null>(null)
  const [dropboxToken, setDropboxToken] = useState('')
  const [dropboxVerifying, setDropboxVerifying] = useState(false)
  const [dropboxMessage, setDropboxMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showTokenInput, setShowTokenInput] = useState(false)
  const [teamspeakSettings, setTeamspeakSettings] = useState<TeamSpeakSettings | null>(null)
  const [teamspeakMessage, setTeamspeakMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [teamspeakSaving, setTeamspeakSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Load full session data for resume functionality
  useEffect(() => {
    const saved = localStorage.getItem('savedSessions')
    if (saved) {
      try {
        const loadedSessions = JSON.parse(saved)
        // Migration: add sessionStartDate and className to old sessions that don't have it
        const migratedSessions = loadedSessions.map((s: any) => {
          const updated: any = { ...s }
          if (!updated.sessionStartDate) {
            // For old sessions, derive from timestamp (rough estimate)
            const date = new Date(updated.timestamp)
            updated.sessionStartDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
          }
          if (!updated.className) {
            // Fallback if className is missing
            updated.className = 'Unknown'
          }
          return updated
        })
        setSavedSessions(migratedSessions)
        // Save migrated sessions back to localStorage
        localStorage.setItem('savedSessions', JSON.stringify(migratedSessions))
      } catch (e) {
        console.log('Could not load saved sessions')
      }
    }

    // Load path settings
    const nxPath = localStorage.getItem('nxTetherPath') || '~/Pictures/NX Tether'
    const destPath = localStorage.getItem('photoDestPath') || DEFAULT_PHOTO_PATH
    setNxTetherPath(nxPath)
    setPhotoDestPath(destPath)

    loadDropboxSettings()
    loadTeamspeakSettings()
  }, [])

  async function loadTeamspeakSettings() {
    try {
      const settings = await window.electron.ipcRenderer.invoke('get-teamspeak-settings')
      setTeamspeakSettings(settings)
    } catch (err) {
      console.error('Failed to load TeamSpeak settings:', err)
    }
  }

  async function handleSaveTeamspeakSettings() {
    if (!teamspeakSettings) return
    setTeamspeakSaving(true)
    try {
      const result = await window.electron.ipcRenderer.invoke('set-teamspeak-settings', teamspeakSettings)
      if (result.success) {
        setTeamspeakMessage({ type: 'success', text: 'TeamSpeak settings saved' })
      } else {
        setTeamspeakMessage({ type: 'error', text: result.error || 'Failed to save' })
      }
    } catch (err) {
      setTeamspeakMessage({ type: 'error', text: String(err) })
    } finally {
      setTeamspeakSaving(false)
    }
  }

  async function loadDropboxSettings() {
    try {
      const settings = await window.electron.ipcRenderer.invoke('get-dropbox-settings')
      setDropboxSettings(settings)
    } catch (err) {
      console.error('Failed to load Dropbox settings:', err)
    }
  }

  async function handleSetDropboxToken() {
    if (!dropboxToken.trim()) {
      setDropboxMessage({ type: 'error', text: 'Please enter a token' })
      return
    }

    setDropboxVerifying(true)
    try {
      const result = await window.electron.ipcRenderer.invoke('set-dropbox-token', dropboxToken)
      if (result.success) {
        setDropboxMessage({ type: 'success', text: 'Dropbox connected successfully!' })
        setDropboxToken('')
        setShowTokenInput(false)
        await loadDropboxSettings()
      } else {
        setDropboxMessage({ type: 'error', text: result.error || 'Failed to connect' })
      }
    } catch (err) {
      setDropboxMessage({ type: 'error', text: String(err) })
    } finally {
      setDropboxVerifying(false)
    }
  }

  async function handleDisableDropbox() {
    if (!confirm('Disable Dropbox upload? You can re-enable it later.')) return

    try {
      const result = await window.electron.ipcRenderer.invoke('disable-dropbox')
      if (result.success) {
        setDropboxMessage({ type: 'success', text: 'Dropbox disabled' })
        await loadDropboxSettings()
      } else {
        setDropboxMessage({ type: 'error', text: result.error || 'Failed to disable' })
      }
    } catch (err) {
      setDropboxMessage({ type: 'error', text: String(err) })
    }
  }

  async function handleVerifyDropbox() {
    setDropboxVerifying(true)
    try {
      const result = await window.electron.ipcRenderer.invoke('verify-dropbox')
      if (result.success) {
        setDropboxMessage({ type: 'success', text: 'Dropbox connection verified!' })
      } else {
        setDropboxMessage({ type: 'error', text: result.error || 'Connection failed' })
      }
    } catch (err) {
      setDropboxMessage({ type: 'error', text: String(err) })
    } finally {
      setDropboxVerifying(false)
    }
  }

  async function handleToggleKeepLocalCopy() {
    if (!dropboxSettings) return
    const newValue = !dropboxSettings.keepLocalCopy
    if (!newValue && !confirm('Photos will only be kept in Dropbox, not saved locally. Continue?')) return

    try {
      const result = await window.electron.ipcRenderer.invoke('set-keep-local-copy', newValue)
      if (result.success) {
        await loadDropboxSettings()
      } else {
        setDropboxMessage({ type: 'error', text: result.error || 'Failed to update setting' })
      }
    } catch (err) {
      setDropboxMessage({ type: 'error', text: String(err) })
    }
  }

  const handleSaveSettings = () => {
    localStorage.setItem('nxTetherPath', nxTetherPath)
    localStorage.setItem('photoDestPath', photoDestPath)
    setSettingsOpen(false)
  }

  function connectTeamspeakForLocation(locationName: string) {
    if (!teamspeakSettings?.enabled) return
    window.electron.ipcRenderer.invoke('connect-teamspeak-channel', locationName).catch((err: any) => {
      console.error('Failed to connect TeamSpeak channel:', err)
    })
  }

  const handleResume = (session: SavedSession, className: string, sessionStartDate: string) => {
    console.log('[handleResume] sessionStartDate:', sessionStartDate, 'className:', className)
    connectTeamspeakForLocation(session.schoolName)
    onComplete(session.schoolName, session.photoPath, session.students, className, true, sessionStartDate)
  }

  const handleExportAbsence = (session: SessionRecord, savedSession: SavedSession) => {
    // Get all students from school, excluding Stamgroep
    const allStudents: Array<{ id: string; firstName: string; lastName: string; prefix?: string; className: string }> = []
    const photoCounts: { [id: string]: number } = {}

    // Load photo counts from localStorage for each class
    Object.entries(savedSession.students).forEach(([className, students]) => {
      if (className.toLowerCase() === 'stamgroep') return

      const key = `photoCounts-${savedSession.schoolName}-${className}`
      const saved = localStorage.getItem(key)
      if (saved) {
        try {
          const counts = JSON.parse(saved)
          Object.assign(photoCounts, counts)
        } catch (e) {
          console.log('Could not load photo counts for', className)
        }
      }

      students.forEach(student => {
        allStudents.push({ ...student, className })
      })
    })

    // Filter students with 0 photos
    const absentStudents = allStudents.filter(student => !photoCounts[student.id] || photoCounts[student.id] === 0)

    // Create CSV
    const headers = ['ID', 'First Name', 'Prefix', 'Last Name', 'Class']
    const rows = absentStudents.map(s => [
      s.id,
      s.firstName,
      s.prefix || '',
      s.lastName,
      s.className
    ])

    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${session.schoolName}_absence_${session.date}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const parseExcelFile = (file: File): Promise<StudentsByClass> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = e.target?.result
          const workbook = XLSX.read(data, { type: 'array' })
          const sheet = workbook.Sheets[workbook.SheetNames[0]]
          const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][]

          const students: StudentsByClass = {}
          const logs: string[] = []

          // Detect if first row is header (check for ID, name, class, or Dutch variants)
          const firstRow = rows[0] || []
          const isHeader = firstRow.some(cell => {
            const lower = String(cell).toLowerCase()
            return lower.includes('id') ||
                   lower.includes('name') ||
                   lower.includes('voornaam') ||
                   lower.includes('achternaam') ||
                   lower.includes('class') ||
                   lower.includes('klas') ||
                   lower.includes('stamgroep') ||
                   lower.includes('groep')
          })
          const startRow = isHeader ? 1 : 0
          logs.push(`Header detected: ${isHeader}, starting from row ${startRow}`)

          for (let i = startRow; i < rows.length; i++) {
            const row = rows[i]
            if (!row || row.length < 4) continue

            let id = '', first = '', last = '', prefix = '', cls = ''

            // Try layout: [ID, first, prefix, last, class] - 5 columns
            if (row.length >= 5) {
              const col0 = String(row[0] || '').trim()
              const col1 = String(row[1] || '').trim()
              const col2 = String(row[2] || '').trim()
              const col3 = String(row[3] || '').trim()
              const col4 = String(row[4] || '').trim()

              if (col0 && col1 && col3 && col4) {
                id = col0
                first = col1
                prefix = col2
                last = col3
                cls = col4
              }
            }

            // Fallback: [ID, first, last, class] - 4 columns
            if (!cls && row.length >= 4) {
              const col0 = String(row[0] || '').trim()
              const col1 = String(row[1] || '').trim()
              const col2 = String(row[2] || '').trim()
              const col3 = String(row[3] || '').trim()

              if (col0 && col1 && col2 && col3) {
                id = col0
                first = col1
                last = col2
                cls = col3
              }
            }

            if (!id || !first || !last || !cls) continue
            if (i < startRow + 3) logs.push(`Row ${i}: id=${id}, first=${first}, prefix=${prefix}, last=${last}, cls=${cls}`)
            if (!students[cls]) students[cls] = []
            students[cls].push({ id, firstName: first, lastName: last, prefix: prefix || undefined })
          }

          setDebugLog(logs)

          Object.keys(students).forEach(c => {
            students[c].sort((a, b) => a.firstName.localeCompare(b.firstName))
          })

          resolve(students)
        } catch (err) {
          reject(err)
        }
      }
      reader.readAsArrayBuffer(file)
    })
  }

  const handleImport = async () => {
    if (!schoolName.trim()) {
      setError('School name required')
      return
    }

    setLoading(true)
    setError('')

    try {
      let students: StudentsByClass = {}

      // If file provided, parse it
      const file = fileRef.current?.files?.[0]
      if (file) {
        students = await parseExcelFile(file)
        if (Object.keys(students).length === 0) {
          throw new Error('No valid student data found in file')
        }
      } else {
        // Test mode: create dummy students if no file
        students = {
          '1A': [
            { id: '001', firstName: 'John', lastName: 'Doe' },
            { id: '002', firstName: 'Jane', lastName: 'Smith' },
          ],
          '1B': [
            { id: '003', firstName: 'Bob', lastName: 'Johnson' },
            { id: '004', firstName: 'Alice', lastName: 'Brown' },
          ],
        }
      }

      // Save session for resume functionality
      const newSession: SavedSession = {
        schoolName,
        photoPath: DEFAULT_PHOTO_PATH,
        students,
        timestamp: Date.now()
      }
      const updated = [...savedSessions, newSession]
      localStorage.setItem('savedSessions', JSON.stringify(updated))

      connectTeamspeakForLocation(schoolName)
      onComplete(schoolName, DEFAULT_PHOTO_PATH, students)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <div className="card">
        {settingsOpen && (
          <div style={{ background: '#f9fafb', padding: '16px', borderRadius: '8px', marginBottom: '16px', border: '1px solid #e5e7eb' }}>
            <h3 style={{ marginTop: 0, marginBottom: '12px', fontSize: '14px' }}>Camera & Storage Paths</h3>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px' }}>NX Tether Source Path:</label>
              <input
                type="text"
                value={nxTetherPath}
                onChange={(e) => setNxTetherPath(e.target.value)}
                style={{ width: '100%', padding: '8px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '6px' }}
                placeholder="~/Pictures/NX Tether"
              />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px' }}>Photos Save Path:</label>
              <input
                type="text"
                value={photoDestPath}
                onChange={(e) => setPhotoDestPath(e.target.value)}
                style={{ width: '100%', padding: '8px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '6px' }}
                placeholder="~/Desktop/PhotographerOutput"
              />
            </div>
            <button
              onClick={handleSaveSettings}
              style={{
                background: '#3b82f6',
                color: 'white',
                padding: '8px 16px',
                fontSize: '12px',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              Save Settings
            </button>

            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
              <h3 style={{ marginTop: 0, marginBottom: '12px', fontSize: '14px' }}>Cloud Storage</h3>

              {dropboxSettings ? (
                <div style={{ background: 'white', padding: '12px', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ fontWeight: 600, color: '#1f2937', fontSize: '12px' }}>Dropbox Upload</label>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                      Status: {dropboxSettings.enabled ? (
                        <span style={{ color: '#10b981' }}>✓ Connected</span>
                      ) : (
                        <span style={{ color: '#ef4444' }}>Not configured</span>
                      )}
                    </div>
                  </div>

                  {dropboxSettings.enabled ? (
                    <div>
                      <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '12px' }}>
                        Photos will be automatically uploaded to Dropbox: /SnapTime/SchoolName_YYYYMMDD/ClassName/
                      </p>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={handleVerifyDropbox}
                          disabled={dropboxVerifying}
                          style={{
                            padding: '8px 12px',
                            background: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: dropboxVerifying ? 'not-allowed' : 'pointer',
                            fontSize: '12px',
                            fontWeight: 600,
                            opacity: dropboxVerifying ? 0.6 : 1,
                          }}
                        >
                          {dropboxVerifying ? 'Verifying...' : 'Verify Connection'}
                        </button>
                        <button
                          onClick={handleDisableDropbox}
                          style={{
                            padding: '8px 12px',
                            background: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: 600,
                          }}
                        >
                          Disconnect
                        </button>
                      </div>

                      <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e5e7eb' }}>
                        <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>
                          Local storage: {dropboxSettings.keepLocalCopy ? (
                            <span style={{ color: '#10b981' }}>On (photos kept on this computer + Dropbox)</span>
                          ) : (
                            <span style={{ color: '#f59e0b' }}>Off (Dropbox only)</span>
                          )}
                        </div>
                        <button
                          onClick={handleToggleKeepLocalCopy}
                          style={{
                            padding: '8px 12px',
                            background: dropboxSettings.keepLocalCopy ? '#6b7280' : '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: 600,
                          }}
                        >
                          {dropboxSettings.keepLocalCopy ? 'Disable Local Storage' : 'Enable Local Storage'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '12px' }}>
                        Enable Dropbox to automatically upload photos to your Dropbox account. Photos will be organized by school and class.
                      </p>

                      {!showTokenInput ? (
                        <button
                          onClick={() => setShowTokenInput(true)}
                          style={{
                            padding: '8px 12px',
                            background: '#1f2937',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: 600,
                          }}
                        >
                          Connect Dropbox
                        </button>
                      ) : (
                        <div style={{ background: '#f9fafb', padding: '12px', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                          <div style={{ marginBottom: '12px' }}>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px' }}>
                              Dropbox Access Token
                            </label>
                            <input
                              type="password"
                              placeholder="Paste your Dropbox access token here"
                              value={dropboxToken}
                              onChange={(e) => setDropboxToken(e.target.value)}
                              style={{
                                width: '100%',
                                padding: '8px',
                                fontSize: '12px',
                                border: '1px solid #d1d5db',
                                borderRadius: '4px',
                                boxSizing: 'border-box',
                                fontFamily: 'monospace',
                              }}
                            />
                            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '6px' }}>
                              Get token at: <a href="https://www.dropbox.com/developers/apps" target="_blank" style={{ color: '#3b82f6' }}>dropbox.com/developers/apps</a>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              onClick={handleSetDropboxToken}
                              disabled={dropboxVerifying || !dropboxToken.trim()}
                              style={{
                                flex: 1,
                                padding: '8px',
                                background: '#10b981',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: dropboxVerifying ? 'not-allowed' : 'pointer',
                                fontSize: '12px',
                                fontWeight: 600,
                                opacity: dropboxVerifying || !dropboxToken.trim() ? 0.6 : 1,
                              }}
                            >
                              {dropboxVerifying ? 'Connecting...' : 'Connect'}
                            </button>
                            <button
                              onClick={() => {
                                setShowTokenInput(false)
                                setDropboxToken('')
                              }}
                              style={{
                                flex: 1,
                                padding: '8px',
                                background: '#6b7280',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: 600,
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: '#9ca3af', padding: '16px', fontSize: '12px' }}>
                  Loading settings...
                </div>
              )}

              {dropboxMessage && (
                <div
                  style={{
                    marginTop: '12px',
                    padding: '10px',
                    borderRadius: '6px',
                    background: dropboxMessage.type === 'success' ? '#d1fae5' : '#fee2e2',
                    color: dropboxMessage.type === 'success' ? '#065f46' : '#991b1b',
                    fontSize: '12px',
                  }}
                >
                  {dropboxMessage.text}
                </div>
              )}
            </div>

            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
              <h3 style={{ marginTop: 0, marginBottom: '12px', fontSize: '14px' }}>TeamSpeak Intercom</h3>

              {teamspeakSettings ? (
                <div style={{ background: 'white', padding: '12px', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 600, marginBottom: '12px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={teamspeakSettings.enabled}
                      onChange={(e) => setTeamspeakSettings({ ...teamspeakSettings, enabled: e.target.checked })}
                    />
                    Enable auto-connect to TeamSpeak channel per location
                  </label>

                  <div style={{ marginBottom: '10px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px' }}>Server Host</label>
                    <input
                      type="text"
                      value={teamspeakSettings.host}
                      onChange={(e) => setTeamspeakSettings({ ...teamspeakSettings, host: e.target.value })}
                      placeholder="ts.example.com"
                      style={{ width: '100%', padding: '8px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '4px', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px' }}>Client (Voice) Port</label>
                      <input
                        type="number"
                        value={teamspeakSettings.clientPort}
                        onChange={(e) => setTeamspeakSettings({ ...teamspeakSettings, clientPort: Number(e.target.value) })}
                        style={{ width: '100%', padding: '8px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '4px', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px' }}>ServerQuery Port</label>
                      <input
                        type="number"
                        value={teamspeakSettings.queryPort}
                        onChange={(e) => setTeamspeakSettings({ ...teamspeakSettings, queryPort: Number(e.target.value) })}
                        style={{ width: '100%', padding: '8px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '4px', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px' }}>ServerQuery User</label>
                      <input
                        type="text"
                        value={teamspeakSettings.queryUser}
                        onChange={(e) => setTeamspeakSettings({ ...teamspeakSettings, queryUser: e.target.value })}
                        style={{ width: '100%', padding: '8px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '4px', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px' }}>ServerQuery Password</label>
                      <input
                        type="password"
                        value={teamspeakSettings.queryPassword}
                        onChange={(e) => setTeamspeakSettings({ ...teamspeakSettings, queryPassword: e.target.value })}
                        style={{ width: '100%', padding: '8px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '4px', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>

                  <p style={{ fontSize: '11px', color: '#6b7280', marginBottom: '12px' }}>
                    When enabled, starting or resuming a session auto-creates (or joins) a TeamSpeak channel named after the school, and opens your local TeamSpeak client into it.
                  </p>

                  <button
                    onClick={handleSaveTeamspeakSettings}
                    disabled={teamspeakSaving}
                    style={{
                      padding: '8px 16px',
                      background: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: teamspeakSaving ? 'not-allowed' : 'pointer',
                      fontSize: '12px',
                      fontWeight: 600,
                      opacity: teamspeakSaving ? 0.6 : 1,
                    }}
                  >
                    {teamspeakSaving ? 'Saving...' : 'Save TeamSpeak Settings'}
                  </button>
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: '#9ca3af', padding: '16px', fontSize: '12px' }}>
                  Loading settings...
                </div>
              )}

              {teamspeakMessage && (
                <div
                  style={{
                    marginTop: '12px',
                    padding: '10px',
                    borderRadius: '6px',
                    background: teamspeakMessage.type === 'success' ? '#d1fae5' : '#fee2e2',
                    color: teamspeakMessage.type === 'success' ? '#065f46' : '#991b1b',
                    fontSize: '12px',
                  }}
                >
                  {teamspeakMessage.text}
                </div>
              )}
            </div>

            <button
              onClick={() => setSettingsOpen(false)}
              style={{
                marginTop: '20px',
                width: '100%',
                background: '#1f2937',
                color: 'white',
                padding: '10px',
                fontSize: '12px',
                fontWeight: 600,
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              ✕ Close Settings
            </button>
          </div>
        )}

        {(sessionsProp?.length || 0) > 0 && (
          <div>
            <h2>Previous Sessions</h2>
            <div className="sessions-list">
              {sessionsProp?.map((s, i) => {
                const savedSession = savedSessions.find(ss => ss.schoolName === s.schoolName && ss.className === s.className)
                if (!savedSession) return null
                return (
                <div key={i} className="btn-session" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button
                    onClick={() => savedSession && handleResume(savedSession, s.className, savedSession.sessionStartDate)}
                    style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                  >
                    <div className="session-name">{s.schoolName} - {s.className}</div>
                    <div className="session-date">{s.date}</div>
                  </button>
                  <button
                    onClick={() => savedSession && handleExportAbsence(s, savedSession)}
                    style={{
                      background: '#f59e0b',
                      color: 'white',
                      padding: '6px 12px',
                      fontSize: '12px',
                      borderRadius: '4px',
                      border: 'none',
                      cursor: 'pointer',
                      marginLeft: '12px',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    Export Absence
                  </button>
                  <button
                    onClick={() => onFinishSession?.(i)}
                    style={{
                      background: '#10b981',
                      color: 'white',
                      padding: '6px 12px',
                      fontSize: '12px',
                      borderRadius: '4px',
                      border: 'none',
                      cursor: 'pointer',
                      marginLeft: '8px',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    Finish
                  </button>
                </div>
              )
              })}
            </div>
            <p style={{ marginTop: '20px', textAlign: 'center' }}>— OR —</p>
          </div>
        )}

        {(archivedProp?.length || 0) > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <button
              onClick={() => setHistoryOpen(!historyOpen)}
              style={{
                width: '100%',
                padding: '12px',
                background: '#f3f4f6',
                color: '#000000',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600,
                textAlign: 'left',
                fontSize: '14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <span>History ({archivedProp?.length || 0})</span>
              <span>{historyOpen ? '▼' : '▶'}</span>
            </button>
            {historyOpen && (
              <div className="sessions-list">
                {archivedProp?.map((s, i) => {
                  const savedSession = savedSessions.find(ss => ss.schoolName === s.schoolName)
                  return (
                  <div key={`archived-${i}`} className="btn-session" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.7 }}>
                    <button
                      onClick={() => savedSession && handleResume(savedSession, s.className, savedSession.sessionStartDate)}
                      style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                    >
                      <div className="session-name">{s.schoolName} - {s.className}</div>
                      <div className="session-date">{s.date}</div>
                    </button>
                  </div>
                )
                })}
              </div>
            )}
          </div>
        )}

        <h2>New Session</h2>
        <input
          type="text"
          placeholder="School name"
          value={schoolName}
          onChange={(e) => setSchoolName(e.target.value)}
        />
        <input
          type="file"
          ref={fileRef}
          accept=".xlsx,.xls,.csv"
          onChange={(e) => setFileName(e.target.files?.[0]?.name || '')}
        />
        {error && <p className="error">{error}</p>}
        <button onClick={handleImport} disabled={loading}>
          {loading ? 'Importing...' : 'Start New'}
        </button>
        {debugLog.length > 0 && (
          <div style={{ background: '#f3f4f6', padding: '12px', borderRadius: '6px', marginTop: '16px', fontSize: '12px', fontFamily: 'monospace', maxHeight: '200px', overflowY: 'auto' }}>
            <div style={{ fontWeight: 600, marginBottom: '8px' }}>Debug Log:</div>
            {debugLog.map((log, i) => (
              <div key={i}>{log}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

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
  onComplete: (schoolName: string, photoPath: string, students: StudentsByClass, className?: string) => void
  sessions?: SessionRecord[]
  onFinishSession?: (index: number) => void
  archivedSessions?: SessionRecord[]
}

interface SavedSession {
  schoolName: string
  photoPath: string
  students: StudentsByClass
  timestamp: number
}

export default function Import({ onComplete, sessions: sessionsProp = [], onFinishSession, archivedSessions: archivedProp = [] }: Props) {
  const [schoolName, setSchoolName] = useState('')
  const [fileName, setFileName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [nxTetherPath, setNxTetherPath] = useState('')
  const [photoDestPath, setPhotoDestPath] = useState('')
  const [debugLog, setDebugLog] = useState<string[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  // Load full session data for resume functionality
  useEffect(() => {
    const saved = localStorage.getItem('savedSessions')
    if (saved) {
      try {
        setSavedSessions(JSON.parse(saved))
      } catch (e) {
        console.log('Could not load saved sessions')
      }
    }

    // Load path settings
    const nxPath = localStorage.getItem('nxTetherPath') || '~/Pictures/NX Tether'
    const destPath = localStorage.getItem('photoDestPath') || DEFAULT_PHOTO_PATH
    setNxTetherPath(nxPath)
    setPhotoDestPath(destPath)
  }, [])



  const handleSaveSettings = () => {
    localStorage.setItem('nxTetherPath', nxTetherPath)
    localStorage.setItem('photoDestPath', photoDestPath)
    setSettingsOpen(false)
  }

  const handleResume = (session: SavedSession, className: string) => {
    onComplete(session.schoolName, session.photoPath, session.students, undefined, true)
  }

  const handleExportAbsence = (session: SessionRecord, savedSession: SavedSession) => {
    // Get all students from school, excluding Stamgroep
    const allStudents: Array<{ id: string; firstName: string; lastName: string; prefix?: string; className: string }> = []
    Object.entries(savedSession.students).forEach(([className, students]) => {
      if (className.toLowerCase() === 'stamgroep') return
      students.forEach(student => {
        allStudents.push({ ...student, className })
      })
    })

    // Filter students with 0 photos
    const absentStudents = allStudents.filter(student => !session.photoCounts[student.id] || session.photoCounts[student.id] === 0)

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
        <button
          onClick={() => setSettingsOpen(!settingsOpen)}
          style={{
            alignSelf: 'flex-end',
            background: '#e5e7eb',
            color: '#000000',
            border: 'none',
            padding: '8px 12px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '12px',
            marginBottom: '16px',
            fontWeight: 500
          }}
        >
          ⚙️ Settings
        </button>

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
          </div>
        )}

        {(sessionsProp?.length || 0) > 0 && (
          <div>
            <h2>Previous Sessions</h2>
            <div className="sessions-list">
              {sessionsProp?.map((s, i) => {
                const savedSession = savedSessions.find(ss => ss.schoolName === s.schoolName)
                console.log(`Session ${i}: schoolName="${s.schoolName}", found=${!!savedSession}, totalSaved=${savedSessions.length}`)
                return (
                <div key={i} className="btn-session" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button
                    onClick={() => savedSession && handleResume(savedSession, s.className)}
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
                      onClick={() => savedSession && handleResume(savedSession, s.className)}
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

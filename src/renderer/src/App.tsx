import { useState, useEffect } from 'react'
import Import from './pages/Import'
import ClassSelect from './pages/ClassSelect'
import StudentCapture from './pages/StudentCapture'
import DuplicatesChecker from './pages/DuplicatesChecker'
import LicenseGate from './pages/LicenseGate'
import { StudentsByClass } from '../../types'
import logo from './assets/snaptime-logo.png'
import './styles/app.css'

type Screen = 'import' | 'classes' | 'capture' | 'duplicates'

interface SessionRecord {
  schoolName: string
  className: string
  date: string
  sessionStartDate: string
  photoCounts: { [id: string]: number }
  photoCount: number
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('import')
  const [schoolName, setSchoolName] = useState('')
  const [photoPath, setPhotoPath] = useState('')
  const [students, setStudents] = useState<StudentsByClass>({})
  const [selectedClass, setSelectedClass] = useState('')
  const [sessionStartDate, setSessionStartDate] = useState('')
  const [sessions, setSessions] = useState<SessionRecord[]>([])
  const [archivedSessions, setArchivedSessions] = useState<SessionRecord[]>([])
  const [isResuming, setIsResuming] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [autoSelectStudentId, setAutoSelectStudentId] = useState<string | null>(null)
  const [licenseAllowed, setLicenseAllowed] = useState<boolean | null>(null)
  const [licenseValid, setLicenseValid] = useState(false)
  const [licenseExpired, setLicenseExpired] = useState(false)
  const [licenseKey, setLicenseKey] = useState('')
  const [licenseExpiresAt, setLicenseExpiresAt] = useState<number | null>(null)
  const [trialDaysLeft, setTrialDaysLeft] = useState(0)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [showLicenseModal, setShowLicenseModal] = useState(false)
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [updateDownloaded, setUpdateDownloaded] = useState(false)

  const refreshLicenseStatus = () => {
    window.electron.ipcRenderer.invoke('get-license-status').then((status: any) => {
      setLicenseAllowed(status.allowed)
      setLicenseValid(status.licenseValid)
      setLicenseExpired(status.licenseExpired)
      setLicenseKey(status.licenseKey)
      setLicenseExpiresAt(status.licenseExpiresAt)
      setTrialDaysLeft(status.daysLeft)
    }).catch((err: any) => {
      console.error('[App] License status check failed:', err)
      setLicenseAllowed(false)
    })
  }

  useEffect(() => {
    console.log('[App] Mounting, window.electron:', !!window.electron)
    refreshLicenseStatus()

    if (window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.on('open-settings', () => {
        setScreen('import')
        setSettingsOpen(true)
      })
      window.electron.ipcRenderer.on('open-license', () => {
        setShowLicenseModal(true)
      })
      window.electron.ipcRenderer.on('open-duplicates-checker', () => {
        setScreen('duplicates')
      })
      window.electron.ipcRenderer.on('update-available', () => {
        setUpdateAvailable(true)
      })
      window.electron.ipcRenderer.on('update-downloaded', () => {
        setUpdateDownloaded(true)
      })
    } else {
      console.error('[App] window.electron not available!')
    }
  }, [])

  // Load session from localStorage - skip corrupted old sessions
  useEffect(() => {
    // Filter out corrupted sessions on first load
    let savedSessions = localStorage.getItem('savedSessions')
    if (savedSessions) {
      try {
        const sessions = JSON.parse(savedSessions)
        const validSessions = sessions.filter((s: any) => {
          const keys = Object.keys(s.students || {})
          return !keys.some(k => !k.match(/^[0-9]/) && k !== 'Stamgroep')
        })
        if (validSessions.length !== sessions.length) {
          // Only remove corrupted sessions, keep valid ones
          localStorage.setItem('savedSessions', JSON.stringify(validSessions))
        }
      } catch (e) {
        // If can't parse, remove corrupted data
        localStorage.removeItem('savedSessions')
      }
    }

    const saved = localStorage.getItem('session')
    console.log('[Session Load] Found saved session:', !!saved)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        const { screen: s, schoolName: sn, photoPath: pp, students: st, selectedClass: sc } = parsed
        console.log('[Session Load] Parsed:', { screen: s, schoolName: sn, selectedClass: sc, hasStudents: !!st, classCount: Object.keys(st || {}).length })
        if (st && Object.keys(st).length > 0) {
          console.log('[Session Load] Restoring session')
          setSchoolName(sn || '')
          setPhotoPath(pp || '')
          setStudents(st)
          setSelectedClass(sc || '')
        }
      } catch (e) {
        console.log('Could not restore session', e)
      }
    }

    const sessionsList = localStorage.getItem('sessions')
    const savedSessionsList = localStorage.getItem('savedSessions')
    let oldSavedSessions: any[] = []
    try {
      if (savedSessionsList) {
        oldSavedSessions = JSON.parse(savedSessionsList)
      }
    } catch (e) {
      // ignore
    }

    if (sessionsList) {
      try {
        const loadedSessions = JSON.parse(sessionsList)
        // Migration: add sessionStartDate to old sessions that don't have it
        const migratedSessions = loadedSessions.map((s: any) => {
          if (!s.sessionStartDate) {
            let sessionStartDate = s.date
            if (!sessionStartDate) {
              // Try to find matching savedSession to get timestamp
              const matching = oldSavedSessions.find(ss => ss.schoolName === s.schoolName && ss.className === s.className)
              if (matching && matching.timestamp) {
                const date = new Date(matching.timestamp)
                sessionStartDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
              }
            }
            return { ...s, sessionStartDate }
          }
          return s
        })
        setSessions(migratedSessions)
        // Save migrated sessions back to localStorage
        localStorage.setItem('sessions', JSON.stringify(migratedSessions))
      } catch (e) {
        console.log('Could not load session history')
      }
    }

    const savedArchived = localStorage.getItem('archivedSessions')
    if (savedArchived) {
      try {
        setArchivedSessions(JSON.parse(savedArchived))
      } catch (e) {
        console.log('Could not load archived sessions')
      }
    }
  }, [])

  // Save session to localStorage
  useEffect(() => {
    const sessionData = {
      screen, schoolName, photoPath, students, selectedClass
    }
    console.log('[Session Save]', { screen, schoolName, selectedClass, studentsCount: Object.keys(students).length })
    localStorage.setItem('session', JSON.stringify(sessionData))
  }, [screen, schoolName, photoPath, students, selectedClass])

  const handleImport = (school: string, path: string, data: StudentsByClass, className?: string, isResume?: boolean, startDate?: string) => {
    setSchoolName(school)
    setPhotoPath(path)
    setStudents(data)

    // If className provided, it's a resume - go straight to capture
    if (className) {
      setSelectedClass(className)
      setSessionStartDate(startDate || new Date().toISOString().split('T')[0])
      setIsResuming(true)
      setScreen('capture')
    } else {
      // Go to class select
      setSelectedClass('')
      setSessionStartDate('')
      setIsResuming(isResume ?? false)
      setScreen('classes')
    }
  }

  const handleClassSelect = (cls: string, updatedStudents?: StudentsByClass, autoSelectStudentId?: string) => {
    setSelectedClass(cls)
    setAutoSelectStudentId(autoSelectStudentId || null)

    // Update students if passed from ClassSelect
    if (updatedStudents) {
      setStudents(updatedStudents)
    }

    // Only create new session if not resuming
    if (!isResuming) {
      // Save this session to history when class is selected (session starts)
      const today = new Date()
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      setSessionStartDate(dateStr)
      const newSession: SessionRecord = {
        schoolName,
        className: cls,
        date: dateStr,
        sessionStartDate: dateStr,
        photoCounts: {},
        photoCount: 0
      }

      // Keep only latest session per school (remove older ones for same school)
      const updated = sessions.filter(s => s.schoolName !== schoolName)
      updated.push(newSession)
      setSessions(updated)
      localStorage.setItem('sessions', JSON.stringify(updated))

      // Also save full session data for resume
      interface SavedSession {
        schoolName: string
        className: string
        photoPath: string
        students: StudentsByClass
        timestamp: number
      }
      const savedSession: SavedSession = {
        schoolName,
        className: cls,
        photoPath,
        students: updatedStudents || students,
        timestamp: Date.now()
      }
      const saved = localStorage.getItem('savedSessions')
      const allSaved = saved ? JSON.parse(saved) : []
      // Keep only latest saved session per school
      const filtered = allSaved.filter((s: SavedSession) => s.schoolName !== schoolName)
      filtered.push(savedSession)
      localStorage.setItem('savedSessions', JSON.stringify(filtered))
    }

    setScreen('capture')
  }

  const handleUpdateStudent = (oldStudent: Student, newClassName: string, updatedStudent: Student) => {
    // Update students data structure if class changed
    if (newClassName !== selectedClass) {
      const updatedStudentsData = { ...students }

      // Remove from old class
      updatedStudentsData[selectedClass] = updatedStudentsData[selectedClass].filter(s => s.id !== oldStudent.id)

      // Add to new class
      if (!updatedStudentsData[newClassName]) {
        updatedStudentsData[newClassName] = []
      }
      updatedStudentsData[newClassName] = updatedStudentsData[newClassName].filter(s => s.id !== updatedStudent.id)
      updatedStudentsData[newClassName].push(updatedStudent)

      setStudents(updatedStudentsData)

      // Move photo counts too
      const oldKey = `photoCounts-${schoolName}-${selectedClass}`
      const newKey = `photoCounts-${schoolName}-${newClassName}`
      const oldCounts = localStorage.getItem(oldKey)
      if (oldCounts) {
        const counts = JSON.parse(oldCounts)
        if (counts[oldStudent.id]) {
          const newCounts = JSON.parse(localStorage.getItem(newKey) || '{}')
          newCounts[updatedStudent.id] = counts[oldStudent.id]
          delete counts[oldStudent.id]
          localStorage.setItem(oldKey, JSON.stringify(counts))
          localStorage.setItem(newKey, JSON.stringify(newCounts))
        }
      }
    } else {
      // Same class, just update name
      const updatedStudentsData = { ...students }
      updatedStudentsData[selectedClass] = updatedStudentsData[selectedClass].map(s =>
        s.id === updatedStudent.id ? updatedStudent : s
      )
      setStudents(updatedStudentsData)
    }
  }

  const handleBack = () => {
    setScreen(screen === 'capture' ? 'classes' : 'import')
  }

  const handleFinishSession = (index: number) => {
    const session = sessions[index]
    const updated = sessions.filter((_, i) => i !== index)
    setSessions(updated)
    localStorage.setItem('sessions', JSON.stringify(updated))

    // Move to archived
    const newArchived = [...archivedSessions, session]
    setArchivedSessions(newArchived)
    localStorage.setItem('archivedSessions', JSON.stringify(newArchived))
  }

  if (licenseAllowed === false) {
    return (
      <LicenseGate
        daysLeft={trialDaysLeft}
        licenseExpired={licenseExpired}
        onActivated={() => refreshLicenseStatus()}
      />
    )
  }

  if (licenseAllowed === null) {
    return (
      <div className="app">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
          <div style={{ textAlign: 'center' }}>
            <h2>SnapTime Local</h2>
            <p style={{ color: '#6b7280' }}>Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      {(updateAvailable || updateDownloaded) && (
        <div style={{
          background: updateDownloaded ? '#10b981' : '#f59e0b',
          color: 'white',
          padding: '12px 16px',
          textAlign: 'center',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px'
        }}>
          <span>
            {updateDownloaded
              ? '✓ Update ready. Restart to install.'
              : '↓ Update available. Downloading...'}
          </span>
          {updateDownloaded && (
            <button
              onClick={() => window.electron.ipcRenderer.invoke('restart-app')}
              style={{
                background: 'rgba(255,255,255,0.3)',
                border: 'none',
                color: 'white',
                padding: '4px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600
              }}
            >
              Restart Now
            </button>
          )}
        </div>
      )}
      <header className="header" style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <img src={logo} alt="SnapTime Local" className="logo" />
          <h1 style={{ margin: 0 }}>SnapTime Local</h1>
        </div>

        {(screen === 'capture' || screen === 'classes') && schoolName && (
          <div style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#fff7ed',
            border: '3px solid #f59e0b',
            borderRadius: '12px',
            padding: '8px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            whiteSpace: 'nowrap'
          }}>
            <div style={{ fontSize: selectedClass ? '14px' : '24px', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '1px', margin: 0, transition: 'font-size 0.2s' }}>
              {schoolName}
            </div>
            {selectedClass && screen !== 'classes' && (
              <div style={{ fontSize: '32px', fontWeight: 700, color: '#1f2937', margin: 0 }}>
                {selectedClass}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginLeft: 'auto' }}>
          {!licenseValid && (
            <button
              onClick={() => setShowLicenseModal(true)}
              style={{
                background: '#fef3c7',
                color: '#92400e',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              {licenseExpired ? 'License Expired' : `Trial: ${trialDaysLeft} day${trialDaysLeft === 1 ? '' : 's'} left`}
            </button>
          )}
          {screen !== 'import' && (
            <button onClick={handleBack} className="back-header-btn">
              ← Back
            </button>
          )}
        </div>
      </header>


      <main className="main">
        {screen === 'import' && <Import onComplete={handleImport} sessions={sessions} onFinishSession={handleFinishSession} archivedSessions={archivedSessions} settingsOpen={settingsOpen} onSettingsOpenChange={setSettingsOpen} />}
        {screen === 'classes' && <ClassSelect classes={Object.keys(students)} schoolName={schoolName} students={students} onSelect={handleClassSelect} onBack={handleBack} />}
        {screen === 'capture' && students[selectedClass] && <StudentCapture students={students[selectedClass]} schoolName={schoolName} className={selectedClass} photoPath={photoPath} sessionStartDate={sessionStartDate} autoSelectStudentId={autoSelectStudentId} onUpdateStudent={handleUpdateStudent} />}
        {screen === 'duplicates' && <DuplicatesChecker schoolName={schoolName} students={students} onClose={() => setScreen('import')} />}
      </main>

      {showLicenseModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <LicenseGate
            daysLeft={trialDaysLeft}
            licenseValid={licenseValid}
            licenseExpired={licenseExpired}
            licenseKey={licenseKey}
            licenseExpiresAt={licenseExpiresAt}
            onActivated={() => {
              refreshLicenseStatus()
              setShowLicenseModal(false)
            }}
            onCancel={() => setShowLicenseModal(false)}
          />
        </div>
      )}
    </div>
  )
}

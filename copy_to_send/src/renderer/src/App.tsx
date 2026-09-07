import { useState, useEffect } from 'react'
import Import from './pages/Import'
import ClassSelect from './pages/ClassSelect'
import StudentCapture from './pages/StudentCapture'
import { StudentsByClass } from '../../types'
import logo from './assets/snaptime-logo.png'
import './styles/app.css'

type Screen = 'import' | 'classes' | 'capture'

interface SessionRecord {
  schoolName: string
  className: string
  date: string
  photoCounts: { [id: string]: number }
  photoCount: number
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('import')
  const [schoolName, setSchoolName] = useState('')
  const [photoPath, setPhotoPath] = useState('')
  const [students, setStudents] = useState<StudentsByClass>({})
  const [selectedClass, setSelectedClass] = useState('')
  const [sessions, setSessions] = useState<SessionRecord[]>([])
  const [archivedSessions, setArchivedSessions] = useState<SessionRecord[]>([])
  const [isResuming, setIsResuming] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

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
    if (saved) {
      try {
        const { screen: s, schoolName: sn, photoPath: pp, students: st, selectedClass: sc } = JSON.parse(saved)
        // Only restore if students has valid class names (not last names)
        const hasValidClasses = Object.keys(st).some(k => /^[0-9]/.test(k) || k === 'Stamgroep')
        if (hasValidClasses) {
          setSchoolName(sn)
          setPhotoPath(pp)
          setStudents(st)
          setSelectedClass(sc)
        }
      } catch (e) {
        console.log('Could not restore session')
      }
    }

    const sessionsList = localStorage.getItem('sessions')
    if (sessionsList) {
      try {
        setSessions(JSON.parse(sessionsList))
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
    localStorage.setItem('session', JSON.stringify({
      screen, schoolName, photoPath, students, selectedClass
    }))
  }, [screen, schoolName, photoPath, students, selectedClass])

  const handleImport = (school: string, path: string, data: StudentsByClass, className?: string, isResume?: boolean) => {
    setSchoolName(school)
    setPhotoPath(path)
    setStudents(data)

    // If className provided, it's a resume - go straight to capture
    if (className) {
      setSelectedClass(className)
      setIsResuming(true)
      setScreen('capture')
    } else {
      // Go to class select
      setSelectedClass('')
      setIsResuming(isResume ?? false)
      setScreen('classes')
    }
  }

  const handleClassSelect = (cls: string, updatedStudents?: StudentsByClass) => {
    setSelectedClass(cls)

    // Update students if passed from ClassSelect
    if (updatedStudents) {
      setStudents(updatedStudents)
    }

    // Only create new session if not resuming
    if (!isResuming) {
      // Save this session to history when class is selected (session starts)
      const today = new Date()
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      const newSession: SessionRecord = {
        schoolName,
        className: cls,
        date: dateStr,
        photoCounts: {},
        photoCount: 0
      }
      const updated = [...sessions, newSession]
      setSessions(updated)
      localStorage.setItem('sessions', JSON.stringify(updated))

      // Also save full session data for resume
      interface SavedSession {
        schoolName: string
        photoPath: string
        students: StudentsByClass
        timestamp: number
      }
      const savedSession: SavedSession = {
        schoolName,
        photoPath,
        students: updatedStudents || students,
        timestamp: Date.now()
      }
      const saved = localStorage.getItem('savedSessions')
      const allSaved = saved ? JSON.parse(saved) : []
      allSaved.push(savedSession)
      localStorage.setItem('savedSessions', JSON.stringify(allSaved))
    }

    setScreen('capture')
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

  return (
    <div className="app">
      <header className="header">
        <img src={logo} alt="SnapTime Local" className="logo" />
        <h1>SnapTime Local</h1>
        {screen !== 'import' && schoolName && (
          <p style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937' }}>
            SCHOOL : <span style={{ textTransform: 'uppercase' }}>{schoolName}</span>
            {selectedClass && <span style={{ marginLeft: '16px' }}>CLASS : <span style={{ textTransform: 'uppercase' }}>{selectedClass}</span></span>}
          </p>
        )}
        {screen !== 'import' && (
          <button onClick={handleBack} className="back-header-btn">
            ← Back
          </button>
        )}
      </header>


      <main className="main">
        {screen === 'import' && <Import onComplete={handleImport} sessions={sessions} onFinishSession={handleFinishSession} archivedSessions={archivedSessions} />}
        {screen === 'classes' && <ClassSelect classes={Object.keys(students)} schoolName={schoolName} students={students} onSelect={handleClassSelect} onBack={handleBack} />}
        {screen === 'capture' && students[selectedClass] && <StudentCapture students={students[selectedClass]} schoolName={schoolName} className={selectedClass} photoPath={photoPath} />}
      </main>
    </div>
  )
}

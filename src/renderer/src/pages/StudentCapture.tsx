import { useState, useEffect, useRef } from 'react'
import { Student } from '../../../types'

interface Props {
  students: Student[]
  schoolName: string
  className: string
  photoPath: string
  sessionStartDate: string
  autoSelectStudentId?: string | null
  onUpdateStudent?: (oldStudent: Student, newClassName: string, updatedStudent: Student) => void
}

export default function StudentCapture({ students, schoolName, className, photoPath, sessionStartDate, autoSelectStudentId, onUpdateStudent }: Props) {
  const [selected, setSelected] = useState<Student | null>(null)
  const [connected, setConnected] = useState(false)
  const [photoCounts, setPhotoCounts] = useState<{ [id: string]: number }>({})
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [lastPhoto, setLastPhoto] = useState<string | null>(null)
  const [lastPhotoTime, setLastPhotoTime] = useState<Date | null>(null)
  const [studentPhotos, setStudentPhotos] = useState<{ [id: string]: string }>({})
  const [allStudentPhotos, setAllStudentPhotos] = useState<Array<{ dataUrl: string; photoTime: Date }>>([])
  const [enlargedPhoto, setEnlargedPhoto] = useState<{ dataUrl: string; photoTime: Date } | null>(null)
  const [sortBy, setSortBy] = useState<'firstName' | 'lastName'>(() => {
    return (localStorage.getItem(`sortBy-${schoolName}`) as 'firstName' | 'lastName') || 'firstName'
  })
  const [editingStudent, setEditingStudent] = useState<(Student & { newClassName?: string }) | null>(null)
  const monitorIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isCapturingRef = useRef(false)
  const currentStudentRef = useRef<string | null>(null)
  const schoolNameRef = useRef(schoolName)
  const classNameRef = useRef(className)

  // Load photo counts from localStorage
  useEffect(() => {
    const key = `photoCounts-${schoolName}-${className}`
    const saved = localStorage.getItem(key)
    if (saved) {
      try {
        setPhotoCounts(JSON.parse(saved))
      } catch (e) {
        console.log('Could not load photo counts')
      }
    }
    setConnected(true)
    setIsLoading(false)
  }, [schoolName, className])

  // Update refs when props change
  useEffect(() => {
    schoolNameRef.current = schoolName
    classNameRef.current = className
  }, [schoolName, className])

  // Auto-select student from search result
  useEffect(() => {
    if (autoSelectStudentId) {
      const studentToSelect = students.find(s => s.id === autoSelectStudentId)
      if (studentToSelect) {
        handleSelectStudent(studentToSelect)
      }
    }
  }, [autoSelectStudentId])

  // Clear monitoring when class changes or component unmounts
  useEffect(() => {
    return () => {
      if (monitorIntervalRef.current) {
        clearInterval(monitorIntervalRef.current)
        monitorIntervalRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (monitorIntervalRef.current) {
      clearInterval(monitorIntervalRef.current)
      monitorIntervalRef.current = null
    }
    currentStudentRef.current = null
  }, [className, schoolName])

  // Handle arrow key navigation and Escape for enlarged photo
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && enlargedPhoto) {
        setEnlargedPhoto(null)
        return
      }

      if (!selected) return
      const currentIndex = students.findIndex(s => s.id === selected.id)
      if (currentIndex === -1) return

      if (e.key === 'ArrowUp') {
        e.preventDefault()
        const newIndex = currentIndex > 0 ? currentIndex - 1 : students.length - 1
        handleSelectStudent(students[newIndex])
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        const newIndex = currentIndex < students.length - 1 ? currentIndex + 1 : 0
        handleSelectStudent(students[newIndex])
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [selected, students])

  // Save photo counts to localStorage (only after loading, and only if changed)
  useEffect(() => {
    if (isLoading || Object.keys(photoCounts).length === 0) return

    const key = `photoCounts-${schoolName}-${className}`
    console.log('[Save] Key:', key, 'Data:', photoCounts)
    localStorage.setItem(key, JSON.stringify(photoCounts))
  }, [photoCounts, schoolName, className, isLoading])

  const loadPhotoAsDataUrl = async (filePath: string): Promise<string> => {
    if (window.electron?.ipcRenderer) {
      const buffer = await window.electron.ipcRenderer.invoke('read-photo', filePath)
      if (buffer && buffer.length > 0) {
        return new Promise((resolve) => {
          const blob = new Blob([buffer], { type: 'image/jpeg' })
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = () => resolve('')
          reader.readAsDataURL(blob)
        })
      }
    }
    return ''
  }

  const handleCapture = async () => {
    console.log('[handleCapture] CAPTURE BUTTON CLICKED')
    if (!selected) {
      console.log('[handleCapture] No student selected')
      setError('No student selected')
      return
    }
    console.log('[handleCapture] Student selected, calling capture...')
    setError('Starting capture...')
    isCapturingRef.current = true

    try {
      if (!window.electron?.ipcRenderer) {
        setError('IPC not available - not running in Electron')
        return
      }

      const nxTetherPath = (localStorage.getItem('nxTetherPath') || '~/Pictures/NX Tether').trim()
      const photoDestPath = (localStorage.getItem('photoDestPath') || photoPath).trim()
      console.log('[capture] nxTetherPath:', nxTetherPath, 'photoDestPath:', photoDestPath)
      console.log('[capture] Calling IPC with:', { id: selected.id, schoolName, className, photoDestPath, nxTetherPath })

      setError('Waiting for photo...')
      const result = await window.electron.ipcRenderer.invoke('capture-photo', selected.id, schoolName, className, photoDestPath, nxTetherPath, sessionStartDate)

      console.log('[capture] Result:', result)
      if (!result.success) {
        setError(result.error || 'Capture failed')
        return
      }

      setError('')
      console.log('[capture] Photo saved, waiting for cleanup...')
      // Wait for file to be written and source fully deleted (longer pause to ensure cleanup)
      await new Promise(r => setTimeout(r, 3000))

      if (result.photoPath) {
        const url = await loadPhotoAsDataUrl(result.photoPath)
        if (url) {
          setLastPhoto(url)
          setLastPhotoTime(result.photoTime ? new Date(result.photoTime) : new Date())
        }
      }
      setPhotoCounts((p) => ({ ...p, [selected.id]: (p[selected.id] || 0) + 1 }))
    } catch (err) {
      console.error('[capture] Error:', err)
      setError(`Error: ${String(err)}`)
    } finally {
      isCapturingRef.current = false
    }
  }

  const handleSelectStudent = async (student: Student) => {
    // Clear previous monitoring interval
    if (monitorIntervalRef.current) {
      clearInterval(monitorIntervalRef.current)
      monitorIntervalRef.current = null
    }

    currentStudentRef.current = student.id

    console.log('[handleSelectStudent] Switching to:', student.id)
    setSelected(student)
    setError('')
    setLastPhoto(null)
    setAllStudentPhotos([])
    console.log('[handleSelectStudent] Cleared gallery')

    const photoDestPath = (localStorage.getItem('photoDestPath') || '~/Desktop/PhotographerOutput').trim()

    try {
      // Load existing photos
      const photos = await window.electron?.ipcRenderer?.invoke?.('list-student-photos', photoDestPath, schoolName, className, student.id, sessionStartDate)
      if (photos && photos.length > 0) {
        // Load all photos as data URLs for gallery
        const allPhotos: Array<{ dataUrl: string; photoTime: Date }> = []
        for (const photo of photos) {
          const url = await loadPhotoAsDataUrl(photo.photoPath)
          if (url) {
            allPhotos.push({ dataUrl: url, photoTime: new Date(photo.photoTime) })
          }
        }
        setAllStudentPhotos(allPhotos)

        // Show latest as preview
        if (allPhotos.length > 0) {
          const latest = allPhotos[allPhotos.length - 1]
          setLastPhoto(latest.dataUrl)
          setLastPhotoTime(latest.photoTime)
        }
      }

      // Monitor NX Tether folder for new photos
      const nxTetherPath = (localStorage.getItem('nxTetherPath') || '~/Pictures/NX Tether').trim()

      // Track all processed photos
      const currentPhotos = await window.electron?.ipcRenderer?.invoke?.('list-nxtether-photos', nxTetherPath)
      const processedPhotos = new Set(currentPhotos || [])

      const monitorInterval = setInterval(async () => {
        try {
          // Skip if student changed (old interval still processing)
          if (currentStudentRef.current !== student.id) {
            console.log('[monitor] Skipping - student changed to', currentStudentRef.current)
            return
          }

          // Skip monitoring while automatic capture is in progress
          if (isCapturingRef.current) {
            console.log('[monitor] Skipping - auto capture in progress')
            return
          }

          // Read current values fresh to pick up class changes
          const currentPhotoDestPath = (localStorage.getItem('photoDestPath') || '~/Desktop/PhotographerOutput').trim()
          const nxPhotos = await window.electron?.ipcRenderer?.invoke?.('list-nxtether-photos', nxTetherPath)


          if (nxPhotos && nxPhotos.length > 0) {
            const latestPhoto = nxPhotos[nxPhotos.length - 1]
            if (latestPhoto && !processedPhotos.has(latestPhoto)) {
              processedPhotos.add(latestPhoto)

              // Use CURRENT refs - ensures fresh school/class after switches
              const currentSchoolName = schoolNameRef.current
              const currentClassName = classNameRef.current
              const currentStudentId = currentStudentRef.current

              console.log('[monitor] Moving photo for:', currentStudentId, 'class:', currentClassName, 'school:', currentSchoolName)

              const result = await window.electron?.ipcRenderer?.invoke?.('move-photo-to-folder', latestPhoto, currentStudentId, currentSchoolName, currentClassName, currentPhotoDestPath, sessionStartDate)

              if (!result?.success) {
                console.log('[monitor] Failed:', result?.error)
              } else if (result?.photoPath) {
                const url = await loadPhotoAsDataUrl(result.photoPath)
                if (url) {
                  const photoTime = result.photoTime ? new Date(result.photoTime) : new Date()
                  setLastPhoto(url)
                  setLastPhotoTime(photoTime)
                  setAllStudentPhotos((p) => [...p, { dataUrl: url, photoTime }])
                  setPhotoCounts((p) => ({ ...p, [student.id]: (p[student.id] || 0) + 1 }))
                  setError('')
                  console.log('[monitor] Saved to:', result.photoPath)
                }
              }
            }
          }
        } catch (err) {
          console.log('[monitor] Error:', err)
        }
      }, 500)

      monitorIntervalRef.current = monitorInterval

      // Stop monitoring after 2 minutes
      setTimeout(() => {
        if (monitorIntervalRef.current === monitorInterval) {
          clearInterval(monitorIntervalRef.current)
          monitorIntervalRef.current = null
        }
      }, 120000)
    } catch (err) {
      console.log('Could not load student photos:', err)
    }
  }


  const CameraIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }}>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
      <circle cx="12" cy="13" r="4"></circle>
    </svg>
  )

  const AlertIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }}>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3.05h16.94a2 2 0 0 0 1.71-3.05L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
      <line x1="12" y1="9" x2="12" y2="13"></line>
      <line x1="12" y1="17" x2="12.01" y2="17"></line>
    </svg>
  )

  const CaptureIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }}>
      <circle cx="12" cy="12" r="10"></circle>
      <circle cx="12" cy="12" r="6"></circle>
      <circle cx="12" cy="12" r="2"></circle>
    </svg>
  )

  const BackIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }}>
      <line x1="19" y1="12" x2="5" y2="12"></line>
      <polyline points="12 19 5 12 12 5"></polyline>
    </svg>
  )

  const sortedStudents = [...students].sort((a, b) => {
    const aVal = sortBy === 'firstName' ? a.firstName : a.lastName
    const bVal = sortBy === 'firstName' ? b.firstName : b.lastName
    return aVal.localeCompare(bVal)
  })

  const handleSaveEdit = async () => {
    if (!editingStudent) return
    const oldStudent = students.find(s => s.id === editingStudent.id)
    if (!oldStudent) return

    const classChanged = editingStudent.newClassName && editingStudent.newClassName !== className

    if (classChanged && editingStudent.newClassName) {
      // Migrate photos to new class
      try {
        await window.electron?.ipcRenderer?.invoke?.('migrate-student-photos', {
          schoolName,
          oldClassName: className,
          newClassName: editingStudent.newClassName,
          studentId: editingStudent.id,
          photoPath
        })
      } catch (err) {
        console.error('Failed to migrate photos:', err)
      }

      // Notify parent to update student in data
      if (onUpdateStudent) {
        onUpdateStudent(oldStudent, editingStudent.newClassName, {
          id: editingStudent.id,
          firstName: editingStudent.firstName,
          lastName: editingStudent.lastName,
          prefix: editingStudent.prefix
        })
      }
    } else {
      // Just update name in current class
      const updated = {
        id: editingStudent.id,
        firstName: editingStudent.firstName,
        lastName: editingStudent.lastName,
        prefix: editingStudent.prefix
      }
      if (onUpdateStudent) {
        onUpdateStudent(oldStudent, className, updated)
      }
    }

    setEditingStudent(null)
  }

  return (
    <div className="page">
      <div className="split">
        <div className="students">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '8px' }}>
            <h3 style={{ margin: 0 }}>Students</h3>
            <select
              value={sortBy}
              onChange={(e) => {
                const val = e.target.value as 'firstName' | 'lastName'
                setSortBy(val)
                localStorage.setItem(`sortBy-${schoolName}`, val)
              }}
              style={{
                padding: '6px 8px',
                fontSize: '12px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              <option value="firstName">First Name</option>
              <option value="lastName">Last Name</option>
            </select>
            <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 500, marginLeft: 'auto' }}>
              {Object.keys(photoCounts).filter(id => photoCounts[id] > 0).length}/{students.length}
            </span>
          </div>
          <div className="list" style={{ display: 'grid', gap: '4px' }}>
            {sortedStudents.map((s, idx) => (
              <div key={`${s.id}-${idx}`} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px', alignItems: 'center' }}>
                <button
                  onClick={() => handleSelectStudent(s)}
                  className={selected?.id === s.id ? 'btn-selected' : ''}
                  style={{ textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {[s.firstName, s.prefix, s.lastName].filter(v => v && v !== 'undefined').join(' ')}
                  {photoCounts[s.id] && <span className="count">{photoCounts[s.id]}</span>}
                </button>
                <button
                  onClick={() => setEditingStudent({ ...s, newClassName: className })}
                  style={{
                    background: '#f59e0b',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '4px 6px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '600',
                    whiteSpace: 'nowrap'
                  }}
                >
                  ✎
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="capture-panel">
          <h3 style={{ fontSize: '28px', marginBottom: '8px' }}>{selected ? `${[selected.prefix, selected.lastName].filter(v => v && v !== 'undefined').join(' ')}` : 'Select a student'}</h3>
          <p style={{ fontSize: '12px', margin: '4px 0' }}>ID: {selected?.id || '—'}</p>
          <p className={connected ? 'ok' : 'error'} style={{ fontSize: '12px' }}>
            {connected ? (
              <>
                <CameraIcon />
                Ready
              </>
            ) : (
              <>
                <AlertIcon />
                No Camera
              </>
            )}
          </p>
          <p className="error" style={{ visibility: error ? 'visible' : 'hidden', height: '20px', margin: '4px 0', fontSize: '12px' }}>
            {error || ' '}
          </p>
          <button onClick={handleCapture} disabled={!connected || !selected} className="btn-capture">
            <CaptureIcon />
            Capture
          </button>
          <div className="photo-preview">
            {lastPhoto ? (
              <>
                <img src={lastPhoto} alt="Last captured" />
                {lastPhotoTime && (
                  <p className="photo-timestamp">
                    {lastPhotoTime.toLocaleString('nl-NL')}
                  </p>
                )}
              </>
            ) : (
              <div className="photo-placeholder">
                <p>No picture taken yet</p>
              </div>
            )}
          </div>
          {allStudentPhotos.length > 0 && (
            <div style={{ marginTop: '16px', borderTop: '1px solid #e5e7eb', paddingTop: '16px' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600 }}>All Photos ({allStudentPhotos.length})</h4>
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', maxHeight: '120px' }}>
                {allStudentPhotos.map((photo, idx) => (
                  <div key={idx} style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <img
                      src={photo.dataUrl}
                      alt={`Photo ${idx + 1}`}
                      style={{
                        width: '80px',
                        height: '80px',
                        objectFit: 'cover',
                        borderRadius: '6px',
                        border: '1px solid #e5e7eb',
                        cursor: 'pointer'
                      }}
                      onClick={() => {
                        setLastPhoto(photo.dataUrl)
                        setLastPhotoTime(photo.photoTime)
                        setEnlargedPhoto(photo)
                      }}
                      onDoubleClick={() => {
                        setEnlargedPhoto(photo)
                      }}
                    />
                    <span style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px', textAlign: 'center', maxWidth: '80px' }}>
                      {photo.photoTime.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {editingStudent && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999
          }}
          onClick={() => setEditingStudent(null)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '8px',
              padding: '20px',
              maxWidth: '400px',
              width: '90%',
              maxHeight: '60vh',
              overflowY: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Edit Student</h3>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>First Name:</label>
              <input
                type="text"
                value={editingStudent.firstName}
                onChange={(e) => setEditingStudent({ ...editingStudent, firstName: e.target.value })}
                style={{ width: '100%', padding: '8px', fontSize: '14px', border: '1px solid #d1d5db', borderRadius: '4px', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Prefix (optional):</label>
              <input
                type="text"
                value={editingStudent.prefix || ''}
                onChange={(e) => setEditingStudent({ ...editingStudent, prefix: e.target.value || undefined })}
                style={{ width: '100%', padding: '8px', fontSize: '14px', border: '1px solid #d1d5db', borderRadius: '4px', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Last Name:</label>
              <input
                type="text"
                value={editingStudent.lastName}
                onChange={(e) => setEditingStudent({ ...editingStudent, lastName: e.target.value })}
                style={{ width: '100%', padding: '8px', fontSize: '14px', border: '1px solid #d1d5db', borderRadius: '4px', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Class:</label>
              <input
                type="text"
                value={editingStudent.newClassName || className}
                onChange={(e) => setEditingStudent({ ...editingStudent, newClassName: e.target.value })}
                style={{ width: '100%', padding: '8px', fontSize: '14px', border: '1px solid #d1d5db', borderRadius: '4px', boxSizing: 'border-box' }}
                placeholder="(leave empty to keep current class)"
              />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleSaveEdit}
                style={{
                  flex: 1,
                  background: '#10b981',
                  color: 'white',
                  padding: '10px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 600
                }}
              >
                Save
              </button>
              <button
                onClick={() => setEditingStudent(null)}
                style={{
                  flex: 1,
                  background: '#6b7280',
                  color: 'white',
                  padding: '10px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 600
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {enlargedPhoto && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            cursor: 'pointer'
          }}
          onClick={() => setEnlargedPhoto(null)}
          onKeyDown={(e) => e.key === 'Escape' && setEnlargedPhoto(null)}
        >
          <button
            onClick={() => setEnlargedPhoto(null)}
            style={{
              position: 'fixed',
              top: '20px',
              right: '20px',
              background: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              fontSize: '24px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1001
            }}
          >
            ✕
          </button>
          <div style={{ position: 'relative', maxWidth: '50%',  }}>
            <img
              src={enlargedPhoto.dataUrl}
              alt="Enlarged"
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                display: 'block'
              }}
              onClick={(e) => e.stopPropagation()}
            />
            <div
              style={{
                position: 'absolute',
                bottom: '10px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(0, 0, 0, 0.7)',
                color: 'white',
                padding: '8px 16px',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            >
              {enlargedPhoto.photoTime.toLocaleString('nl-NL')}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

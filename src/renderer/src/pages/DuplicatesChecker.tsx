import { useState, useEffect } from 'react'

interface Props {
  schoolName: string
  students: any
  onClose: () => void
}

export default function DuplicatesChecker({ schoolName, students: initialStudents, onClose }: Props) {
  const [selectedSchool, setSelectedSchool] = useState<string | null>(null)
  const [students, setStudents] = useState<any>(initialStudents)
  const [duplicates, setDuplicates] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (selectedSchool) {
      checkDuplicates()
    }
  }, [selectedSchool])

  const checkDuplicates = async () => {
    try {
      const result = await window.electron.ipcRenderer.invoke('check-duplicates', schoolName, students)
      console.log('[DuplicatesChecker] Raw result:', result)
      if (result.success) {
        setDuplicates(result.duplicates)
      } else {
        setError(result.error || 'Failed to check duplicates')
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (className: string, studentId: string) => {
    if (!confirm(`Delete student ${studentId} from ${className}?`)) return

    try {
      console.log('[Delete] Before:', { className, studentId, classStudents: students[className]?.length })

      const deleteResult = await window.electron.ipcRenderer.invoke('delete-student', schoolName, className, studentId)
      console.log('[Delete] Server response:', deleteResult)

      if (deleteResult.success) {
        // Remove student from local state
        const updatedStudents = { ...students }
        if (updatedStudents[className]) {
          updatedStudents[className] = updatedStudents[className].filter((s: any) => s.id !== studentId)
        }
        console.log('[Delete] After local update:', { classStudents: updatedStudents[className]?.length })
        setStudents(updatedStudents)

        // Save updated students to persist deletion (merge with existing session)
        try {
          const current = await window.electron.ipcRenderer.invoke('load-session')
          if (current.success && current.data) {
            await window.electron.ipcRenderer.invoke('save-session', {
              ...current.data,
              students: updatedStudents
            })
          }
        } catch (err) {
          console.error('[Delete Save] Failed:', err)
        }

        // Re-check duplicates with updated data
        setLoading(true)
        try {
          const result = await window.electron.ipcRenderer.invoke('check-duplicates', schoolName, updatedStudents)
          console.log('[Delete] New duplicates result:', result)
          if (result.success) {
            setDuplicates(result.duplicates)
          } else {
            setError(result.error || 'Failed to check duplicates')
          }
        } catch (err) {
          setError(String(err))
        } finally {
          setLoading(false)
        }
      } else {
        alert('Failed to delete student: ' + deleteResult.error)
      }
    } catch (err) {
      alert('Error deleting student: ' + String(err))
    }
  }

  return (
    <div className="page">
      <div className="card" style={{ maxWidth: '800px' }}>
        <h2>Check for Duplicate Students</h2>

        {!selectedSchool && (
          <div>
            {!schoolName ? (
              <p style={{ color: '#dc2626' }}>No school loaded. Import data first.</p>
            ) : (
              <>
                <p style={{ marginBottom: '16px', color: '#374151' }}>Select a school to check:</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button
                    key={schoolName}
                    onClick={() => setSelectedSchool(schoolName)}
                    style={{
                      padding: '12px 16px',
                      background: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: 600,
                      textAlign: 'left'
                    }}
                  >
                    {schoolName}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {selectedSchool && (
          <>
            {loading && <p>Scanning for duplicates in {selectedSchool}...</p>}

            {error && <p className="error">{error}</p>}

            <button
              onClick={checkDuplicates}
              style={{
                padding: '8px 16px',
                background: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                marginBottom: '16px',
                fontWeight: 600
              }}
            >
              Re-Check Duplicates
            </button>

            {!loading && (() => {
              const csvHeaders = ['roepnaam', 'Roepnaam', 'voorvoegsel', 'Voorvoegsels', 'voorvoegsel', 'achternaam', 'Achternaam', 'Leerlingnummer', 'leerlingnummer', 'id', 'student', 'ID']
              const filtered = duplicates.filter((dup) => {
                if (csvHeaders.includes(dup.id)) return false
                const validEntries = dup.entries.filter((entry: any) => {
                  const s = entry.student || {}
                  return !csvHeaders.includes(s.firstName) && !csvHeaders.includes(s.prefix) && !csvHeaders.includes(s.lastName) && !csvHeaders.includes(entry.className)
                })
                return validEntries.length > 0
              })

              if (filtered.length === 0) {
                return <p style={{ color: '#10b981' }}>✓ No duplicate student IDs found!</p>
              }

              return (
                <div>
                  <p style={{ color: '#ef4444', fontWeight: 600, marginBottom: '20px' }}>
                    Found {filtered.length} duplicate student ID(s):
                  </p>

                  {filtered.map((dup) => {
                    const validEntries = dup.entries.filter((entry: any) => {
                      const s = entry.student || {}
                      return !csvHeaders.includes(s.firstName) && !csvHeaders.includes(s.prefix) && !csvHeaders.includes(s.lastName) && !csvHeaders.includes(entry.className)
                    })
                    return (
              <div
                key={dup.id}
                style={{
                  background: '#fef2f2',
                  border: '2px solid #fca5a5',
                  borderRadius: '8px',
                  padding: '16px',
                  marginBottom: '16px'
                }}
              >
                <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#dc2626' }}>
                  Student ID: {dup.id}
                </h3>

                {validEntries.map((entry: any, idx: number) => (
                  <div
                    key={idx}
                    style={{
                      background: 'white',
                      padding: '12px',
                      borderRadius: '6px',
                      marginBottom: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <p style={{ margin: '0 0 4px 0', fontWeight: 600 }}>
                        {entry.student.prefix} {entry.student.lastName}
                      </p>
                      <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>
                        {entry.className}
                      </p>
                    </div>

                    <button
                      onClick={() => handleDelete(entry.className, dup.id)}
                      style={{
                        background: '#ef4444',
                        color: 'white',
                        border: 'none',
                        padding: '6px 12px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 600
                      }}
                    >
                      Delete this one
                    </button>
                  </div>
                ))}
              </div>
                    )
                  })}
                </div>
              )
            })()}

            <button
              onClick={() => setSelectedSchool(null)}
              style={{
                marginTop: '16px',
                marginRight: '8px',
                background: '#9ca3af',
                color: 'white',
                padding: '10px 20px',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              Back
            </button>
          </>
        )}

        <button
          onClick={onClose}
          style={{
            marginTop: '24px',
            background: '#6b7280',
            color: 'white',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600
          }}
        >
          Close
        </button>
      </div>
    </div>
  )
}

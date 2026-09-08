import { useState, useEffect } from 'react'

interface Props {
  schoolName: string
  students: any
  onClose: () => void
}

export default function DuplicatesChecker({ schoolName, students, onClose }: Props) {
  const [duplicates, setDuplicates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    checkDuplicates()
  }, [])

  const checkDuplicates = async () => {
    try {
      const result = await window.electron.ipcRenderer.invoke('check-duplicates', schoolName, students)
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
      const result = await window.electron.ipcRenderer.invoke('delete-student', schoolName, className, studentId)
      if (result.success) {
        checkDuplicates()
      } else {
        alert('Failed to delete student: ' + result.error)
      }
    } catch (err) {
      alert('Error deleting student: ' + String(err))
    }
  }

  return (
    <div className="page">
      <div className="card" style={{ maxWidth: '800px' }}>
        <h2>Check for Duplicate Students</h2>

        {loading && <p>Scanning for duplicates...</p>}

        {error && <p className="error">{error}</p>}

        {!loading && duplicates.length === 0 && (
          <p style={{ color: '#10b981' }}>✓ No duplicate student IDs found!</p>
        )}

        {!loading && duplicates.length > 0 && (
          <div>
            <p style={{ color: '#ef4444', fontWeight: 600, marginBottom: '20px' }}>
              Found {duplicates.length} duplicate student ID(s):
            </p>

            {duplicates.map((dup) => (
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

                {dup.entries.filter((entry: any) => entry.student.prefix !== 'voorvoegsel' && entry.student.lastName !== 'achternaam').map((entry: any, idx: number) => (
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
            ))}
          </div>
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

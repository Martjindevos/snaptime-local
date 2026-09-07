import { useState, useEffect } from 'react'
import { Student, StudentsByClass } from '../../../types'

interface Props {
  classes: string[]
  schoolName: string
  students: StudentsByClass
  onSelect: (cls: string, updatedStudents?: StudentsByClass) => void
  onBack: () => void
}

export default function ClassSelect({ classes, schoolName, students: initialStudents, onSelect, onBack }: Props) {
  const [photoCounts, setPhotoCounts] = useState<{ [key: string]: number }>({})
  const [allStudents, setAllStudents] = useState<StudentsByClass>(initialStudents)
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [newStudent, setNewStudent] = useState({ id: '', firstName: '', prefix: '', lastName: '', className: '' })
  const [editingStudent, setEditingStudent] = useState<{ student: Student & { className: string }; originalClassName: string } | null>(null)

  // Filter out Stamgroep from classes
  const filteredClasses = classes.filter(c => c.toLowerCase() !== 'stamgroep')

  useEffect(() => {
    const counts: { [key: string]: number } = {}
    filteredClasses.forEach(cls => {
      const key = `photoCounts-${schoolName}-${cls}`
      const saved = localStorage.getItem(key)
      if (saved) {
        try {
          const data = JSON.parse(saved)
          counts[cls] = Object.values(data).reduce((sum: number, count: any) => sum + (count as number), 0)
        } catch (e) {
          counts[cls] = 0
        }
      }
    })
    setPhotoCounts(counts)
  }, [filteredClasses, schoolName])

  const handleAddStudent = () => {
    if (!newStudent.id || !newStudent.firstName || !newStudent.lastName || !newStudent.className) return
    const student: Student = {
      id: newStudent.id,
      firstName: newStudent.firstName,
      lastName: newStudent.lastName,
      prefix: newStudent.prefix || undefined
    }
    const updated = {
      ...allStudents,
      [newStudent.className]: [...(allStudents[newStudent.className] || []), student]
    }
    setAllStudents(updated)
    setNewStudent({ id: '', firstName: '', prefix: '', lastName: '', className: '' })
    setShowAddForm(false)
  }

  // Search across all students
  const allStudentsList = Object.entries(allStudents).flatMap(([className, students]) =>
    students.map(s => ({ ...s, className }))
  )

  const filteredStudents = allStudentsList.filter(s => {
    const query = searchQuery.toLowerCase()
    return (
      s.id.toLowerCase().includes(query) ||
      s.firstName.toLowerCase().includes(query) ||
      s.lastName.toLowerCase().includes(query)
    )
  })

  const handleSelectStudent = (student: Student & { className: string }) => {
    onSelect(student.className, allStudents)
  }

  const handleSelectClass = (cls: string) => {
    onSelect(cls, allStudents)
  }

  const handleSaveEdit = () => {
    if (!editingStudent) return
    const { student, originalClassName } = editingStudent
    const updated = { ...allStudents }

    // Remove from old class
    if (originalClassName !== student.className) {
      updated[originalClassName] = updated[originalClassName].filter(s => s.id !== student.id)
    }

    // Add/update in new class
    if (!updated[student.className]) updated[student.className] = []
    const idx = updated[student.className].findIndex(s => s.id === student.id)
    if (idx >= 0) {
      updated[student.className][idx] = student
    } else {
      updated[student.className].push(student)
    }

    setAllStudents(updated)
    setEditingStudent(null)
  }

  const CameraIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }}>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
      <circle cx="12" cy="13" r="4" fill="white"></circle>
    </svg>
  )

  const BackIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }}>
      <line x1="19" y1="12" x2="5" y2="12"></line>
      <polyline points="12 19 5 12 12 5"></polyline>
    </svg>
  )

  return (
    <div className="page">
      <div className="card">
        <h2>Select Class</h2>

        <input
          type="text"
          placeholder="Search student by name or ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '12px',
            marginBottom: '12px',
            border: '2px solid #3b82f6',
            borderRadius: '6px',
            fontSize: '14px',
            boxSizing: 'border-box'
          }}
        />

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          style={{
            width: '100%',
            padding: '10px',
            marginBottom: '24px',
            background: '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 600
          }}
        >
          {showAddForm ? '✕ Cancel' : '+ Add Student'}
        </button>

        {showAddForm && (
          <div style={{
            background: '#f3f4f6',
            padding: '16px',
            borderRadius: '6px',
            marginBottom: '24px',
            border: '1px solid #e5e7eb'
          }}>
            <input
              type="text"
              placeholder="Student Number"
              value={newStudent.id}
              onChange={(e) => setNewStudent({ ...newStudent, id: e.target.value })}
              style={{ width: '100%', padding: '8px', marginBottom: '8px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' }}
            />
            <input
              type="text"
              placeholder="First Name"
              value={newStudent.firstName}
              onChange={(e) => setNewStudent({ ...newStudent, firstName: e.target.value })}
              style={{ width: '100%', padding: '8px', marginBottom: '8px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' }}
            />
            <input
              type="text"
              placeholder="Prefix (optional)"
              value={newStudent.prefix}
              onChange={(e) => setNewStudent({ ...newStudent, prefix: e.target.value })}
              style={{ width: '100%', padding: '8px', marginBottom: '8px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' }}
            />
            <input
              type="text"
              placeholder="Last Name"
              value={newStudent.lastName}
              onChange={(e) => setNewStudent({ ...newStudent, lastName: e.target.value })}
              style={{ width: '100%', padding: '8px', marginBottom: '8px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' }}
            />
            <select
              value={newStudent.className}
              onChange={(e) => setNewStudent({ ...newStudent, className: e.target.value })}
              style={{ width: '100%', padding: '8px', marginBottom: '12px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' }}
            >
              <option value="">Select Class</option>
              {filteredClasses.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <button
              onClick={handleAddStudent}
              style={{
                width: '100%',
                padding: '8px',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600
              }}
            >
              Save Student
            </button>
          </div>
        )}

        {searchQuery && (
          <div style={{ marginBottom: '24px', paddingBottom: '24px', borderBottom: '2px solid #e5e7eb' }}>
            <h3>Search Results ({filteredStudents.length})</h3>
            {filteredStudents.length > 0 ? (
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {filteredStudents.map((s) => (
                  <div
                    key={`${s.className}-${s.id}`}
                    style={{
                      display: 'flex',
                      gap: '8px',
                      marginBottom: '8px',
                      alignItems: 'stretch'
                    }}
                  >
                    <button
                      onClick={() => handleSelectStudent(s)}
                      style={{
                        flex: 1,
                        padding: '12px',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        background: 'white',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontSize: '14px'
                      }}
                    >
                      <div style={{ fontWeight: 600, color: 'black' }}>
                        {[s.firstName, s.prefix, s.lastName].filter(v => v && v !== 'undefined').join(' ')}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                        ID: {s.id} • Class: {s.className}
                      </div>
                    </button>
                    <button
                      onClick={() => setEditingStudent({ student: { ...s }, originalClassName: s.className })}
                      style={{
                        background: '#f59e0b',
                        color: 'white',
                        padding: '8px 12px',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 600,
                        whiteSpace: 'nowrap'
                      }}
                    >
                      Edit
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: '#9ca3af', padding: '16px' }}>
                No students found
              </div>
            )}
          </div>
        )}

        {editingStudent && (
          <div style={{
            background: '#f9fafb',
            padding: '16px',
            borderRadius: '8px',
            marginBottom: '24px',
            border: '1px solid #e5e7eb'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '12px', fontSize: '14px' }}>Edit Student</h3>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px' }}>First Name:</label>
              <input
                type="text"
                value={editingStudent.student.firstName}
                onChange={(e) => setEditingStudent({ ...editingStudent, student: { ...editingStudent.student, firstName: e.target.value } })}
                style={{ width: '100%', padding: '8px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '4px', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px' }}>Prefix (optional):</label>
              <input
                type="text"
                value={editingStudent.student.prefix || ''}
                onChange={(e) => setEditingStudent({ ...editingStudent, student: { ...editingStudent.student, prefix: e.target.value || undefined } })}
                style={{ width: '100%', padding: '8px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '4px', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px' }}>Last Name:</label>
              <input
                type="text"
                value={editingStudent.student.lastName}
                onChange={(e) => setEditingStudent({ ...editingStudent, student: { ...editingStudent.student, lastName: e.target.value } })}
                style={{ width: '100%', padding: '8px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '4px', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px' }}>Student ID:</label>
              <input
                type="text"
                value={editingStudent.student.id}
                onChange={(e) => setEditingStudent({ ...editingStudent, student: { ...editingStudent.student, id: e.target.value } })}
                style={{ width: '100%', padding: '8px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '4px', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px' }}>Class:</label>
              <select
                value={editingStudent.student.className}
                onChange={(e) => setEditingStudent({ ...editingStudent, student: { ...editingStudent.student, className: e.target.value } })}
                style={{ width: '100%', padding: '8px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '4px', boxSizing: 'border-box' }}
              >
                {filteredClasses.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleSaveEdit}
                style={{
                  flex: 1,
                  background: '#10b981',
                  color: 'white',
                  padding: '8px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
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
                  padding: '8px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 600
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <h3 style={{ marginTop: searchQuery ? 0 : '24px' }}>Classes</h3>
        <div className="grid">
          {filteredClasses.map((c) => (
            <button key={c} onClick={() => handleSelectClass(c)} className="btn-large">
              <div>{c}</div>
              {photoCounts[c] > 0 && <div className="badge"><CameraIcon />{photoCounts[c]}</div>}
            </button>
          ))}
        </div>
      </div>
      <button onClick={onBack}><BackIcon />Back</button>
    </div>
  )
}

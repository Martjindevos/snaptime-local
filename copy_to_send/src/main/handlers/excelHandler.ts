import * as XLSX from 'xlsx'
import { StudentsByClass } from '../../types'

export async function parseXLSX(filePath: string): Promise<StudentsByClass> {
  const workbook = XLSX.readFile(filePath)
  const worksheet = workbook.Sheets[workbook.SheetNames[0]]
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]

  const students: StudentsByClass = {}

  for (let i = 0; i < data.length; i++) {
    const row = data[i]
    if (!row || row.length < 5) continue

    const studentId = String(row[0] || '').trim()
    const firstName = String(row[1] || '').trim()
    const lastName = String(row[3] || '').trim()
    const className = String(row[4] || '').trim()

    if (!studentId || !firstName || !lastName || !className) continue

    if (!students[className]) students[className] = []
    students[className].push({ id: studentId, firstName, lastName })
  }

  Object.keys(students).forEach(c => {
    students[c].sort((a, b) => a.firstName.localeCompare(b.firstName))
  })

  return students
}

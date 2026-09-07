import * as fs from 'fs'
import * as path from 'path'

export async function createProjectStructure(schoolName: string, photoPath: string, students: any): Promise<{ success: boolean; error?: string }> {
  try {
    const today = new Date()
    const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`
    const projectPath = path.join(photoPath, `${schoolName}_${dateStr}`)

    if (!fs.existsSync(projectPath)) {
      fs.mkdirSync(projectPath, { recursive: true })
    }

    Object.keys(students).forEach(className => {
      const classPath = path.join(projectPath, className)
      if (!fs.existsSync(classPath)) {
        fs.mkdirSync(classPath, { recursive: true })
      }
    })

    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

export function getNextPhotoPath(photoPath: string, schoolName: string, className: string, studentId: string): string {
  const today = new Date()
  const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`
  const projectPath = path.join(photoPath, `${schoolName}_${dateStr}`, className)

  if (!fs.existsSync(projectPath)) {
    fs.mkdirSync(projectPath, { recursive: true })
  }

  let filename = `${studentId}.jpg`
  let filePath = path.join(projectPath, filename)
  let counter = 0

  while (fs.existsSync(filePath)) {
    filename = `${studentId}_${counter}.jpg`
    filePath = path.join(projectPath, filename)
    counter++
  }

  return filePath
}

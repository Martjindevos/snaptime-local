export interface Student {
  id: string
  firstName: string
  lastName: string
  prefix?: string
}

export interface StudentsByClass {
  [className: string]: Student[]
}

export interface CameraStatus {
  connected: boolean
  capturing: boolean
}

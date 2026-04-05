import { NAME_PROP } from '@/types/Constants'

export interface StudentData {
  [NAME_PROP]: string
  tags?: Record<string, string[]>
}

export interface BatchTagDrawerProps {
  visible: boolean
  studentList: StudentData[]
}

export interface BatchTagDrawerEmits {
  'update:visible': [value: boolean]
  confirm: [updatedStudents: StudentData[]]
}

import { NAME_PROP } from '@/types/Constants'
import type { StudentDataType } from '@/types/StudentData'

export interface StudentData extends StudentDataType {
  [NAME_PROP]: string | null
}

export interface BatchTagDrawerProps {
  visible: boolean
  studentList: StudentData[]
}

export interface BatchTagDrawerEmits {
  'update:visible': [value: boolean]
  save: [updatedStudents: StudentData[]]
  confirm: [updatedStudents: StudentData[]]
  goTab: [tab: string]
}

export interface StudentData {
  xing4_ming2: string
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

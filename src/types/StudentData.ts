import { NAME_PROP, STUDENT_ID_PROP } from '@/types/Constants'

export interface StudentDataType {
  [STUDENT_ID_PROP]: string
  [NAME_PROP]: string | null
  disabled?: boolean
  comment?: string
  tags?: Record<string, string[]>
  [key: string]: string | number | boolean | undefined | null | Record<string, string[]>
}

export interface StudentScoreType {
  score: number | null
  student: StudentDataType
}

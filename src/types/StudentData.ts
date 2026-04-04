export interface StudentDataType {
  xing4_ming2: string | null
  disabled?: boolean
  comment?: string
  tags?: Record<string, string[]>
  [key: string]: string | number | boolean | undefined | null | Record<string, string[]>
}

export interface StudentScoreType {
  score: number | null
  student: StudentDataType
}

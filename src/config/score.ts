export interface ScoreRange {
  label: string
  min: number
  max: number
  color: string
}

export const scoreRanges: ScoreRange[] = [
  { label: '90-100分', min: 90, max: 100, color: '#22c55e' },
  { label: '80-89分', min: 80, max: 89, color: '#3b82f6' },
  { label: '70-79分', min: 70, max: 79, color: '#eab308' },
  { label: '60-69分', min: 60, max: 69, color: '#f97316' },
  { label: '50-59分', min: 50, max: 59, color: '#ef4444' },
  { label: '40-49分', min: 40, max: 49, color: '#dc2626' },
  { label: '30-39分', min: 30, max: 39, color: '#b91c1c' },
  { label: '20-29分', min: 20, max: 29, color: '#991b1b' },
  { label: '10-19分', min: 10, max: 19, color: '#7f1d1d' },
  { label: '0-9分', min: 0, max: 9, color: '#450a0a' }
]

export const passingScoreRanges: ScoreRange[] = scoreRanges.slice(0, 4)
export const lowScoreRanges: ScoreRange[] = scoreRanges.slice(4)

export const getScoreColor = (score: number): string | undefined => {
  const range = scoreRanges.find((r) => score >= r.min && score <= r.max)
  return range?.color
}

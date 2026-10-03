/** 学生走势方向判断。 */
import type { StudentMetricType } from '@/views/overview/services/dashboard/types'

/** 判断走势方向是否为下行（含波动下行） */
export const isDownwardDirection = (direction?: StudentMetricType['volatilityDirection']) =>
  direction === 'down' || direction === 'volatileDown'

/** 判断走势方向是否为上行（含波动上行） */
export const isUpwardDirection = (direction?: StudentMetricType['volatilityDirection']) =>
  direction === 'up' || direction === 'volatileUp'

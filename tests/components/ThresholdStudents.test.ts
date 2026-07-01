import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import ThresholdStudents from '../../src/views/score/components/statistics/ThresholdStudents.vue'

const defaultProps = {
  threshold: 60,
  effectiveThreshold: 60,
  thresholdMode: 'average' as const,
  avgScore: 60,
  students: [
    { name: '张三', score: 50 },
    { name: '李四', score: 55 }
  ],
  getScore: (item: { score?: number }) => item.score ?? null
}

describe('ThresholdStudents', () => {
  it('should always display the current student count', async () => {
    const wrapper = mount(ThresholdStudents, {
      props: defaultProps
    })

    expect(wrapper.find('.student-count').text()).toBe('2 人')

    await wrapper.setProps({ students: [] })

    expect(wrapper.find('.student-count').text()).toBe('0 人')
  })
})

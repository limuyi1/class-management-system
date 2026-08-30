import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import ThresholdStudents from '../../src/views/score/components/statistics/ThresholdStudents.vue'

/**
 * ThresholdStudents 组件测试
 * 测试目标：成绩统计中的阈值学生名单面板
 * 覆盖功能：学生人数统计随数据变化实时更新
 */

// 默认 props：阈值 60 分、平均分模式及两名低于阈值的学生
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

// 验证面板始终展示当前符合阈值条件的学生人数
describe('ThresholdStudents', () => {
  it('should always display the current student count', async () => {
    const wrapper = mount(ThresholdStudents, {
      props: defaultProps,
      global: {
        stubs: {
          // 本用例只关心人数展示，其余 Element Plus 控件使用空替身
          ElSegmented: true,
          ElInputNumber: true,
          ElButton: true,
          ElDropdown: true,
          ElDropdownMenu: true,
          ElDropdownItem: true,
          ElTag: true,
          ElPopover: true
        }
      }
    })

    expect(wrapper.find('.student-count').text()).toBe('2 人')

    await wrapper.setProps({ students: [] })

    expect(wrapper.find('.student-count').text()).toBe('0 人')
  })
})

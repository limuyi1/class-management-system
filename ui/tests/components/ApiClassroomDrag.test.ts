import { afterEach, expect, it } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import ApiSeatingCanvas from '@/views/workspace-api/ApiSeatingCanvas.vue'
import ApiDutyBoard from '@/views/workspace-api/ApiDutyBoard.vue'
import SeatingChartCanvas from '@/views/seating-chart/components/SeatingChartCanvas.vue'
import UnassignedStudentPanel from '@/views/seating-chart/components/UnassignedStudentPanel.vue'
import DutyScheduleMatrix from '@/views/duty-roster/components/DutyScheduleMatrix.vue'
import { createClassroomTool } from '@/utils/apiClassroomToolUtil'
import { DutyPeriodEnum } from '@/types/DutyRoster'
import type { SeatingChartType } from '@/types/SeatingChart'
import type { DutyRosterType } from '@/types/DutyRoster'
const wrappers: Array<ReturnType<typeof mount>> = []
afterEach(() => {
  wrappers.forEach((wrapper) => wrapper.unmount())
  wrappers.length = 0
})
const global = {
  plugins: [ElementPlus],
  stubs: { SeatingChartCanvas: true, UnassignedStudentPanel: true, FontAwesomeIcon: true }
}
it('座位画布拖动交换后可回收，外部未知学生不能拖入', async () => {
  const chart = createClassroomTool('seating') as SeatingChartType
  chart.seats[0].studentId = 'a'
  chart.seats[1].studentId = 'b'
  const wrapper = mount(ApiSeatingCanvas, {
    props: {
      modelValue: chart,
      students: [
        { id: 'a', name: '甲' },
        { id: 'b', name: '乙' }
      ]
    },
    global
  })
  wrappers.push(wrapper)
  const canvas = wrapper.findComponent(SeatingChartCanvas)
  canvas.vm.$emit('dragStart', 'a')
  canvas.vm.$emit('dropSeat', chart.seats[1])
  await flushPromises()
  expect(chart.seats.slice(0, 2).map((row) => row.studentId)).toEqual(['b', 'a'])
  canvas.vm.$emit('dragStart', 'a')
  wrapper.findComponent(UnassignedStudentPanel).vm.$emit('dropToUnassigned')
  await flushPromises()
  expect(chart.seats[1].studentId).toBeNull()
  canvas.vm.$emit('dragStart', 'outside')
  canvas.vm.$emit('dropSeat', chart.seats[1])
  expect(chart.seats[1].studentId).toBeNull()
})
it('值日矩阵换岗保留复制卡片，时段允许多个已在岗组长', async () => {
  const roster = createClassroomTool('duty') as DutyRosterType
  const positionId = roster.sections[0].positions[0].id
  const source = { period: DutyPeriodEnum.Monday, positionId }
  const target = { period: DutyPeriodEnum.Tuesday, positionId }
  roster.assignments = [
    { ...source, studentIds: ['a', 'b'] },
    { period: DutyPeriodEnum.Friday, positionId, studentIds: ['a'] }
  ]
  const wrapper = mount(ApiDutyBoard, {
    props: {
      modelValue: roster,
      students: [
        { id: 'a', name: '甲' },
        { id: 'b', name: '乙' }
      ]
    },
    global
  })
  wrappers.push(wrapper)
  const matrix = wrapper.findComponent(DutyScheduleMatrix)
  matrix.vm.$emit('dragStudentStart', 'a', source)
  matrix.vm.$emit('dropStudent', target)
  await flushPromises()
  expect(roster.studentCardCounts?.a).toBe(2)
  matrix.vm.$emit('dragStudentStart', 'a', target)
  await wrapper.find('aside').trigger('drop')
  expect(roster.studentCardCounts?.a).toBe(2)
  matrix.vm.$emit('dragStudentStart', 'a', undefined)
  matrix.vm.$emit('dropStudent', source)
  await flushPromises()
  for (const studentId of ['a', 'b']) {
    matrix.vm.$emit('studentContext', studentId, source, 0, 0)
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '设置 / 取消时段组长')!
      .trigger('click')
  }
  expect(roster.leaders.map((row) => row.studentId)).toEqual(['a', 'b'])
})

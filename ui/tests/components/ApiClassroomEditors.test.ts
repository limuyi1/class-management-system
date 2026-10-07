import { defineComponent, h, ref } from 'vue'
import { afterEach, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus, { ElSelect } from 'element-plus'
import ApiSeatingEditor from '@/views/workspace-api/ApiSeatingEditor.vue'
import ApiDutyEditor from '@/views/workspace-api/ApiDutyEditor.vue'
import { createClassroomTool } from '@/utils/apiClassroomToolUtil'
import { createSeats } from '@/utils/seating-chart/seatingChartUtil'
import type { SeatingChartType } from '@/types/SeatingChart'
import type { DutyRosterType } from '@/types/DutyRoster'

const wrappers: Array<ReturnType<typeof mount>> = []
afterEach(() => {
  wrappers.forEach((wrapper) => wrapper.unmount())
  wrappers.length = 0
})
const global = {
  plugins: [ElementPlus],
  stubs: { SeatingRoleManagementDialog: true, FontAwesomeIcon: true }
}
it('座位选择回传局部草稿，自动释放学生原座位，不修改输入方案', async () => {
  const original = createClassroomTool('seating') as SeatingChartType
  original.rows = 1
  original.columns = 2
  original.seats = createSeats(1, 2)
  original.seats[0].studentId = 'student'
  const draft = ref(original)
  const host = defineComponent({
    setup: () => () =>
      h(ApiSeatingEditor, {
        chart: draft.value,
        students: [{ id: 'student', name: '甲' }],
        'onUpdate:chart': (value: SeatingChartType) => {
          draft.value = value
        }
      })
  })
  const wrapper = mount(host, { global })
  wrappers.push(wrapper)
  await flushPromises()
  const selects = wrapper.findAllComponents(ElSelect)
  // 固定学生多选之后依次是两个普通座位。
  selects[2].vm.$emit('change', 'student')
  await flushPromises()
  expect(draft.value.seats.map((seat) => seat.studentId)).toEqual([null, 'student'])
  expect(original.seats.map((seat) => seat.studentId)).toEqual(['student', null])
})
it('值日学生选择回传安排，保留原始输入，模式和岗位关系不变', async () => {
  const original = createClassroomTool('duty') as DutyRosterType
  original.sections = original.sections.slice(0, 1)
  original.sections[0].positions = original.sections[0].positions.slice(0, 1)
  const wrapper = mount(ApiDutyEditor, {
    props: { roster: original, students: [{ id: 'student', name: '甲' }] },
    global
  })
  wrappers.push(wrapper)
  await flushPromises()
  const selects = wrapper.findAllComponents(ElSelect)
  selects[1].vm.$emit('change', ['student'])
  await flushPromises()
  const emitted = wrapper.emitted('update:roster')!
  const draft = emitted[emitted.length - 1][0] as DutyRosterType
  expect(draft.assignments[0].studentIds).toEqual(['student'])
  expect(draft.assignments[0].period).toBe('monday')
  expect(original.assignments).toEqual([])
})

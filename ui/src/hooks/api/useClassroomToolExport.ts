import { onScopeDispose, ref } from 'vue'
import { apiRequest } from '@/api/client'
import { reconcileClassroomTool } from '@/utils/apiClassroomToolUtil'
import type { ToolDraftContentType } from '@/utils/apiClassroomToolUtil'
import type { ClassroomToolRecordType, ClassroomToolStateType } from '@/types/ApiClassroomTools'

/** 导出只读取已保存快照，账号切换、名单变更或撤权后终止下载。 */
export function useClassroomToolExport(owner: () => string, workspace: () => string) {
  const visible = ref(false)
  const record = ref<ClassroomToolRecordType | null>(null)
  const names = ref<Record<string, string>>({})
  let alive = true
  let generation = 0
  let capturedScope = ''
  const scope = () => `${owner()}:${workspace()}`
  function reset(): void {
    generation++
    visible.value = false
    record.value = null
    names.value = {}
  }
  async function open(id: string): Promise<void> {
    const current = scope()
    const sequence = ++generation
    const fresh = await apiRequest<ClassroomToolStateType>(`/workspaces/${workspace()}/tools`, {
      ownerId: owner()
    })
    if (!alive || current !== scope() || sequence !== generation) return
    const selected = fresh.tools.find((row) => row.id === id)
    if (!selected) throw new Error('方案已删除，请刷新')
    const list =
      selected.content.studentSource === 'excel'
        ? selected.content.excelSource?.students || []
        : fresh.students
            .filter((row) => !row.disabled && !row.departed)
            .map((row) => ({ id: row.studentId, name: row.name }))
    const content = JSON.parse(JSON.stringify(selected.content)) as ToolDraftContentType
    reconcileClassroomTool(content, list)
    if (JSON.stringify(content) !== JSON.stringify(selected.content))
      throw new Error('方案包含已停用或删除的学生，请编辑并保存后再导出')
    record.value = JSON.parse(JSON.stringify(selected)) as ClassroomToolRecordType
    names.value = Object.fromEntries(list.map((row) => [row.id, row.name]))
    capturedScope = current
    visible.value = true
  }
  async function authorize(): Promise<void> {
    const sequence = generation
    const selected = record.value
    if (!alive || !selected || !visible.value || capturedScope !== scope())
      throw new Error('导出已取消')
    const fresh = await apiRequest<ClassroomToolStateType>(`/workspaces/${workspace()}/tools`, {
      ownerId: owner()
    })
    if (!alive || capturedScope !== scope() || sequence !== generation || !visible.value)
      throw new Error('账号或学期已变更，导出已取消')
    if (
      JSON.stringify(fresh.tools.find((row) => row.id === selected.id)) !== JSON.stringify(selected)
    )
      throw new Error('方案已变更，请重新打开导出')
    const list =
      selected.content.studentSource === 'excel'
        ? selected.content.excelSource?.students || []
        : fresh.students
            .filter((row) => !row.disabled && !row.departed)
            .map((row) => ({ id: row.studentId, name: row.name }))
    if (
      JSON.stringify(Object.fromEntries(list.map((row) => [row.id, row.name]))) !==
      JSON.stringify(names.value)
    )
      throw new Error('学生名单已变更，请重新打开导出')
  }
  onScopeDispose(() => {
    alive = false
    reset()
  })
  return { visible, record, names, reset, open, authorize }
}

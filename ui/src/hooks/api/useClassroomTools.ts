import { computed, ref } from 'vue'
import { apiRequest } from '@/api/client'
import { useScopedApiResource } from './useScopedApiResource'
import { createClassroomTool, reconcileClassroomTool } from '@/utils/apiClassroomToolUtil'
import type { ToolDraftContentType } from '@/utils/apiClassroomToolUtil'
import type {
  ClassroomToolStateType,
  ClassroomToolRecordType,
  ClassroomToolKindType
} from '@/types/ApiClassroomTools'

/** 草稿只存在当前作用域，失败保留内容和原版本，不能自动改版本强行覆盖。 */
export function useClassroomTools(owner: () => string, workspace: () => string) {
  const resource = useScopedApiResource<ClassroomToolStateType>(
    owner,
    workspace,
    (ownerId, workspaceId, signal) =>
      apiRequest(`/workspaces/${workspaceId}/tools`, { ownerId, signal })
  )
  const draft = ref<ToolDraftContentType | null>(null)
  const kind = ref<ClassroomToolKindType>('seating')
  const expectedVersion = ref(0)
  const initial = ref('')
  const students = computed(() =>
    draft.value?.studentSource === 'excel'
      ? draft.value.excelSource?.students || []
      : (resource.state.value?.students || [])
          .filter((row) => !row.disabled && !row.departed)
          .map((row) => ({ id: row.studentId, name: row.name }))
  )
  const hasDraft = computed(() =>
    Boolean(
      draft.value && (!expectedVersion.value || JSON.stringify(draft.value) !== initial.value)
    )
  )
  function reset(): void {
    draft.value = null
    initial.value = ''
    expectedVersion.value = 0
  }
  function edit(record: ClassroomToolRecordType): void {
    kind.value = record.kind
    draft.value = JSON.parse(JSON.stringify(record.content)) as ToolDraftContentType
    expectedVersion.value = record.version
    initial.value = JSON.stringify(draft.value)
    reconcileClassroomTool(draft.value, students.value)
  }
  function create(value: ClassroomToolKindType): void {
    kind.value = value
    draft.value = createClassroomTool(value)
    expectedVersion.value = 0
    initial.value = ''
  }
  /** 复制产生全新方案和版本，不复用原方案的身份或时间戳。 */
  function copy(record: ClassroomToolRecordType): void {
    edit(record)
    if (!draft.value) return
    draft.value.id = crypto.randomUUID()
    draft.value.name = `${draft.value.name.slice(0, 115)} 副本`
    expectedVersion.value = 0
    initial.value = ''
  }
  async function save(): Promise<void> {
    if (!draft.value) return
    const id = draft.value.id
    // 固定提交内容，保存中的 UI 禁止继续修改，响应丢失时可使用相同幂等键重试。
    await resource.write(`/workspaces/${workspace()}/tools/${id}`, 'PUT', {
      expectedVersion: expectedVersion.value,
      kind: kind.value,
      content: JSON.parse(JSON.stringify(draft.value))
    })
    const record = resource.state.value?.tools.find((item) => item.id === id)
    if (record) edit(record)
  }
  return {
    ...resource,
    draft,
    kind,
    expectedVersion,
    students,
    hasDraft,
    edit,
    create,
    reset,
    copy,
    save
  }
}

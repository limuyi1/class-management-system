/** 当前页面绑定的工作区版本，切换后旧页面不能再写入业务数据。 */
let workspaceRevision: string | null = null

/** 在启动或恢复备份后绑定当前工作区。 */
export function bindWorkspaceRevision(revision: string | null): void {
  workspaceRevision = revision
}

/** 测试及旧版本初始化阶段没有绑定工作区。 */
export function getWorkspaceRevision(): string | null {
  return workspaceRevision
}

/** 当前页面尚未完成的导出任务；不写入数据库，也不影响其他页面。 */
const pendingTasks = new Map<symbol, string>()

/** 登记临时任务并返回释放函数，允许多个导出任务独立持有锁。 */
export function blockWorkspaceChanges(reason: string): () => void {
  const token = Symbol('workspace-task')
  pendingTasks.set(token, reason)
  return () => {
    pendingTasks.delete(token)
  }
}

/** 切换、删除或恢复学期前检查本页面任务，避免刷新丢失导出结果。 */
export function assertWorkspaceTasksFinished(): void {
  const reason = pendingTasks.values().next().value
  if (reason) throw new Error(reason)
}

const leaveGuards = new Map<symbol, () => Promise<boolean>>()
/** 当前服务器工作台注册草稿离开检查，顶部学期切换复用页面保存和放弃流程。 */
export function registerWorkspaceLeaveGuard(guard: () => Promise<boolean>): () => void {
  const id = Symbol('workspace-draft')
  leaveGuards.set(id, guard)
  return () => {
    leaveGuards.delete(id)
  }
}
/** 未保存表单、上传或导出尚未处理时不切换学期。 */
export async function confirmWorkspaceLeave(): Promise<boolean> {
  for (const guard of leaveGuards.values()) if (!(await guard())) return false
  return true
}

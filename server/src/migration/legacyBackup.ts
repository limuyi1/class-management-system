import { createHash } from 'node:crypto'
export type LegacyRowType = Record<string, unknown>
export interface LegacyPeriodType {
  id: string
  classId: string
  className: string
  termName: string
  createdAt?: string
  references?: { periodId: string; prop: string }[]
}
export interface LegacyPlanType {
  periods: LegacyPeriodType[]
  snapshots: Map<string, LegacyRowType>
  tables: Map<string, LegacyRowType[]>
  warnings: string[]
}
const row = (value: unknown): LegacyRowType => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('备份记录格式无效')
  return value as LegacyRowType
}
/** 解析 Dexie V4/V5 的实际分块及 Typeson 容器，不读取浏览器数据库。 */
export function parseLegacyBackup(value: unknown): LegacyPlanType {
  const backup = row(value),
    data = row(backup.data)
  if (backup.formatName !== 'dexie' || backup.formatVersion !== 1 || !Array.isArray(data.data))
    throw new Error('仅支持 Dexie 导出备份')
  const tables = new Map<string, LegacyRowType[]>()
  for (const chunkValue of data.data) {
    const chunk = row(chunkValue)
    if (typeof chunk.tableName !== 'string') throw new Error('表名无效')
    const values = Array.isArray(chunk.rows) ? chunk.rows : row(chunk.rows).$
    if (!Array.isArray(values)) throw new Error('备份行无效')
    const rows = values.map((value) =>
      row(chunk.inbound === false ? (value as unknown[])[1] : value)
    )
    tables.set(chunk.tableName, [...(tables.get(chunk.tableName) || []), ...rows])
  }
  const main = (name: string) =>
    tables.get(name)?.find((item) => item.id === 'main') || tables.get(name)?.[0]
  const catalog = main('workspaces'),
    snapshots = new Map<string, LegacyRowType>()
  for (const snapshot of tables.get('workspace_snapshots') || [])
    snapshots.set(String(snapshot.id), snapshot)
  let periods = (catalog?.periods || []) as LegacyPeriodType[]
  if (!Array.isArray(periods) || periods.length > 1000) throw new Error('班级学期目录无效或过多')
  if (!periods.length)
    periods = [
      { id: 'legacy-main', classId: 'legacy-class', className: '默认班级', termName: '历史学期' }
    ]
  const active = String(catalog?.activePeriodId || periods[0]!.id)
  if (!periods.some((period) => period.id === active)) throw new Error('活动学期不在目录中')
  const students = main('student_dataset'),
    settings = main('score_settings'),
    preferences = main('app_preferences')
  if (students || settings)
    snapshots.set(active, {
      id: active,
      students: students?.students || [],
      setting: settings,
      preferences,
      scoreNotice: main('score_notice'),
      seatingCharts: main('seating_charts'),
      dutyRosters: main('duty_rosters')
    })
  for (const period of periods)
    if (!snapshots.has(period.id))
      throw new Error(`缺少学期快照：${period.className}/${period.termName}`)
  return {
    periods,
    snapshots,
    tables,
    warnings: ['不迁移已停用错题本、主题设备偏好、AI Key 和登录凭据。']
  }
}
/** 将全局实体旧 ID 映射到账号命名空间，同一备份可迁入不同账号。 */
export function migrationId(owner: string, kind: string, id: string): string {
  const hash = createHash('sha256').update(`${owner}:${kind}:${id}`).digest('hex').slice(0, 32)
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20)}`
}
/** Blob 的 Typeson 原始表示为 {type,data:base64}，损坏或引用未展开时拒绝。 */
export function legacyImage(value: unknown): { buffer: Buffer; mimeType: string } {
  const blob = row(value)
  if (
    typeof blob.data !== 'string' ||
    typeof blob.type !== 'string' ||
    blob.data.length > 12 * 1024 * 1024
  )
    throw new Error('附件 Blob 数据无效')
  const buffer = Buffer.from(blob.data, 'base64')
  if (buffer.toString('base64') !== blob.data) throw new Error('附件 Base64 校验失败')
  return { buffer, mimeType: blob.type }
}

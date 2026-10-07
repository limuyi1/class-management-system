import { inspectAttachment, storeAttachment } from '../services/attachmentFiles.js'
import { legacyImage, migrationId } from './legacyBackup.js'
import type { LegacyRowType, LegacyPeriodType, LegacyPlanType } from './legacyBackup.js'
import type { DatabaseType } from '../types/Account.js'

/** 转换学期课堂方案及通知文档，保持历史学生身份映射。 */
export function importLegacyDocuments(
  database: DatabaseType,
  owner: string,
  period: LegacyPeriodType,
  snapshot: LegacyRowType,
  id: string,
  assessmentIds: Map<string, string>,
  idMap: Record<string, string>,
  now: number
): void {
  const remap = (value: unknown): unknown =>
    typeof value === 'string' && idMap[`student:${value}`]
      ? idMap[`student:${value}`]
      : Array.isArray(value)
        ? value.map(remap)
        : value && typeof value === 'object'
          ? Object.fromEntries(
              Object.entries(value).map(([key, item]) => [
                idMap[`student:${key}`] || key,
                remap(item)
              ])
            )
          : value
  const ui = {
    dataSource: { students: remap(snapshot.students || []) },
    setting: snapshot.setting || {},
    configuration: remap(snapshot.preferences || {}),
    ...(snapshot.overviewAnalysis ? { overviewAnalysis: snapshot.overviewAnalysis } : {}),
    ...(snapshot.scoreNotice ? { scoreNotice: remap(snapshot.scoreNotice) } : {})
  }
  database
    .prepare("INSERT INTO workspace_documents VALUES(?,?,'v5-ui',?,1,?)")
    .run(id, owner, JSON.stringify(ui), now)
  for (const [field, kind] of [
    ['seatingCharts', 'seating'],
    ['dutyRosters', 'duty']
  ] as const) {
    const collection = snapshot[field] as LegacyRowType | undefined
    const records = collection?.[kind === 'seating' ? 'charts' : 'rosters']
    if (Array.isArray(records))
      for (const raw of records) {
        const content = structuredClone(raw) as Record<string, unknown>
        const toolId = migrationId(owner, 'tool', `${period.id}:${kind}:${String(content.id)}`)
        content.id = toolId
        // 旧方案内的长期学生身份与名单按同一映射转换。
        const replace = (value: unknown): unknown =>
          typeof value === 'string' && idMap[`student:${value}`]
            ? idMap[`student:${value}`]
            : Array.isArray(value)
              ? value.map(replace)
              : value && typeof value === 'object'
                ? Object.fromEntries(
                    Object.entries(value).map(([key, item]) => [key, replace(item)])
                  )
                : value
        database
          .prepare(
            'INSERT INTO classroom_tools(id,workspaceId,ownerId,kind,contentJson,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?)'
          )
          .run(toolId, id, owner, kind, JSON.stringify(replace(content)), now, now)
      }
  }
  if (snapshot.scoreNotice) {
    const notice = snapshot.scoreNotice as Record<string, unknown>,
      subjects = (notice.subjects || []) as Record<string, unknown>[]
    // 外部 Excel 通知具有独立成绩和名单，完整留档，不复制到本期教学成绩。
    database
      .prepare("INSERT INTO workspace_documents VALUES(?,?,'legacy-score-notice',?,1,?)")
      .run(id, owner, JSON.stringify(notice), now)
    const unmapped = subjects.some(
      (subject) => !assessmentIds.has(`${period.id}:${subject.sourceColumn}`)
    )
    if (unmapped) return
    const config = {
      title: String(notice.title || '成绩通知单'),
      noticeDate: String(notice.noticeDate || new Date().toISOString().slice(0, 10)),
      mode: notice.mode === 'grade' ? 'grade' : 'score',
      subjects: subjects.map((subject) => {
        const rule = (subject.rule || {}) as Record<string, unknown>
        const assessmentId = assessmentIds.get(`${period.id}:${subject.sourceColumn}`)
        if (!assessmentId) throw new Error('通知单科目未映射到测评')
        return {
          assessmentId,
          maxScore: Number(rule.maxScore || 100),
          gradeAMin: Number(rule.gradeAMin || 85),
          gradeBMin: Number(rule.gradeBMin || 60)
        }
      })
    }
    database
      .prepare("INSERT INTO workspace_documents VALUES(?,?,'score-notice',?,1,?)")
      .run(id, owner, JSON.stringify(config), now)
  }
}

/** 转换共用打印素材与账号设置，不导入密钥或设备偏好。 */
export function importLegacyPapers(
  database: DatabaseType,
  owner: string,
  plan: LegacyPlanType,
  idMap: Record<string, string>,
  directory: string,
  now: number
): void {
  for (const draft of plan.tables.get('paper_layout_drafts') || []) {
    const paperId = migrationId(owner, 'paper', String(draft.id)),
      items = [] as Record<string, unknown>[]
    const settings = (draft.settings || {
      pageType: 'A4',
      orientation: 'landscape',
      layoutMode: 'double',
      fitMode: 'slot',
      columns: 2,
      margin: 0,
      gap: 0
    }) as Record<string, unknown>
    for (const [index, raw] of ((draft.items || []) as Record<string, unknown>[]).entries()) {
      const image = legacyImage(raw.blob),
        info = inspectAttachment(image.buffer, image.mimeType),
        itemId = String(raw.id || `item-${index}`),
        attachmentId =
          idMap[`attachment:${raw.attachmentId}`] ||
          migrationId(owner, 'attachment', `${draft.id}:${index}`)
      storeAttachment(directory, owner, info.hash, image.buffer)
      database
        .prepare('INSERT OR IGNORE INTO attachment_blobs VALUES(?,?,?,?)')
        .run(owner, info.hash, info.size, now)
      database
        .prepare('INSERT INTO paper_files VALUES(?,?,?,?,?)')
        .run(owner, paperId, itemId, info.hash, info.mimeType)
      items.push({
        id: itemId,
        attachmentId,
        attachmentVersion: 1,
        x: Number(raw.x || 0),
        y: Number(raw.y || 0),
        documentY: Number(raw.documentY || raw.y || 0),
        pageIndex: Number(raw.pageIndex || 0),
        width: Number(raw.width || 100),
        height: Number(raw.height || 100),
        zIndex: Number(raw.zIndex || index + 1)
      })
    }
    database
      .prepare("INSERT INTO business_resources VALUES(?,'paper',?,NULL,?,?,1,NULL,?)")
      .run(
        owner,
        paperId,
        String(draft.name || '历史试卷'),
        JSON.stringify({ settings, items }),
        now
      )
  }
  const preferences = plan.tables.get('app_preferences')?.[0],
    tools = plan.tables.get('tool_preferences')?.[0],
    ai = plan.tables.get('ai_settings')?.[0]
  database.prepare("INSERT INTO business_resources VALUES(?,'settings',?,NULL,?,?,1,NULL,?)").run(
    owner,
    owner,
    '账号业务设置',
    JSON.stringify({
      fontFamily: 'system-ui',
      fontSize: Number(preferences?.fontSize || 14),
      paperType: String(preferences?.pageType || 'A4'),
      prompts:
        typeof ai?.prompts === 'object' && ai.prompts
          ? Object.values(ai.prompts)
              .filter((value) => typeof value === 'string')
              .join('\n')
              .slice(0, 8000)
          : '',
      layout: {
        ...(preferences
          ? Object.fromEntries(
              Object.entries(preferences).filter(
                ([key]) =>
                  !['evaluationHandwriteFont', 'recentScoreEntries', 'id', '$types'].includes(key)
              )
            )
          : {}),
        tools: tools
          ? Object.fromEntries(
              Object.entries(tools).filter(
                ([key]) => !['id', '$types', 'cardTemplates'].includes(key)
              )
            )
          : {},
        aiPrompts: typeof ai?.prompts === 'object' ? ai.prompts : {}
      },
      templates: remapAttachments(tools?.cardTemplates || [], idMap)
    }),
    now
  )
}

/** 模板中的素材引用使用服务器账号命名空间，避免迁移后背景图片失联。 */
function remapAttachments(value: unknown, idMap: Record<string, string>): unknown {
  if (typeof value === 'string') return idMap[`attachment:${value}`] || value
  if (Array.isArray(value)) return value.map((item) => remapAttachments(item, idMap))
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, remapAttachments(item, idMap)])
    )
  return value
}

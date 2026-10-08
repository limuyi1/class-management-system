import { createHash } from 'node:crypto'
import { transaction } from '../../db/migrate.js'
import { scoreStateInTransaction } from '../scoreProjection.js'
import { listComments } from '../../repositories/teaching.js'
import { getWorkspace } from '../../repositories/workspaces.js'
import { validateContext } from '../mutations.js'
import { requireTeachingOwner } from '../../policies/access.js'
import { resolveTagCategories } from '../tagCategories.js'
import type { AccessContextType, DatabaseType } from '../../types/Account.js'
import type { V5StateType } from '../../../../packages/shared/src/V5.js'

/** 读取版本化 UI 文档，仅补充原页面交互状态，不代替规范成绩和名单。 */
export function readV5Document(
  database: DatabaseType,
  owner: string,
  id: string
): Record<string, Record<string, unknown>> {
  const row = database
    .prepare(
      "SELECT contentJson FROM workspace_documents WHERE ownerId=? AND workspaceId=? AND type='v5-ui'"
    )
    .get(owner, id) as { contentJson: string } | undefined
  return row ? (JSON.parse(row.contentJson) as Record<string, Record<string, unknown>>) : {}
}
/** 同一事务投影原页面所需数据，指纹覆盖业务及账号配置，跨接口写入也能识别。 */
export function v5StateInTransaction(
  database: DatabaseType,
  context: AccessContextType,
  id: string
): V5StateType {
  validateContext(database, context)
  requireTeachingOwner(database, context.ownerId)
  const scores = scoreStateInTransaction(database, context, id)
  const comments = listComments(database, context.ownerId, id)
  const extras = readV5Document(database, context.ownerId, id)
  const settingsRow = database
    .prepare(
      "SELECT * FROM business_resources WHERE ownerId=? AND kind='settings' AND workspaceId IS NULL AND deletedAt IS NULL ORDER BY updatedAt DESC LIMIT 1"
    )
    .get(context.ownerId) as { id: string; version: number; contentJson: string } | undefined
  const settings = settingsRow
    ? (JSON.parse(settingsRow.contentJson) as Record<string, unknown>)
    : {}
  const tagsRow = database
    .prepare(
      "SELECT * FROM business_resources WHERE ownerId=? AND kind='tags' AND workspaceId=? AND deletedAt IS NULL ORDER BY updatedAt DESC LIMIT 1"
    )
    .get(context.ownerId, id) as { id: string; version: number; contentJson: string } | undefined
  const tags = tagsRow
    ? (JSON.parse(tagsRow.contentJson) as {
        categories: string[]
        categoryLabels?: Record<string, string>
        tags: Record<string, string[]>
        assignments: Record<string, string[]>
      })
    : undefined
  const scoreMap = new Map(
    scores.scores.map((value) => [`${value.studentId}:${value.assessmentId}`, value.value])
  )
  const students = scores.students.map((student) => {
    const old = (extras.dataSource?.students as Record<string, unknown>[] | undefined)?.find(
      (row) => row.studentId === student.studentId
    )
    const row: Record<string, unknown> = {
      ...old,
      ...student,
      ...(student.departedAt ? { departedAt: new Date(student.departedAt).toISOString() } : {})
    }
    delete row.version
    if (!student.departedAt) delete row.departedAt
    for (const column of scores.assessments)
      row[column.prop] = scoreMap.get(`${student.studentId}:${column.id}`) ?? null
    row.comment = comments.find((value) => value.studentId === student.studentId)?.text || ''
    if (tags) {
      const oldTags = old?.tags as Record<string, string[]> | undefined
      const assigned = tags.assignments[student.studentId] || []
      const oldValues = oldTags ? Object.values(oldTags).flat() : []
      const compatible =
        oldTags &&
        oldValues.every((value) => assigned.includes(value)) &&
        assigned.every((value) => oldValues.includes(value))
      row.tags = Object.fromEntries(
        tags.categories.map((category) => [
          category,
          (compatible ? oldTags[category] || [] : assigned).filter((value) =>
            tags.tags[category]?.includes(value)
          )
        ])
      )
    }
    return row
  })
  const columns = [
    { prop: 'name', label: '姓名', disabled: false },
    ...scores.assessments.map((column) => ({
      prop: column.prop,
      label: column.label,
      disabled: column.disabled,
      ...(column.fullMark === null ? {} : { fullMark: column.fullMark })
    }))
  ]
  const tools = database
    .prepare(
      'SELECT kind,contentJson,version,id FROM classroom_tools WHERE ownerId=? AND workspaceId=? AND deletedAt IS NULL ORDER BY createdAt,id'
    )
    .all(context.ownerId, id) as {
    kind: string
    contentJson: string
    version: number
    id: string
  }[]
  const legacyNotice = database
    .prepare(
      "SELECT contentJson FROM workspace_documents WHERE ownerId=? AND workspaceId=? AND type='legacy-score-notice'"
    )
    .get(context.ownerId, id) as { contentJson: string } | undefined
  const stores: V5StateType['stores'] = {
    ...extras,
    dataSource: { students },
    setting: {
      ...extras.setting,
      scoreColumns: columns,
      ...(tags
        ? {
            tags: tags.tags,
            tagCategories: resolveTagCategories(
              tags.categories,
              tags.categoryLabels,
              extras.setting?.tagCategories as { prop: string; label: string }[] | undefined
            )
          }
        : {})
    },
    configuration: {
      ...Object.fromEntries(
        Object.entries((settings.layout || {}) as Record<string, unknown>).filter(
          ([key]) =>
            ![
              'tools',
              'aiPrompts',
              'inputScoreTab',
              'recentScoreEntries',
              'scoreFullMark'
            ].includes(key)
        )
      ),
      inputScoreTab: extras.configuration?.inputScoreTab ?? null,
      recentScoreEntries: extras.configuration?.recentScoreEntries || {},
      scoreFullMark: scores.workspace.scoreFullMark,
      ...(settings.fontSize ? { fontSize: settings.fontSize } : {})
    },
    tools: {
      ...((settings.layout as Record<string, unknown> | undefined)?.tools as Record<
        string,
        unknown
      >),
      cardTemplates: settings.templates || []
    },
    aiConfig: {
      prompts: (settings.layout as Record<string, unknown> | undefined)?.aiPrompts || {}
    },
    seatingChart: {
      ...extras.seatingChart,
      charts: tools
        .filter((row) => row.kind === 'seating')
        .map((row) => JSON.parse(row.contentJson))
    },
    dutyRoster: {
      ...extras.dutyRoster,
      rosters: tools.filter((row) => row.kind === 'duty').map((row) => JSON.parse(row.contentJson))
    },
    ...(extras.scoreNotice
      ? {}
      : legacyNotice
        ? { scoreNotice: JSON.parse(legacyNotice.contentJson) as Record<string, unknown> }
        : {})
  }
  const fingerprint = createHash('sha256')
    .update(JSON.stringify({ scores, comments, extras, settingsRow, tagsRow, tools }))
    .digest('hex')
  return { workspaceId: id, fingerprint, stores }
}
/** 原页面初始化及刷新在一致事务读取，禁止失败时用默认空状态覆盖服务器。 */
export function readV5State(
  database: DatabaseType,
  context: AccessContextType,
  id: string
): V5StateType {
  return transaction(database, () => {
    getWorkspace(database, context.ownerId, id)
    return v5StateInTransaction(database, context, id)
  })
}

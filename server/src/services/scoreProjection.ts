import { transaction } from '../db/migrate.js'
import { getWorkspace, listEnrollments } from '../repositories/workspaces.js'
import { getAssessment, listAssessments, listScores } from '../repositories/scores.js'
import { audit } from './accounts.js'
import { validateContext } from './mutations.js'
import type { AccessContextType, DatabaseType } from '../types/Account.js'
import type {
  ReferenceInputType,
  ReferenceProjectionType,
  ScoreRecordType,
  ScoreStateType,
  ScoreStatisticType
} from '../../../packages/shared/src/Scores.js'

/** 竞争排名：并列 1、1、3；按来源完整有效名单计算，不能用当前名单重排。 */
function ranksFor(scores: ScoreRecordType[], enabledIds: Set<string>): Map<string, number> {
  const values = scores.filter((score) => enabledIds.has(score.studentId) && score.value !== null)
  const ordered = values.map((score) => score.value!).sort((one, two) => two - one)
  return new Map(values.map((score) => [score.studentId, ordered.indexOf(score.value!) + 1]))
}
/** 参照只组装只读投影；不向本期 scores 表插入历史值。 */
function referencesFor(
  database: DatabaseType,
  ownerId: string,
  workspaceId: string,
  studentIds: Set<string>
): ReferenceProjectionType[] {
  const relations = database
    .prepare(
      'SELECT sourceWorkspaceId,assessmentId FROM workspace_references WHERE ownerId=? AND workspaceId=? ORDER BY sortIndex,assessmentId'
    )
    .all(ownerId, workspaceId) as ReferenceInputType[]
  const cache = new Map<string, { scores: ScoreRecordType[]; enabledIds: Set<string> }>()
  return relations.map((relation) => {
    const source = getWorkspace(database, ownerId, relation.sourceWorkspaceId)
    const assessment = getAssessment(database, ownerId, source.id, relation.assessmentId)
    let data = cache.get(source.id)
    if (!data) {
      // 转出者保留来源学期成绩与排名，禁用和软删除名单不参与来源排名。
      data = {
        scores: listScores(database, ownerId, source.id),
        enabledIds: new Set(
          listEnrollments(database, ownerId, source.id)
            .filter((row) => !row.disabled)
            .map((row) => row.studentId)
        )
      }
      cache.set(source.id, data)
    }
    const scores = data.scores.filter((score) => score.assessmentId === assessment.id)
    const ranks = ranksFor(scores, data.enabledIds)
    return {
      ...relation,
      prop: `__history_${source.id.replaceAll('-', '')}_${assessment.prop}`,
      label: `${source.className} · ${source.termName} · ${assessment.label}〔参照〕`,
      fullMark: assessment.fullMark ?? source.scoreFullMark,
      scores: scores
        .filter((score) => studentIds.has(score.studentId))
        .map((score) => ({ ...score, rank: ranks.get(score.studentId) ?? null }))
    }
  })
}
/** 本期统计只接受本期有效名单和启用测评，历史列没有机会进入统计输入。 */
function statisticsFor(state: Omit<ScoreStateType, 'statistics'>): ScoreStatisticType[] {
  const ids = new Set(
    state.students
      .filter((student) => !student.disabled && !student.departed)
      .map((student) => student.studentId)
  )
  return state.assessments
    .filter((assessment) => !assessment.disabled)
    .map((assessment) => {
      const values = state.scores
        .filter(
          (score) =>
            score.assessmentId === assessment.id && ids.has(score.studentId) && score.value !== null
        )
        .map((score) => score.value!)
      return {
        assessmentId: assessment.id,
        count: values.length,
        missing: ids.size - values.length,
        average: values.length
          ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2))
          : null,
        min: values.length ? Math.min(...values) : null,
        max: values.length ? Math.max(...values) : null
      }
    })
}
/** 所有目录、名单、分数、参照与审计在同一短事务读取，避免半旧半新的快照。 */
export function readScoreState(
  database: DatabaseType,
  context: AccessContextType,
  workspaceId: string,
  requestId: string
): ScoreStateType {
  return transaction(database, () => {
    const state = scoreStateInTransaction(database, context, workspaceId)
    if (context.actor.id !== context.ownerId)
      audit(database, context.actor.id, context.ownerId, 'SCORES_READ', workspaceId, requestId)
    return state
  })
}

/** 供成绩页和教学导出复用；调用方必须已开启事务，禁止嵌套 BEGIN。 */
export function scoreStateInTransaction(
  database: DatabaseType,
  context: AccessContextType,
  workspaceId: string
): ScoreStateType {
  validateContext(database, context)
  const workspace = getWorkspace(database, context.ownerId, workspaceId)
  const students = listEnrollments(database, context.ownerId, workspaceId)
  const state = {
    workspace,
    students,
    assessments: listAssessments(database, context.ownerId, workspaceId),
    scores: listScores(database, context.ownerId, workspaceId),
    references: referencesFor(
      database,
      context.ownerId,
      workspaceId,
      new Set(students.map((row) => row.studentId))
    )
  }
  return { ...state, statistics: statisticsFor(state) }
}

import { importLegacyDocuments, importLegacyPapers } from './legacyDocuments.js'
import { randomUUID } from 'node:crypto'
import { audit } from '../services/accounts.js'
import { transaction } from '../db/migrate.js'
import { inspectAttachment, storeAttachment } from '../services/attachmentFiles.js'
import { parseLegacyBackup, migrationId, legacyImage } from './legacyBackup.js'
import { resolveTagCategories } from '../services/tagCategories.js'
import type { LegacyRowType } from './legacyBackup.js'
import type { DatabaseType } from '../types/Account.js'
/** 运维一次性迁入空账号，所有 SQL 同事务；异常不留半份名单和成绩。 */
export function importLegacy(
  database: DatabaseType,
  owner: string,
  backup: unknown,
  directory: string,
  dryRun = false
) {
  const plan = parseLegacyBackup(backup),
    report = {
      workspaces: plan.periods.length,
      students: 0,
      scores: 0,
      attachments: 0,
      warnings: plan.warnings,
      idMap: {} as Record<string, string>
    }
  if (
    !database
      .prepare("SELECT id FROM users WHERE id=? AND role='USER' AND status='ACTIVE'")
      .get(owner)
  )
    throw new Error('目标账号不存在')
  for (const table of ['workspaces', 'attachments', 'business_resources']) {
    const count = database
      .prepare(`SELECT count(*) AS count FROM ${table} WHERE ownerId=?`)
      .get(owner) as { count: number }
    if (count.count) throw new Error('目标账号非空，禁止覆盖迁移')
  }
  const images = new Map<
    string,
    {
      buffer: Buffer
      mimeType: string
      width: number
      height: number
      hash: string
      size: number
      name: string
    }
  >()
  let storageBytes = 0
  for (const file of plan.tables.get('attachments') || []) {
    if (images.has(String(file.id))) throw new Error('附件身份重复')
    const image = legacyImage(file.blob),
      info = inspectAttachment(image.buffer, image.mimeType)
    storageBytes += info.size
    if (storageBytes > 512 * 1024 * 1024) throw new Error('附件容量超过 512 MB')
    images.set(String(file.id), { ...image, ...info, name: String(file.name || '历史图片') })
  }
  const action = () => {
    const now = Date.now(),
      assessmentIds = new Map<string, string>()
    const classes = new Set<string>()
    for (const period of plan.periods) {
      const id = migrationId(owner, 'workspace', period.id),
        classId = migrationId(owner, 'class', period.classId)
      report.idMap[period.id] = id
      if (!classes.has(classId)) {
        classes.add(classId)
        database.prepare('INSERT INTO classes VALUES(?,?,?)').run(classId, owner, now)
      }
      const snapshot = plan.snapshots.get(period.id)!,
        preferences = (snapshot.preferences || {}) as LegacyRowType
      const full = Number(preferences.scoreFullMark || 100)
      if (
        !Number.isFinite(full) ||
        full <= 0 ||
        full > 100000 ||
        !period.className?.trim() ||
        !period.termName?.trim()
      )
        throw new Error('学期名称或满分无效')
      database
        .prepare(
          'INSERT INTO workspaces(id,ownerId,classId,className,termName,scoreFullMark,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?)'
        )
        .run(
          id,
          owner,
          classId,
          period.className,
          period.termName,
          full,
          period.createdAt ? validDate(period.createdAt) : now,
          now
        )
      const setting = (snapshot.setting || {}) as LegacyRowType,
        columns = (setting.scoreColumns || []) as LegacyRowType[]
      const assessments = columns.filter((column) => column.prop !== 'name' && !column.reference)
      if (assessments.length > 200) throw new Error('测评过多')
      for (const [index, column] of assessments.entries()) {
        if (
          column.fullMark != null &&
          (!Number.isFinite(Number(column.fullMark)) ||
            Number(column.fullMark) <= 0 ||
            Number(column.fullMark) > 100000)
        )
          throw new Error('测评满分无效')
        const assessmentId = migrationId(owner, 'assessment', `${period.id}:${column.prop}`)
        assessmentIds.set(`${period.id}:${column.prop}`, assessmentId)
        database
          .prepare(
            'INSERT INTO assessments(id,workspaceId,ownerId,prop,label,sortIndex,disabled,fullMark) VALUES(?,?,?,?,?,?,?,?)'
          )
          .run(
            assessmentId,
            id,
            owner,
            String(column.prop),
            String(column.label),
            index,
            Number(Boolean(column.disabled)),
            column.fullMark == null ? null : Number(column.fullMark)
          )
      }
      const students = (snapshot.students || []) as LegacyRowType[]
      if (!Array.isArray(students) || students.length > 2000) throw new Error('名单过多或格式无效')
      const assignments: Record<string, string[]> = {},
        seen = new Set<string>()
      for (const [index, student] of students.entries()) {
        if (
          typeof student.studentId !== 'string' ||
          !student.studentId ||
          seen.has(student.studentId) ||
          typeof student.name !== 'string' ||
          !student.name.trim()
        )
          throw new Error('学生缺少身份、同一期重复或姓名无效；不会按姓名合并')
        seen.add(student.studentId)
        const studentId = /^[0-9a-f-]{36}$/i.test(student.studentId)
          ? student.studentId
          : migrationId(owner, 'student', student.studentId)
        report.idMap[`student:${student.studentId}`] = studentId
        database.prepare('INSERT OR IGNORE INTO students VALUES(?,?,?)').run(owner, studentId, now)
        database
          .prepare(
            'INSERT INTO enrollments(workspaceId,ownerId,studentId,name,disabled,departed,departedAt,sortIndex) VALUES(?,?,?,?,?,?,?,?)'
          )
          .run(
            id,
            owner,
            studentId,
            student.name,
            Number(Boolean(student.disabled)),
            Number(Boolean(student.departed)),
            student.departedAt ? validDate(String(student.departedAt)) : null,
            index
          )
        report.students++
        for (const column of assessments) {
          const raw = student[String(column.prop)],
            value = raw === null || raw === undefined || raw === '' ? null : Number(raw)
          if (
            value !== null &&
            (typeof raw === 'boolean' ||
              !Number.isFinite(value) ||
              value < 0 ||
              value > Number(column.fullMark ?? full))
          )
            throw new Error('存在无效成绩，禁止静默转为空值')
          if (raw !== undefined) {
            database
              .prepare('INSERT INTO scores VALUES(?,?,?,?,?,1)')
              .run(id, owner, studentId, assessmentIds.get(`${period.id}:${column.prop}`)!, value)
            report.scores++
          }
        }
        if (student.comment)
          database
            .prepare('INSERT INTO comments(workspaceId,ownerId,studentId,text) VALUES(?,?,?,?)')
            .run(id, owner, studentId, String(student.comment))
        if (student.tags && typeof student.tags === 'object')
          assignments[studentId] = Object.values(student.tags as Record<string, string[]>).flat()
      }
      if (setting.tags) {
        const tags = setting.tags as Record<string, string[]>
        const categories = Object.keys(tags)
        const categoryLabels = Object.fromEntries(
          resolveTagCategories(
            categories,
            {},
            setting.tagCategories as { prop: string; label: string }[] | undefined
          ).map(({ prop, label }) => [prop, label])
        )
        database
          .prepare("INSERT INTO business_resources VALUES(?,'tags',?,?,?, ?,1,NULL,?)")
          .run(
            owner,
            id,
            id,
            '评语标签',
            JSON.stringify({ categories, categoryLabels, tags, assignments }),
            now
          )
      }
      importLegacyDocuments(database, owner, period, snapshot, id, assessmentIds, report.idMap, now)
    }
    for (const period of plan.periods)
      for (const reference of period.references || []) {
        const source = plan.periods.find((item) => item.id === reference.periodId),
          assessment = assessmentIds.get(`${reference.periodId}:${reference.prop}`)
        if (!source || source.classId !== period.classId || !assessment)
          throw new Error('历史参照来源缺失或跨班')
        database
          .prepare('INSERT INTO workspace_references VALUES(?,?,?,?,?)')
          .run(
            report.idMap[period.id]!,
            owner,
            report.idMap[reference.periodId]!,
            assessment,
            period.references!.indexOf(reference)
          )
      }
    for (const [oldId, image] of images) {
      const id = migrationId(owner, 'attachment', oldId)
      report.idMap[`attachment:${oldId}`] = id
      storeAttachment(directory, owner, image.hash, image.buffer)
      database
        .prepare('INSERT OR IGNORE INTO attachment_blobs VALUES(?,?,?,?)')
        .run(owner, image.hash, image.size, now)
      database
        .prepare(
          'INSERT INTO attachments(id,ownerId,name,mimeType,size,width,height,hash,version,createdAt,updatedAt,deletedAt) VALUES(?,?,?,?,?,?,?,?,1,?,?,NULL)'
        )
        .run(
          id,
          owner,
          image.name,
          image.mimeType,
          image.size,
          image.width,
          image.height,
          image.hash,
          now,
          now
        )
      report.attachments++
    }
    importLegacyPapers(database, owner, plan, report.idMap, directory, now)
    audit(database, owner, owner, 'LEGACY_MIGRATION', owner, randomUUID())
  }
  if (dryRun) {
    database.exec('BEGIN IMMEDIATE')
    try {
      action()
    } finally {
      database.exec('ROLLBACK')
    }
  } else transaction(database, action)
  return report
}

/** 历史时间必须有效，防止打乱学期参照顺序。 */
function validDate(value: string): number {
  const time = Date.parse(value)
  if (!Number.isFinite(time)) throw new Error('历史日期格式无效')
  return time
}

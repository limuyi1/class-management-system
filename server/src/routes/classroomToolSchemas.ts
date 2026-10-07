import { objectSchema } from './helpers.js'

const text = { type: 'string', maxLength: 120 }
const id = { type: 'string', minLength: 1, maxLength: 128 }
const integer = { type: 'integer', minimum: 0, maximum: 100000 }
const studentId = { anyOf: [id, { type: 'null' }] }
const list = (items: unknown, maxItems = 2000) => ({ type: 'array', items, maxItems })
const record = (properties: Record<string, unknown>, optional: string[] = []) =>
  objectSchema(
    properties,
    Object.keys(properties).filter((key) => !optional.includes(key))
  )
const source = {
  studentSource: { type: 'string', enum: ['system', 'excel'] },
  excelSource: record({
    fileName: { type: 'string', maxLength: 255 },
    students: list(record({ id, name: { ...text, minLength: 1 } }))
  })
}
const base = {
  id,
  name: { ...text, minLength: 1 },
  ...source,
  notes: { type: 'string', maxLength: 5000 },
  createdAt: { type: 'string', maxLength: 40 },
  updatedAt: { type: 'string', maxLength: 40 }
}
const period = {
  type: 'string',
  enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'weekly']
}
const position = record({ id, name: { ...text, minLength: 1 }, sortOrder: integer })
const counts = {
  type: 'object',
  maxProperties: 2000,
  additionalProperties: { type: 'integer', minimum: 0, maximum: 100 }
}
/** 白名单结构控制体积和字段；动态学生键仍在事务内逐一验证归属。 */
export const seatingSchema = record(
  {
    ...base,
    rows: { type: 'integer', minimum: 1, maximum: 20 },
    columns: { type: 'integer', minimum: 1, maximum: 20 },
    aisleAfterColumns: list({ type: 'integer', minimum: 0, maximum: 18 }, 19),
    firstColumnSide: { type: 'string', enum: ['left', 'right'] },
    platformPosition: { type: 'string', enum: ['top', 'bottom'] },
    seats: list(record({ row: integer, column: integer, studentId }), 400),
    rotationFixedStudentIds: list(id),
    specialSeats: list(
      record({
        position: { type: 'string', enum: ['platform-left', 'platform-right'] },
        enabled: { type: 'boolean' },
        studentId
      }),
      2
    ),
    roleDefinitions: list(
      record({
        id,
        subject: text,
        title: text,
        groupName: text,
        shortLabel: text,
        color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
        sortOrder: integer
      }),
      100
    ),
    roleAssignments: list(record({ studentId: id, roleIds: list(id, 100) }))
  },
  ['excelSource', 'rotationFixedStudentIds']
)
export const dutySchema = record(
  {
    ...base,
    mode: { type: 'string', enum: ['daily', 'weekly'] },
    sections: list(
      record(
        {
          id,
          name: { ...text, minLength: 1 },
          kind: { type: 'string', enum: ['indoor', 'cleaning'] },
          leaderStudentId: id,
          sortOrder: integer,
          positions: list(position, 100)
        },
        ['leaderStudentId']
      ),
      30
    ),
    weeklyRows: list(record({ id, sortOrder: integer }), 50),
    assignments: list(
      record({ period, rowId: id, positionId: id, studentIds: list(id, 100) }, ['rowId']),
      5000
    ),
    leaders: list(record({ period, rowId: id, sectionId: id, studentId: id }, ['rowId']), 1500),
    autoAssignCapacities: counts,
    studentCardCounts: counts
  },
  ['excelSource', 'autoAssignCapacities', 'studentCardCounts']
)
export const toolBodySchema = objectSchema(
  {
    expectedVersion: { type: 'integer', minimum: 0 },
    kind: { type: 'string', enum: ['seating', 'duty'] },
    content: { anyOf: [seatingSchema, dutySchema] }
  },
  ['expectedVersion', 'kind', 'content']
)

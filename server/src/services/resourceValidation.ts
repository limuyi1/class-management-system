import { getWorkspace, getEnrollment } from '../repositories/workspaces.js'
import { BusinessError } from './errors.js'
import type { ResourceType } from './resources.js'
import type { AccessContextType, DatabaseType } from '../types/Account.js'

const invalid = (): never => {
  throw new BusinessError(400, 'INVALID_RESOURCE', '内容格式或引用不符合要求')
}
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : invalid()
function strings(value: unknown, max = 2000): string[] {
  if (
    !Array.isArray(value) ||
    value.length > max ||
    value.some((item) => typeof item !== 'string' || item.length > 120)
  )
    invalid()
  return value as string[]
}
/** 只接收三种明确的文档，限制字段和大小，并核对学生、素材及学期归属。 */
export function validateResource(
  database: DatabaseType,
  context: AccessContextType,
  input: Omit<ResourceType, 'version' | 'updatedAt'>
): void {
  const content = record(input.content)
  if (JSON.stringify(content).length > 300000 || !input.name.trim() || input.name.length > 100)
    invalid()
  if (input.workspaceId) getWorkspace(database, context.ownerId, input.workspaceId)
  if (input.kind === 'tags') {
    if (
      !input.workspaceId ||
      Object.keys(content).some((key) => !['categories', 'tags', 'assignments'].includes(key))
    )
      invalid()
    const categories = strings(content.categories, 100),
      tags = record(content.tags),
      assignments = record(content.assignments)
    for (const [category, values] of Object.entries(tags)) {
      if (!categories.includes(category)) invalid()
      strings(values, 200)
    }
    const allowed = new Set(Object.values(tags).flatMap((value) => strings(value, 200)))
    if (Object.keys(assignments).length > 2000) invalid()
    for (const [studentId, values] of Object.entries(assignments)) {
      getEnrollment(database, context.ownerId, input.workspaceId!, studentId)
      if (strings(values, 100).some((value) => !allowed.has(value))) invalid()
    }
  } else if (input.kind === 'paper') {
    if (
      input.workspaceId ||
      Object.keys(content).some((key) => !['settings', 'items'].includes(key))
    )
      invalid()
    const settings = record(content.settings)
    if (
      Object.keys(settings).some(
        (key) =>
          ![
            'pageType',
            'orientation',
            'layoutMode',
            'fitMode',
            'columns',
            'margin',
            'gap'
          ].includes(key)
      )
    )
      invalid()
    if (
      !['A4', 'A3', 'B3', 'B4'].includes(String(settings.pageType)) ||
      !['portrait', 'landscape'].includes(String(settings.orientation)) ||
      !['single', 'double', 'free'].includes(String(settings.layoutMode)) ||
      !['width', 'slot'].includes(String(settings.fitMode))
    )
      invalid()
    for (const key of ['columns', 'margin', 'gap'])
      if (
        typeof settings[key] !== 'number' ||
        !Number.isFinite(settings[key]) ||
        Number(settings[key]) < 0 ||
        Number(settings[key]) > 100
      )
        invalid()
    if (
      !Number.isInteger(settings.columns) ||
      Number(settings.columns) < 1 ||
      Number(settings.columns) > 20
    )
      invalid()
    if (!Array.isArray(content.items) || content.items.length > 100) invalid()
    const ids = new Set<string>()
    for (const value of content.items as unknown[]) {
      const item = record(value)
      if (
        Object.keys(item).some(
          (key) =>
            ![
              'id',
              'attachmentId',
              'attachmentVersion',
              'x',
              'y',
              'documentY',
              'pageIndex',
              'width',
              'height',
              'zIndex'
            ].includes(key)
        )
      )
        invalid()
      if (typeof item.id !== 'string' || item.id.length > 100 || ids.has(item.id)) invalid()
      ids.add(String(item.id))
      for (const field of ['x', 'y', 'documentY', 'pageIndex', 'width', 'height', 'zIndex'])
        if (
          typeof item[field] !== 'number' ||
          !Number.isFinite(item[field]) ||
          Number(item[field]) < 0 ||
          Number(item[field]) > 100000
        )
          invalid()
      if (Number(item.width) <= 0 || Number(item.height) <= 0 || !Number.isInteger(item.pageIndex))
        invalid()
      const attachment = database
        .prepare('SELECT version FROM attachments WHERE ownerId=? AND id=? AND deletedAt IS NULL')
        .get(context.ownerId, String(item.attachmentId)) as { version: number } | undefined
      const old = database
        .prepare(
          "SELECT contentJson FROM business_resources WHERE ownerId=? AND kind='paper' AND id=? AND deletedAt IS NULL"
        )
        .get(context.ownerId, input.id) as { contentJson: string } | undefined
      const previous = old
        ? (JSON.parse(old.contentJson).items as Record<string, unknown>[]).find(
            (value) =>
              value.id === item.id &&
              value.attachmentId === item.attachmentId &&
              value.attachmentVersion === item.attachmentVersion
          )
        : undefined
      if ((!attachment || attachment.version !== item.attachmentVersion) && !previous)
        throw new BusinessError(409, 'VERSION_CONFLICT', '素材已变化，请重新选择')
    }
  } else {
    if (
      input.workspaceId ||
      Object.keys(content).some(
        (key) =>
          !['theme', 'fontFamily', 'fontSize', 'paperType', 'templates', 'prompts', 'layout'].includes(key)
      )
    )
      invalid()
    if (
      content.prompts !== undefined &&
      (typeof content.prompts !== 'string' || content.prompts.length > 8000)
    )
      invalid()
    if (
      content.templates !== undefined &&
      (!Array.isArray(content.templates) || content.templates.length > 100)
    )
      invalid()
    if (content.theme !== undefined && !['green', 'orange', 'purple', 'bluepink'].includes(String(content.theme))) invalid()
    if (content.layout !== undefined) record(content.layout)
    if (
      content.fontSize !== undefined &&
      (typeof content.fontSize !== 'number' || content.fontSize < 8 || content.fontSize > 72)
    )
      invalid()
    if (
      content.fontFamily !== undefined &&
      (typeof content.fontFamily !== 'string' || content.fontFamily.length > 100)
    )
      invalid()
    if (
      content.paperType !== undefined &&
      !['A4', 'A3', 'B3', 'B4'].includes(String(content.paperType))
    )
      invalid()
  }
}

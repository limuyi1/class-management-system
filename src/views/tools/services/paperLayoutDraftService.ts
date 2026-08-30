import { db } from '@/db'
import type {
  PaperLayoutDraftRecordType,
  PaperLayoutSettingsType,
  PaperLayoutDraftItemType
} from '@/types/Tools'

/** 生成草稿 ID（时间戳 + 随机数） */
const createId = (prefix: string): string => {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

/** 读取全部试卷排版草稿，按更新时间倒序 */
export const getPaperLayoutDrafts = async (): Promise<PaperLayoutDraftRecordType[]> => {
  return db.paperLayoutDrafts.orderBy('updatedAt').reverse().toArray()
}

/**
 * 保存（新建或更新）试卷排版草稿。
 * 传入 id 时更新既有草稿，否则新建。
 *
 * @param options 草稿名称、设置与条目
 * @returns 保存后的草稿记录
 */
export const savePaperLayoutDraft = async (options: {
  id?: string
  name: string
  settings: PaperLayoutSettingsType
  items: PaperLayoutDraftItemType[]
}): Promise<PaperLayoutDraftRecordType> => {
  const now = new Date().toISOString()
  const existingDraft = options.id ? await db.paperLayoutDrafts.get(options.id) : undefined
  const draft: PaperLayoutDraftRecordType = {
    id: existingDraft?.id || createId('paper-layout-draft'),
    name: options.name,
    settings: { ...options.settings },
    items: options.items,
    createdAt: existingDraft?.createdAt || now,
    updatedAt: now
  }

  await db.paperLayoutDrafts.put(draft)
  return draft
}

/** 按 ID 删除试卷排版草稿 */
export const deletePaperLayoutDraft = async (id: string): Promise<void> => {
  await db.paperLayoutDrafts.delete(id)
}

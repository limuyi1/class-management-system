import { db } from '@/db'
import type {
  PaperLayoutDraftRecordType,
  PaperLayoutSettingsType,
  PaperLayoutDraftItemType
} from '@/types/Tools'

const createId = (prefix: string): string => {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export const getPaperLayoutDrafts = async (): Promise<PaperLayoutDraftRecordType[]> => {
  return db.paperLayoutDrafts.orderBy('updatedAt').reverse().toArray()
}

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

export const deletePaperLayoutDraft = async (id: string): Promise<void> => {
  await db.paperLayoutDrafts.delete(id)
}

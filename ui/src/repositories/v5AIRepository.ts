import { apiRequest } from '@/api/client'
import { flushServerState, serverState } from './v5StateRepository'
import type { V5StateType } from '../../../packages/shared/src/V5'
import type { ScoreStateType } from '@/types/ApiScores'
import type { AttachmentType } from '@/types/ApiAttachments'

const pending = new Map<string, string>()
/** 原页面提示词只提交服务器，密钥与计费不经过浏览器。 */
export async function runServerPageAI(prompt: string, imageBase64?: string): Promise<string> {
  await flushServerState()
  const id = serverState.workspaceId
  const owner = serverState.ownerId
  const snapshot = id ? await apiRequest<V5StateType>(`/v5/workspaces/${id}`) : undefined
  const state = id ? await apiRequest<ScoreStateType>(`/workspaces/${id}/scores`) : undefined
  let attachment: AttachmentType | undefined
  if (imageBase64) {
    const blob = await (
      await fetch(`data:image/png;base64,${imageBase64.replace(/^data:[^,]+,/, '')}`)
    ).blob()
    attachment = await apiRequest<AttachmentType>(`/attachments/${crypto.randomUUID()}`, {
      method: 'PUT',
      body: blob,
      fileName: '成绩识别.png',
      expectedVersion: 0,
      idempotencyKey: crypto.randomUUID()
    })
  }
  const body = {
    scene: 'page',
    prompt,
    ...(state ? { workspaceId: id, workspaceVersion: state.workspace.version } : {}),
    ...(attachment ? { attachmentId: attachment.id, attachmentVersion: attachment.version } : {})
  }
  const fingerprint = JSON.stringify([serverState.ownerId, body])
  if (!pending.has(fingerprint)) pending.set(fingerprint, crypto.randomUUID())
  const result = await apiRequest<{ status: string; result: { text: string } | null }>(
    '/ai/calls',
    { method: 'POST', body, idempotencyKey: pending.get(fingerprint) }
  )
  if (result.status !== 'DONE' || !result.result)
    throw new Error('AI 调用尚未完成或用量待核对，请查看调用记录后重试')
  if (serverState.ownerId !== owner || serverState.workspaceId !== id)
    throw new Error('账号或班级已切换，请重新生成')
  if (
    snapshot &&
    (await apiRequest<V5StateType>(`/v5/workspaces/${id}`)).fingerprint !== snapshot.fingerprint
  )
    throw new Error('生成期间教学数据已变化，请核对后重新生成')
  pending.delete(fingerprint)
  return result.result.text
}

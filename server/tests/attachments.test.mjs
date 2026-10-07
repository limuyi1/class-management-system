import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync, existsSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fixture } from './helpers/scores.mjs'
import { buildApp } from '../dist/app.js'
import { inspectAttachment } from '../dist/services/attachmentFiles.js'
import {
  uploadAttachment,
  listAttachments,
  editAttachment,
  downloadAttachment
} from '../dist/services/attachments.js'

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK1sAAAAASUVORK5CYII=',
  'base64'
)
function setup() {
  const f = fixture(),
    directory = mkdtempSync(join(tmpdir(), 'cms-attachments-'))
  return {
    ...f,
    directory,
    close: () => {
      f.db.close()
      rmSync(directory, { recursive: true, force: true })
    }
  }
}
test('图片元数据、幂等重试、独立版本、软删除保留文件与账号隔离', () => {
  const f = setup()
  try {
    const id = randomUUID(),
      key = randomUUID()
    const input = { name: '课件.png', version: 0, mimeType: 'image/png', buffer: png }
    const save = (value, requestKey = randomUUID()) =>
      uploadAttachment(f.db, f.directory, f.context, id, value, requestKey, 'upload')
    const first = save(input, key)
    assert.equal(first.width, 1)
    assert.equal(first.height, 1)
    assert.ok(!('hash' in first) && !('ownerId' in first))
    assert.deepEqual(save(input, key), first)
    assert.throws(
      () => save(input),
      (error) => error.code === 'VERSION_CONFLICT'
    )
    const updated = save({ ...input, version: 1, name: '第二版.png' })
    assert.equal(updated.version, 2)
    assert.throws(
      () => downloadAttachment(f.db, f.directory, f.context, id, 1, 'get'),
      (error) => error.code === 'VERSION_CONFLICT'
    )
    assert.deepEqual(downloadAttachment(f.db, f.directory, f.context, id, 2, 'get').buffer, png)
    const other = f.actor()
    assert.equal(listAttachments(f.db, other, 0, 'list').total, 0)
    assert.throws(
      () => downloadAttachment(f.db, f.directory, other, id, 2, 'get'),
      (error) => error.statusCode === 404
    )
    editAttachment(f.db, f.context, id, { version: 2, delete: true }, randomUUID(), 'delete')
    assert.equal(listAttachments(f.db, f.context, 0, 'list').total, 0)
    const row = f.db.prepare('SELECT * FROM attachments WHERE id=?').get(id)
    assert.ok(row.deletedAt)
    assert.ok(existsSync(join(f.directory, f.context.ownerId, row.hash)))
    assert.throws(
      () => save({ ...input, version: 3 }),
      (error) => error.code === 'ATTACHMENT_DELETED'
    )
  } finally {
    f.close()
  }
})
test('拒绝伪造图片、异常尺寸、路径文件名和配额绕过；文件缺失明确报错', () => {
  const f = setup()
  try {
    assert.throws(() => inspectAttachment(Buffer.from('<svg/>'), 'image/png'), /PNG/)
    assert.throws(() => inspectAttachment(png, 'image/jpeg'), /PNG/)
    const huge = Buffer.from(png)
    huge.writeUInt32BE(20000, 16)
    assert.throws(() => inspectAttachment(huge, 'image/png'), /PNG/)
    const upload = (name = '图片.png') =>
      uploadAttachment(
        f.db,
        f.directory,
        f.context,
        randomUUID(),
        { name, mimeType: 'image/png', buffer: png, version: 0 },
        randomUUID(),
        'up'
      )
    assert.throws(() => upload('../图片.png'), /文件名/)
    const record = upload()
    const row = f.db.prepare('SELECT * FROM attachments WHERE id=?').get(record.id)
    unlinkSync(join(f.directory, f.context.ownerId, row.hash))
    assert.throws(
      () => downloadAttachment(f.db, f.directory, f.context, record.id, 1, 'get'),
      (error) => error.code === 'ATTACHMENT_UNAVAILABLE'
    )
    f.db
      .prepare('INSERT INTO attachment_blobs VALUES(?,?,?,?)')
      .run(f.context.ownerId, 'a'.repeat(64), 512 * 1024 * 1024, Date.now())
    f.db
      .prepare('DELETE FROM attachment_blobs WHERE ownerId=? AND hash=?')
      .run(f.context.ownerId, row.hash)
    assert.throws(
      () =>
        uploadAttachment(
          f.db,
          f.directory,
          f.context,
          randomUUID(),
          { name: '新图片.png', mimeType: 'image/png', buffer: png, version: 0 },
          randomUUID(),
          'up'
        ),
      (error) => error.code === 'ATTACHMENT_QUOTA'
    )
  } finally {
    f.close()
  }
})
test('HTTP 二进制上传/下载、安全响应头、代管审计和即时撤权', async () => {
  const f = setup(),
    app = await buildApp(f.db, 'http://localhost:5173', f.directory)
  try {
    const admin = f.actor('ADMIN')
    f.db.prepare('UPDATE users SET superVip=1 WHERE id=?').run(admin.actor.id)
    const id = randomUUID()
    const headers = {
      authorization: `Bearer ${admin.token}`,
      'x-managed-account-id': f.context.ownerId,
      'idempotency-key': randomUUID(),
      'content-type': 'image/png',
      'x-file-name': encodeURIComponent('素材.png'),
      'x-expected-version': '0'
    }
    let result = await app.inject({
      method: 'PUT',
      url: `/api/v1/attachments/${id}`,
      headers,
      payload: png
    })
    assert.equal(result.statusCode, 200, result.body)
    result = await app.inject({
      method: 'GET',
      url: `/api/v1/attachments/${id}/content?version=1`,
      headers: {
        authorization: headers.authorization,
        'x-managed-account-id': headers['x-managed-account-id']
      }
    })
    assert.equal(result.statusCode, 200)
    assert.deepEqual(result.rawPayload, png)
    assert.equal(result.headers['cache-control'], 'no-store')
    assert.equal(result.headers['x-content-type-options'], 'nosniff')
    assert.match(result.headers['content-disposition'], /attachment/)
    const audit = f.db
      .prepare("SELECT actorId,ownerId FROM audit_logs WHERE action='ATTACHMENT_UPLOAD'")
      .get()
    assert.deepEqual(audit, { actorId: admin.actor.id, ownerId: f.context.ownerId })
    f.db.prepare('UPDATE users SET superVip=0 WHERE id=?').run(admin.actor.id)
    result = await app.inject({
      method: 'GET',
      url: `/api/v1/attachments/${id}/content?version=1`,
      headers: {
        authorization: headers.authorization,
        'x-managed-account-id': headers['x-managed-account-id']
      }
    })
    assert.equal(result.statusCode, 403)
    result = await app.inject({
      method: 'PUT',
      url: `/api/v1/attachments/${randomUUID()}`,
      headers: {
        ...headers,
        authorization: `Bearer ${f.context.token}`,
        'content-type': 'image/svg+xml',
        'x-managed-account-id': f.context.ownerId
      },
      payload: '<svg/>'
    })
    assert.equal(result.statusCode, 415)
    result = await app.inject({
      method: 'PUT',
      url: `/api/v1/attachments/${randomUUID()}`,
      headers: {
        ...headers,
        authorization: `Bearer ${f.context.token}`,
        'x-managed-account-id': f.context.ownerId
      },
      payload: Buffer.alloc(8 * 1024 * 1024 + 1)
    })
    assert.equal(result.statusCode, 413)
  } finally {
    await app.close()
    f.close()
  }
})

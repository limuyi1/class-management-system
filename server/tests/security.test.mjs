/** 使用真实内存 SQLite 验证身份隔离与撤销，不接触用户数据库。 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { randomUUID } from 'node:crypto'

const base = process.env.CORE_BUILD
  ? `file://${process.env.CORE_BUILD}/`
  : new URL('../dist/', import.meta.url).href
const { migrate } = await import(`${base}db/migrate.js`)
const { createSession, authenticate, refreshTokens, ACCESS_SECONDS } = await import(
  `${base}auth/tokens.js`
)
const { resolveOwner } = await import(`${base}policies/access.js`)
const { changeStatus, profile } = await import(`${base}services/accounts.js`)
const { createChallenge, verifyChallenge, consumeTicket } = await import(`${base}auth/captcha.js`)

function fixture() {
  const db = new DatabaseSync(':memory:')
  migrate(db, new URL('../migrations/', import.meta.url).pathname)
  const create = (role, vip = 0) => {
    const id = randomUUID()
    db.prepare(
      `INSERT INTO users(id,phone,nickname,passwordHash,role,status,superVip,mustChangePassword,createdAt)
      VALUES(?,?,?,?,?,'ACTIVE',?,0,?)`
    ).run(
      id,
      `138${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`,
      '测试老师',
      'secret-hash',
      role,
      vip,
      Date.now()
    )
    return db.prepare('SELECT * FROM users WHERE id=?').get(id)
  }
  return { db, create }
}

test('普通账号不能伪造代管目标，VIP 关闭立即阻断', () => {
  const { db, create } = fixture()
  try {
    const admin = create('ADMIN', 1),
      ordinary = create('USER'),
      other = create('USER')
    assert.equal(resolveOwner(db, ordinary), ordinary.id)
    assert.throws(() => resolveOwner(db, ordinary, other.id), /无权/)
    assert.equal(resolveOwner(db, admin, other.id), other.id)
    db.prepare('UPDATE users SET superVip=0 WHERE id=?').run(admin.id)
    const latest = db.prepare('SELECT * FROM users WHERE id=?').get(admin.id)
    assert.throws(() => resolveOwner(db, latest, other.id), /无权/)
    assert.equal('passwordHash' in profile(ordinary), false)
  } finally {
    db.close()
  }
})

test('软删除撤销旧令牌，管理员保护由 Service 与数据库共同实施', () => {
  const { db, create } = fixture()
  try {
    const admin = create('ADMIN'),
      ordinary = create('USER')
    const token = createSession(db, ordinary)
    assert.equal(ACCESS_SECONDS, 3600)
    assert.equal(authenticate(db, token.accessToken).id, ordinary.id)
    changeStatus(db, admin, ordinary.id, 'DELETED', 'test-delete')
    assert.throws(() => authenticate(db, token.accessToken), /登录已失效/)
    assert.equal(
      db.prepare('SELECT status FROM users WHERE id=?').get(ordinary.id).status,
      'DELETED'
    )
    assert.throws(() => changeStatus(db, admin, admin.id, 'DISABLED', 'test-disable'), /受保护/)
    assert.throws(() => db.prepare('DELETE FROM users WHERE id=?').run(admin.id), /ADMIN_PROTECTED/)
    assert.throws(
      () => db.prepare("UPDATE users SET role='USER' WHERE id=?").run(admin.id),
      /ADMIN_PROTECTED/
    )
    assert.equal(db.prepare('SELECT count(*) AS count FROM audit_logs').get().count, 1)
  } finally {
    db.close()
  }
})

test('刷新令牌重放撤销整个设备，撤销不因报告错误回滚', () => {
  const { db, create } = fixture()
  try {
    const user = create('USER')
    const original = createSession(db, user)
    const rotated = refreshTokens(db, original.refreshToken)
    assert.equal(authenticate(db, rotated.accessToken).id, user.id)
    assert.throws(() => refreshTokens(db, original.refreshToken), /登录已失效/)
    assert.throws(() => authenticate(db, rotated.accessToken), /登录已失效/)
    assert.throws(() => refreshTokens(db, rotated.refreshToken), /登录已失效/)
  } finally {
    db.close()
  }
})

test('滑块必须服务端验证，票据绑定手机号且一次性消费', () => {
  const { db } = fixture()
  try {
    const challenge = createChallenge(db, '13800000000')
    const answer = db
      .prepare('SELECT answer FROM captcha_challenges WHERE id=?')
      .get(challenge.challengeId).answer
    const ticket = verifyChallenge(db, challenge.challengeId, answer)
    assert.throws(() => consumeTicket(db, ticket, '13900000000'), /滑块/)
    consumeTicket(db, ticket, '13800000000')
    assert.throws(() => consumeTicket(db, ticket, '13800000000'), /滑块/)
    assert.throws(() => verifyChallenge(db, challenge.challengeId, answer), /未通过/)
  } finally {
    db.close()
  }
})

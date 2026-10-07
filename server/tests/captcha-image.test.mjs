import { test } from 'node:test'
import assert from 'node:assert/strict'
import SQLite from 'better-sqlite3'
import { migrate } from '../dist/db/migrate.js'
import { createChallenge, verifyChallenge, consumeTicket } from '../dist/auth/captcha.js'
import { CAPTCHA_PATHS, createCaptchaImage } from '../dist/auth/captchaImage.js'

/** 形状、尺寸与答案在测试数据库中验证，不读取真实登录挑战。 */
test('2:1 图片、六种缺口及移动拼图共用路径，原图坐标保持一致', () => {
  assert.equal(new Set(CAPTCHA_PATHS).size, 6)
  for (let i = 0; i < 30; i++) {
    const result = createCaptchaImage(140)
    assert.equal(result.width, 320)
    assert.equal(result.height, 160)
    assert.equal(result.pieceSize, 48)
    assert.ok(CAPTCHA_PATHS.includes(result.piecePath))
    const svg = Buffer.from(result.image.split(',')[1], 'base64').toString()
    assert.ok(svg.includes(`d="${result.piecePath}" transform="translate(140 ${result.pieceY})"`))
    assert.ok(result.pieceY + result.pieceSize <= result.height)
  }
})
test('新尺寸挑战正确位置通过，错误位置消耗挑战，票据绑定手机号且仅用一次', () => {
  const db = new SQLite(':memory:')
  migrate(db, new URL('../migrations/', import.meta.url).pathname)
  try {
    const challenge = createChallenge(db, '13800000000')
    const answer = db
      .prepare('SELECT answer FROM captcha_challenges WHERE id=?')
      .get(challenge.challengeId).answer
    assert.ok(answer > 0 && answer < challenge.width - challenge.pieceSize)
    const ticket = verifyChallenge(db, challenge.challengeId, answer)
    assert.throws(() => consumeTicket(db, ticket, '13900000000'))
    consumeTicket(db, ticket, '13800000000')
    assert.throws(() => consumeTicket(db, ticket, '13800000000'))
    const wrong = createChallenge(db, '13800000000')
    assert.throws(() => verifyChallenge(db, wrong.challengeId, 0))
    assert.throws(() => verifyChallenge(db, wrong.challengeId, 140))
  } finally {
    db.close()
  }
})

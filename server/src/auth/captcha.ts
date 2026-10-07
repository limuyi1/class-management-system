import { randomBytes, randomInt, randomUUID } from 'node:crypto'

import { createCaptchaImage, CAPTCHA_WIDTH, CAPTCHA_PIECE_SIZE } from './captchaImage.js'
import { tokenHash } from './tokens.js'
import { transaction } from '../db/migrate.js'
import { BusinessError } from '../services/errors.js'
import type { DatabaseType } from '../types/Account.js'

/** 生成拼图挑战；服务器保留答案，浏览器只能通过图片观察位置，不能提交 passed=true。 */
export function createChallenge(database: DatabaseType, phone: string) {
  const id = randomUUID()
  const answer = randomInt(64, CAPTCHA_WIDTH - CAPTCHA_PIECE_SIZE - 15)
  database.prepare(`DELETE FROM captcha_challenges WHERE expiresAt<?`).run(Date.now())
  database
    .prepare('INSERT INTO captcha_challenges(id,intent,answer,expiresAt) VALUES(?,?,?,?)')
    .run(id, tokenHash(phone), answer, Date.now() + 120000)
  return {
    challengeId: id,
    ...createCaptchaImage(answer),
    expiresIn: 120
  }
}

/** 校验挑战并产生一次性票据，尝试失败也消耗挑战，避免无限试探答案。 */
export function verifyChallenge(database: DatabaseType, id: string, position: number): string {
  const ticket = transaction(database, () => {
    const record = database.prepare('SELECT * FROM captcha_challenges WHERE id=?').get(id) as
      | {
          consumed: number
          expiresAt: number
          answer: number
        }
      | undefined
    if (!record || record.consumed || record.expiresAt <= Date.now()) return null
    database
      .prepare('UPDATE captcha_challenges SET consumed=1, attempts=attempts+1 WHERE id=?')
      .run(id)
    if (Math.abs(record.answer - position) > 4) return null
    const value = randomBytes(32).toString('base64url')
    database
      .prepare('UPDATE captcha_challenges SET ticketHash=?,expiresAt=? WHERE id=?')
      .run(tokenHash(value), Date.now() + 60000, id)
    return value
  })
  if (!ticket) throw new BusinessError(400, 'CAPTCHA_FAILED', '验证未通过或已过期，请刷新拼图')
  return ticket
}

/** 登录原子消费票据并检查手机号绑定，不论密码成功与否都不可再次使用。 */
export function consumeTicket(database: DatabaseType, ticket: string, phone: string): void {
  const result = database
    .prepare(
      `DELETE FROM captcha_challenges
    WHERE ticketHash=? AND intent=? AND expiresAt>?`
    )
    .run(tokenHash(ticket), tokenHash(phone), Date.now())
  if (!result.changes) throw new BusinessError(400, 'CAPTCHA_REQUIRED', '请完成滑块验证')
}

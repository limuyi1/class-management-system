import { randomUUID } from 'node:crypto'
import { createInterface } from 'node:readline/promises'
import { Writable } from 'node:stream'

import { hashPassword } from '../auth/password.js'
import { openDatabase } from '../db/index.js'
import { transaction } from '../db/migrate.js'
import { validateNickname, validatePhone } from '../services/accounts.js'

/** 管理员只通过交互式命令初始化，密码不放命令行参数或日志。 */
const { database } = openDatabase()
let hidden = false
const output = new Writable({
  write(chunk, _encoding, callback) {
    if (!hidden) process.stdout.write(chunk)
    callback()
  }
})
const prompt = createInterface({
  input: process.stdin,
  output,
  terminal: Boolean(process.stdin.isTTY)
})
try {
  const resetting = process.argv.includes('--reset')
  if (!resetting && database.prepare('SELECT id FROM users WHERE role=?').get('ADMIN')) {
    throw new Error('管理员已经存在，此初始化命令不会覆盖或重置账号')
  }
  const phone = validatePhone(await prompt.question('管理员手机号：'))
  const existing = resetting
    ? (database.prepare("SELECT id FROM users WHERE phone=? AND role='ADMIN'").get(phone) as
        | { id: string }
        | undefined)
    : undefined
  if (resetting && !existing) throw new Error('找不到此手机号对应的管理员账号')
  const nickname = resetting ? '' : validateNickname(await prompt.question('管理员昵称：'))
  process.stdout.write('管理员密码（不能是纯数字，输入不显示）：')
  hidden = true
  const password = await prompt.question('')
  hidden = false
  process.stdout.write('\n')
  const hash = await hashPassword(password)
  if (existing) {
    transaction(database, () => {
      database
        .prepare(
          'UPDATE users SET passwordHash=?,authVersion=authVersion+1,version=version+1,mustChangePassword=0 WHERE id=?'
        )
        .run(hash, existing.id)
      database.prepare('UPDATE auth_sessions SET revoked=1 WHERE userId=?').run(existing.id)
      database
        .prepare('INSERT INTO audit_logs VALUES(?,?,?,?,?,?,?)')
        .run(
          randomUUID(),
          existing.id,
          existing.id,
          'ADMIN_CLI_PASSWORD_RESET',
          existing.id,
          randomUUID(),
          Date.now()
        )
    })
    console.log('管理员密码已恢复，所有旧登录已撤销。')
  } else {
    database
      .prepare(
        `INSERT INTO users(id,phone,nickname,passwordHash,role,status,mustChangePassword,createdAt)
    VALUES(?,?,?,?,'ADMIN','ACTIVE',0,?)`
      )
      .run(randomUUID(), phone, nickname, hash, Date.now())
    console.log('管理员已创建，无需重新启动服务器。')
  }
} catch (error) {
  console.error('管理员初始化失败:', error instanceof Error ? error.message : '未知错误')
  process.exitCode = 1
} finally {
  prompt.close()
  database.close()
}

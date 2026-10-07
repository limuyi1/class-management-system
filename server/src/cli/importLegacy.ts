import { readFileSync, statSync, mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import { openDatabase } from '../db/index.js'
import { SCHEMA_VERSION } from '../db/migrate.js'
import { importLegacy } from '../migration/importLegacy.js'
import { attachmentDirectory } from '../routes/attachments.js'

/** 运维离线工具：默认只做校验预览；明确 --commit --services-stopped 才写目标空账号。 */
const args = process.argv.slice(2),
  option = (name: string) => args[args.indexOf(name) + 1]
if (!args.includes('--file') || !args.includes('--owner'))
  throw new Error('用法：--file 备份.dexie --owner 账号UUID [--commit --services-stopped]')
if (args.includes('--commit') && !args.includes('--services-stopped'))
  throw new Error('提交前须停止所有服务并提供 --services-stopped')
const file = resolve(option('--file')!)
if (statSync(file).size > 200 * 1024 * 1024) throw new Error('备份超过 200 MB，请使用分批迁移工具')
const buffer = readFileSync(file)
const backup = JSON.parse(buffer.toString('utf8')) as unknown,
  owner = option('--owner')!
if (!/^[0-9a-f-]{36}$/i.test(owner)) throw new Error('账号 UUID 无效')
const databasePath = resolve(process.env.DATABASE_PATH || '../data/class-management.sqlite')
if (!existsSync(databasePath)) throw new Error('目标数据库不存在，请先初始化并创建目标账号')
const { database } = openDatabase(databasePath),
  staging = mkdtempSync(join(tmpdir(), 'cms-legacy-'))
try {
  const version = database.prepare('PRAGMA user_version').get() as { user_version: number }
  if (version.user_version !== SCHEMA_VERSION) throw new Error('先执行数据库升级')
  const report = importLegacy(database, owner, backup, staging, true)
  if (args.includes('--commit')) {
    const directory = attachmentDirectory(),
      target = join(directory, owner)
    if (existsSync(target)) throw new Error('目标账号附件目录非空，禁止覆盖')
    // 文件校验已完成；上传不可变内容时不会改写其他账号文件。
    try {
      const result = importLegacy(database, owner, backup, directory, false)
      console.log(JSON.stringify(result, null, 2))
    } catch (error) {
      // 目标目录在本次提交前不存在，事务回滚后仅清理本次产生的附件。
      rmSync(target, { recursive: true, force: true })
      throw error
    }
  } else console.log(JSON.stringify({ preview: true, ...report }, null, 2))
} finally {
  database.close()
  rmSync(staging, { recursive: true, force: true })
}

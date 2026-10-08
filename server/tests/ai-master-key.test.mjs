import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fixture } from './helpers/scores.mjs'
import { initializeAIMasterKey } from '../dist/services/ai/masterKey.js'
import { encryptAIKey, decryptAIKey } from '../dist/services/ai/secrets.js'

test('首次生成主密钥，重启复用并解密；环境配置优先，已有密文保留且不阻断启动', () => {
  const f = fixture(),
    directory = mkdtempSync(join(tmpdir(), 'cms-master-key-'))
  const oldKey = process.env.AI_ENCRYPTION_KEY,
    oldFile = process.env.AI_ENCRYPTION_KEY_FILE
  const path = join(directory, '.ai-encryption-key'),
    databasePath = join(directory, 'class.sqlite')
  delete process.env.AI_ENCRYPTION_KEY
  delete process.env.AI_ENCRYPTION_KEY_FILE
  try {
    initializeAIMasterKey(f.db, databasePath)
    const first = readFileSync(path, 'utf8').trim()
    assert.equal(Buffer.from(first, 'base64').length, 32)
    if (process.platform !== 'win32') assert.equal(statSync(path).mode & 0o777, 0o600)
    const encrypted = encryptAIKey('model-key')
    delete process.env.AI_ENCRYPTION_KEY
    initializeAIMasterKey(f.db, databasePath)
    assert.equal(process.env.AI_ENCRYPTION_KEY, first)
    assert.equal(decryptAIKey(encrypted), 'model-key')
    const configured = randomBytes(32).toString('base64')
    process.env.AI_ENCRYPTION_KEY = configured
    initializeAIMasterKey(f.db, databasePath)
    assert.equal(process.env.AI_ENCRYPTION_KEY, configured)
    assert.equal(readFileSync(path, 'utf8').trim(), first)
    delete process.env.AI_ENCRYPTION_KEY
    process.env.AI_ENCRYPTION_KEY_FILE = join(directory, 'invalid-key')
    writeFileSync(process.env.AI_ENCRYPTION_KEY_FILE, 'invalid')
    assert.throws(() => initializeAIMasterKey(f.db, databasePath), /加密配置异常/)
    assert.equal(readFileSync(process.env.AI_ENCRYPTION_KEY_FILE, 'utf8'), 'invalid')
    process.env.AI_ENCRYPTION_KEY_FILE = join(directory, 'missing-key')
    f.db
      .prepare('INSERT INTO ai_configs VALUES(?,?,?,?,?,?,?,?,?)')
      .run(
        'platform',
        null,
        'OPENAI',
        'https://model.example.test',
        'test',
        encrypted,
        1,
        1,
        Date.now()
      )
    initializeAIMasterKey(f.db, databasePath)
    assert.equal(existsSync(process.env.AI_ENCRYPTION_KEY_FILE), true)
    assert.equal(
      f.db.prepare("SELECT secret FROM ai_configs WHERE id='platform'").get().secret,
      encrypted
    )
    assert.notEqual(process.env.AI_ENCRYPTION_KEY, first)
  } finally {
    f.db.close()
    rmSync(directory, { recursive: true, force: true })
    if (oldKey === undefined) delete process.env.AI_ENCRYPTION_KEY
    else process.env.AI_ENCRYPTION_KEY = oldKey
    if (oldFile === undefined) delete process.env.AI_ENCRYPTION_KEY_FILE
    else process.env.AI_ENCRYPTION_KEY_FILE = oldFile
  }
})

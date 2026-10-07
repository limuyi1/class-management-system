import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import SQLite from 'better-sqlite3'
import { migrate, SCHEMA_VERSION } from '../dist/db/migrate.js'

/** v3 已有名单与零分不能因新增评语/通知表而被重建或清空。 */
test('schema v3 增量升级保留零分与成绩版本，不创建默认评语或通知数据', () => {
  const db = new SQLite(':memory:')
  try {
    for (const name of ['001-auth.sql', '002-workspaces.sql', '003-scores.sql'])
      db.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8'))
    db.exec(`PRAGMA user_version=3;
      INSERT INTO users(id,phone,nickname,passwordHash,role,status,createdAt) VALUES('owner','13800000000','老师','hash','USER','ACTIVE',0);
      INSERT INTO classes VALUES('class','owner',0);
      INSERT INTO workspaces(id,ownerId,classId,className,termName,createdAt,updatedAt) VALUES('period','owner','class','303','上学期',0,0);
      INSERT INTO students VALUES('owner','student',0);
      INSERT INTO enrollments(workspaceId,ownerId,studentId,name,sortIndex) VALUES('period','owner','student','原有学生',0);
      INSERT INTO assessments(id,workspaceId,ownerId,prop,label,sortIndex) VALUES('column','period','owner','unit','第一单元',0);
      INSERT INTO scores(workspaceId,ownerId,studentId,assessmentId,value,version) VALUES('period','owner','student','column',0,3);`)
    migrate(db)
    migrate(db)
    assert.equal(db.pragma('user_version', { simple: true }), SCHEMA_VERSION)
    assert.deepEqual(db.prepare('SELECT value,version FROM scores').get(), { value: 0, version: 3 })
    assert.equal(db.prepare('SELECT name FROM enrollments').get().name, '原有学生')
    assert.equal(db.prepare('SELECT count(*) AS count FROM comments').get().count, 0)
    assert.equal(db.prepare('SELECT count(*) AS count FROM workspace_documents').get().count, 0)
  } finally {
    db.close()
  }
})

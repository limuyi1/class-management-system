-- 各学期直接存储自己的数据，不存在服务器全局“当前班级”。
CREATE TABLE classes (
  id TEXT PRIMARY KEY,
  ownerId TEXT NOT NULL REFERENCES users(id),
  createdAt INTEGER NOT NULL,
  UNIQUE(id, ownerId)
);

CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,
  ownerId TEXT NOT NULL REFERENCES users(id),
  classId TEXT NOT NULL,
  className TEXT NOT NULL,
  termName TEXT NOT NULL,
  scoreFullMark REAL NOT NULL DEFAULT 100 CHECK(scoreFullMark > 0),
  version INTEGER NOT NULL DEFAULT 1,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  UNIQUE(id, ownerId),
  UNIQUE(classId, termName),
  UNIQUE(ownerId, className, termName),
  FOREIGN KEY(classId, ownerId) REFERENCES classes(id, ownerId)
);

CREATE TABLE students (
  ownerId TEXT NOT NULL REFERENCES users(id),
  id TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  PRIMARY KEY(ownerId, id)
);

-- 姓名/在班状态属于当时的名单，修改本期不能改写往期。
CREATE TABLE enrollments (
  workspaceId TEXT NOT NULL,
  ownerId TEXT NOT NULL,
  studentId TEXT NOT NULL,
  name TEXT NOT NULL,
  disabled INTEGER NOT NULL DEFAULT 0 CHECK(disabled IN (0,1)),
  departed INTEGER NOT NULL DEFAULT 0 CHECK(departed IN (0,1)),
  departedAt INTEGER,
  deletedAt INTEGER,
  sortIndex INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY(workspaceId, studentId),
  FOREIGN KEY(workspaceId, ownerId) REFERENCES workspaces(id, ownerId) ON DELETE CASCADE,
  FOREIGN KEY(ownerId, studentId) REFERENCES students(ownerId, id)
);
CREATE INDEX enrollments_owner ON enrollments(ownerId, workspaceId);
CREATE INDEX workspaces_owner ON workspaces(ownerId, updatedAt);

-- 幂等键绑定真实操作者和数据归属，不能因账号切换重放到其他账号。
CREATE TABLE mutation_receipts (
  actorId TEXT NOT NULL,
  ownerId TEXT NOT NULL,
  key TEXT NOT NULL,
  requestHash TEXT NOT NULL,
  resultJson TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  PRIMARY KEY(actorId, ownerId, key)
);

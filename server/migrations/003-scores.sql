-- 测评配置只属于本期；软删除保留原成绩，prop 不复用。
CREATE TABLE assessments (
  id TEXT PRIMARY KEY,
  workspaceId TEXT NOT NULL,
  ownerId TEXT NOT NULL,
  prop TEXT NOT NULL,
  label TEXT NOT NULL,
  sortIndex INTEGER NOT NULL,
  disabled INTEGER NOT NULL DEFAULT 0 CHECK(disabled IN (0,1)),
  fullMark REAL CHECK(fullMark IS NULL OR fullMark > 0),
  version INTEGER NOT NULL DEFAULT 1,
  deletedAt INTEGER,
  UNIQUE(workspaceId, prop),
  UNIQUE(id, workspaceId, ownerId),
  FOREIGN KEY(workspaceId, ownerId) REFERENCES workspaces(id, ownerId)
);
CREATE INDEX assessments_scope ON assessments(ownerId, workspaceId, deletedAt);

-- 空值也是有版本的记录；不能删除行后重建 version=1，避免旧设备误覆盖。
CREATE TABLE scores (
  workspaceId TEXT NOT NULL,
  ownerId TEXT NOT NULL,
  studentId TEXT NOT NULL,
  assessmentId TEXT NOT NULL,
  value REAL,
  version INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY(workspaceId, studentId, assessmentId),
  FOREIGN KEY(workspaceId, ownerId, studentId) REFERENCES enrollments(workspaceId, ownerId, studentId),
  FOREIGN KEY(assessmentId, workspaceId, ownerId) REFERENCES assessments(id, workspaceId, ownerId)
);
-- SQLite 复合外键的父键必须有完整唯一索引。
CREATE UNIQUE INDEX enrollments_identity ON enrollments(workspaceId, ownerId, studentId);
CREATE INDEX scores_scope ON scores(ownerId, workspaceId, assessmentId);

-- 只存来源关系，不把历史分数写进目标 scores。
CREATE TABLE workspace_references (
  workspaceId TEXT NOT NULL,
  ownerId TEXT NOT NULL,
  sourceWorkspaceId TEXT NOT NULL,
  assessmentId TEXT NOT NULL,
  sortIndex INTEGER NOT NULL,
  PRIMARY KEY(workspaceId, assessmentId),
  CHECK(workspaceId != sourceWorkspaceId),
  FOREIGN KEY(workspaceId, ownerId) REFERENCES workspaces(id, ownerId),
  FOREIGN KEY(assessmentId, sourceWorkspaceId, ownerId) REFERENCES assessments(id, workspaceId, ownerId)
);
CREATE INDEX references_source ON workspace_references(assessmentId);

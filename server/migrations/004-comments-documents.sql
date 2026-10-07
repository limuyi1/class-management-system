-- 清空评语保留版本和软删除时间；名单删除不级联清除评语。
CREATE TABLE comments (
  workspaceId TEXT NOT NULL,
  ownerId TEXT NOT NULL,
  studentId TEXT NOT NULL,
  text TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  deletedAt INTEGER,
  PRIMARY KEY(workspaceId, studentId),
  FOREIGN KEY(workspaceId, ownerId, studentId) REFERENCES enrollments(workspaceId, ownerId, studentId)
);
CREATE INDEX comments_scope ON comments(ownerId, workspaceId);

-- 工具文档按工作区及类型独立保存，不能整份上传旧 Pinia/Dexie 状态。
CREATE TABLE workspace_documents (
  workspaceId TEXT NOT NULL,
  ownerId TEXT NOT NULL,
  type TEXT NOT NULL,
  contentJson TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updatedAt INTEGER NOT NULL,
  PRIMARY KEY(workspaceId, type),
  FOREIGN KEY(workspaceId, ownerId) REFERENCES workspaces(id, ownerId)
);

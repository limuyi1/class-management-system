-- 座位和值日方案独立保存，不能通过上传整份浏览器状态改变账号归属。
CREATE TABLE classroom_tools (
  id TEXT PRIMARY KEY,
  workspaceId TEXT NOT NULL,
  ownerId TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('seating','duty')),
  contentJson TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  deletedAt INTEGER,
  FOREIGN KEY(workspaceId,ownerId) REFERENCES workspaces(id,ownerId)
);
CREATE INDEX classroom_tools_scope ON classroom_tools(ownerId,workspaceId,deletedAt);

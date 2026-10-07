-- 账号共用素材库；图片按不可变摘要存盘，数据库只存元数据。
CREATE TABLE attachments (
  id TEXT PRIMARY KEY,
  ownerId TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  mimeType TEXT NOT NULL CHECK(mimeType IN ('image/png','image/jpeg')),
  size INTEGER NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  hash TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  deletedAt INTEGER
);
CREATE INDEX attachments_scope ON attachments(ownerId,deletedAt,createdAt,id);
-- 旧版本和软删除占用仍计入配额，不自动清除文件。
CREATE TABLE attachment_blobs (
  ownerId TEXT NOT NULL REFERENCES users(id),
  hash TEXT NOT NULL,
  size INTEGER NOT NULL,
  createdAt INTEGER NOT NULL,
  PRIMARY KEY(ownerId,hash)
);

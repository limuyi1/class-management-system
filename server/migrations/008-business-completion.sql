ALTER TABLE workspaces ADD COLUMN deletedAt INTEGER;
CREATE TABLE business_resources (
  ownerId TEXT NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL CHECK(kind IN ('paper','tags','settings')),
  id TEXT NOT NULL,
  workspaceId TEXT,
  name TEXT NOT NULL,
  contentJson TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deletedAt INTEGER,
  updatedAt INTEGER NOT NULL,
  PRIMARY KEY(ownerId,kind,id),
  FOREIGN KEY(workspaceId,ownerId) REFERENCES workspaces(id,ownerId)
);
CREATE TABLE paper_files (
  ownerId TEXT NOT NULL,
  paperId TEXT NOT NULL,
  itemId TEXT NOT NULL,
  hash TEXT NOT NULL,
  mimeType TEXT NOT NULL,
  PRIMARY KEY(ownerId,paperId,itemId),
  FOREIGN KEY(ownerId,hash) REFERENCES attachment_blobs(ownerId,hash)
);
CREATE TABLE ai_calls (
  id TEXT PRIMARY KEY,
  actorId TEXT NOT NULL REFERENCES users(id),
  ownerId TEXT NOT NULL REFERENCES users(id),
  workspaceId TEXT,
  requestKey TEXT NOT NULL,
  requestHash TEXT NOT NULL,
  mode TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('RUNNING','DONE','FAILED','UNCERTAIN')),
  resultJson TEXT,
  inputTokens INTEGER,
  outputTokens INTEGER,
  createdAt INTEGER NOT NULL,
  UNIQUE(actorId,ownerId,requestKey)
);
CREATE TABLE import_previews (
  id TEXT PRIMARY KEY,
  actorId TEXT NOT NULL REFERENCES users(id),
  ownerId TEXT NOT NULL REFERENCES users(id),
  workspaceId TEXT NOT NULL,
  contentJson TEXT NOT NULL,
  expiresAt INTEGER NOT NULL,
  FOREIGN KEY(workspaceId,ownerId) REFERENCES workspaces(id,ownerId)
);

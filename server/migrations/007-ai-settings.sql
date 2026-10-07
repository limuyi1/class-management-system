-- 密钥仅存 AES-GCM 密文；加密主密钥单独保管，不写入数据库。
CREATE TABLE ai_configs (
  id TEXT PRIMARY KEY,
  ownerId TEXT UNIQUE REFERENCES users(id),
  provider TEXT NOT NULL CHECK(provider IN ('OPENAI','GEMINI')),
  baseUrl TEXT NOT NULL,
  model TEXT NOT NULL,
  secret TEXT,
  enabled INTEGER NOT NULL CHECK(enabled IN (0,1)),
  version INTEGER NOT NULL DEFAULT 1,
  updatedAt INTEGER NOT NULL,
  CHECK((id='platform' AND ownerId IS NULL) OR id=ownerId)
);
CREATE TABLE ai_preferences (
  ownerId TEXT PRIMARY KEY REFERENCES users(id),
  mode TEXT NOT NULL DEFAULT 'PLATFORM' CHECK(mode IN ('PLATFORM','PERSONAL')),
  version INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE ai_quotas (
  ownerId TEXT PRIMARY KEY REFERENCES users(id),
  available INTEGER NOT NULL DEFAULT 0 CHECK(available>=0),
  reserved INTEGER NOT NULL DEFAULT 0 CHECK(reserved>=0),
  used INTEGER NOT NULL DEFAULT 0 CHECK(used>=0),
  version INTEGER NOT NULL DEFAULT 1
);
-- 管理员调整与模型结算保留独立流水，不能通过重试重复分配额度。
CREATE TABLE ai_quota_ledger (
  id TEXT PRIMARY KEY,
  ownerId TEXT NOT NULL REFERENCES users(id),
  actorId TEXT NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL CHECK(kind IN ('ADJUST','RESERVE','SETTLE','RELEASE')),
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  createdAt INTEGER NOT NULL
);
CREATE TABLE ai_token_reservations (
  id TEXT PRIMARY KEY,
  ownerId TEXT NOT NULL REFERENCES users(id),
  actorId TEXT NOT NULL REFERENCES users(id),
  amount INTEGER NOT NULL CHECK(amount>0),
  actual INTEGER,
  state TEXT NOT NULL CHECK(state IN ('PENDING','SETTLED','RELEASED')),
  createdAt INTEGER NOT NULL
);

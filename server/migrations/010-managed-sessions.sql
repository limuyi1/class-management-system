CREATE TABLE managed_sessions (
  id TEXT PRIMARY KEY,
  sessionId TEXT NOT NULL REFERENCES auth_sessions(id),
  actorId TEXT NOT NULL REFERENCES users(id),
  ownerId TEXT NOT NULL REFERENCES users(id),
  ownerAuthVersion INTEGER NOT NULL,
  expiresAt INTEGER NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0,
  createdAt INTEGER NOT NULL
);

    CREATE TABLE users (
      id TEXT PRIMARY KEY, phone TEXT NOT NULL UNIQUE, nickname TEXT NOT NULL,
      passwordHash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('ADMIN','USER')),
      status TEXT NOT NULL CHECK(status IN ('ACTIVE','DISABLED','DELETED')),
      superVip INTEGER NOT NULL DEFAULT 0 CHECK(superVip IN (0,1)),
      mustChangePassword INTEGER NOT NULL DEFAULT 1,
      authVersion INTEGER NOT NULL DEFAULT 1, version INTEGER NOT NULL DEFAULT 1,
      createdAt INTEGER NOT NULL,
      CHECK(role='ADMIN' OR superVip=0), CHECK(role!='ADMIN' OR status='ACTIVE')
    );
    CREATE TRIGGER protect_admin_delete BEFORE DELETE ON users WHEN OLD.role='ADMIN'
      BEGIN SELECT RAISE(ABORT,'ADMIN_PROTECTED'); END;
    CREATE TRIGGER protect_admin_update BEFORE UPDATE ON users
      WHEN OLD.role='ADMIN' AND (NEW.role!='ADMIN' OR NEW.status!='ACTIVE')
      BEGIN SELECT RAISE(ABORT,'ADMIN_PROTECTED'); END;
    CREATE TABLE auth_sessions (
      id TEXT PRIMARY KEY, userId TEXT NOT NULL REFERENCES users(id),
      authVersion INTEGER NOT NULL, expiresAt INTEGER NOT NULL,
      revoked INTEGER NOT NULL DEFAULT 0, createdAt INTEGER NOT NULL,
      client TEXT NOT NULL
    );
    CREATE TABLE auth_tokens (
      hash TEXT PRIMARY KEY, sessionId TEXT NOT NULL REFERENCES auth_sessions(id),
      kind TEXT NOT NULL CHECK(kind IN ('ACCESS','REFRESH')),
      expiresAt INTEGER NOT NULL, consumed INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX tokens_session ON auth_tokens(sessionId);
    CREATE TABLE captcha_challenges (
      id TEXT PRIMARY KEY, intent TEXT NOT NULL, answer INTEGER NOT NULL,
      expiresAt INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
      consumed INTEGER NOT NULL DEFAULT 0, ticketHash TEXT UNIQUE
    );
    CREATE TABLE audit_logs (
      id TEXT PRIMARY KEY, actorId TEXT NOT NULL, ownerId TEXT NOT NULL,
      action TEXT NOT NULL, resourceId TEXT NOT NULL, requestId TEXT NOT NULL,
      createdAt INTEGER NOT NULL
    );
    CREATE TABLE login_limits (
      key TEXT PRIMARY KEY, count INTEGER NOT NULL, resetsAt INTEGER NOT NULL
    );

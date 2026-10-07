ALTER TABLE attachments ADD COLUMN sortIndex INTEGER NOT NULL DEFAULT 0;
UPDATE attachments SET sortIndex=rowid;
CREATE INDEX attachments_order ON attachments(ownerId,deletedAt,sortIndex);

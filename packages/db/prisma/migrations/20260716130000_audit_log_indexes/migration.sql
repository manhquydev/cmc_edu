-- Phase-04 super-admin-completion: the new audit middleware makes AuditLog
-- write volume grow much faster (every successful mutation, not ~15
-- hand-picked sites). The audit-log viewer filters/sorts by actor and
-- createdAt, and the retention sweep scans by createdAt — both need an index.
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX "AuditLog_actor_idx" ON "AuditLog"("actor");

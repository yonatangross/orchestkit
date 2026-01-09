-- Multi-Instance Coordination Database Schema
-- Version: 1.0.0
-- Description: SQLite schema for coordinating multiple Claude Code instances

-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- ============================================================================
-- INSTANCE REGISTRY
-- ============================================================================

CREATE TABLE IF NOT EXISTS instances (
    instance_id TEXT PRIMARY KEY,
    worktree_name TEXT NOT NULL,
    branch TEXT NOT NULL,
    agent_type TEXT,
    capabilities TEXT,  -- JSON array: ["backend", "frontend", "testing"]
    model TEXT DEFAULT 'claude-opus-4-5-20251101',
    status TEXT CHECK(status IN ('active', 'idle', 'paused', 'terminated')) DEFAULT 'active',
    priority INTEGER DEFAULT 1 CHECK(priority BETWEEN 0 AND 3),
    current_load INTEGER DEFAULT 0,  -- Number of active claims
    success_rate REAL DEFAULT 1.0 CHECK(success_rate BETWEEN 0 AND 1),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_heartbeat TIMESTAMP,
    last_review_at TIMESTAMP,
    metadata TEXT,  -- JSON for extensibility
    UNIQUE(worktree_name)
);

CREATE INDEX IF NOT EXISTS idx_instances_status ON instances(status, last_heartbeat);
CREATE INDEX IF NOT EXISTS idx_instances_priority ON instances(priority DESC, current_load ASC);

-- ============================================================================
-- FILE LOCKS
-- ============================================================================

CREATE TABLE IF NOT EXISTS file_locks (
    lock_id TEXT PRIMARY KEY,
    file_path TEXT NOT NULL,
    lock_type TEXT CHECK(lock_type IN ('exclusive_write', 'shared_read', 'directory')) NOT NULL,
    instance_id TEXT NOT NULL REFERENCES instances(instance_id) ON DELETE CASCADE,
    acquired_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    extensions INTEGER DEFAULT 0 CHECK(extensions <= 2),
    reason TEXT,
    metadata TEXT,  -- JSON: additional context
    UNIQUE(file_path, lock_type)
);

CREATE INDEX IF NOT EXISTS idx_file_locks_path ON file_locks(file_path);
CREATE INDEX IF NOT EXISTS idx_file_locks_expires ON file_locks(expires_at);
CREATE INDEX IF NOT EXISTS idx_file_locks_instance ON file_locks(instance_id);

-- ============================================================================
-- REGION LOCKS (Fine-grained locking within files)
-- ============================================================================

CREATE TABLE IF NOT EXISTS region_locks (
    region_id TEXT PRIMARY KEY,
    file_path TEXT NOT NULL,
    start_line INTEGER NOT NULL CHECK(start_line > 0),
    end_line INTEGER NOT NULL CHECK(end_line >= start_line),
    symbol_name TEXT,  -- Function/class name being edited
    symbol_type TEXT CHECK(symbol_type IN ('function', 'class', 'method', 'variable', 'import', 'other')),
    instance_id TEXT NOT NULL REFERENCES instances(instance_id) ON DELETE CASCADE,
    acquired_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    reason TEXT,
    -- Prevent overlapping regions for the same file
    UNIQUE(file_path, start_line, end_line)
);

CREATE INDEX IF NOT EXISTS idx_region_locks_file ON region_locks(file_path);
CREATE INDEX IF NOT EXISTS idx_region_locks_expires ON region_locks(expires_at);

-- ============================================================================
-- WORK CLAIMS (Task assignment and tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS work_claims (
    claim_id TEXT PRIMARY KEY,
    task_description TEXT NOT NULL,
    task_type TEXT CHECK(task_type IN ('feature', 'bugfix', 'refactor', 'test', 'docs', 'review')) NOT NULL,
    scope TEXT NOT NULL,  -- JSON array of file patterns: ["src/auth/*", "tests/auth/*"]
    priority INTEGER DEFAULT 1 CHECK(priority BETWEEN 0 AND 3),
    instance_id TEXT REFERENCES instances(instance_id) ON DELETE SET NULL,
    status TEXT CHECK(status IN ('pending', 'claimed', 'in_progress', 'blocked', 'completed', 'abandoned', 'failed')) DEFAULT 'pending',
    claimed_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    estimated_duration_minutes INTEGER,
    actual_duration_minutes INTEGER,
    blockers TEXT,  -- JSON array of blocking claim_ids
    depends_on TEXT,  -- JSON array of claim_ids this depends on
    evidence_path TEXT,  -- Path to evidence file
    result_summary TEXT,
    quality_score REAL CHECK(quality_score BETWEEN 0 AND 1),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_work_claims_instance ON work_claims(instance_id, status);
CREATE INDEX IF NOT EXISTS idx_work_claims_status ON work_claims(status, priority DESC);
CREATE INDEX IF NOT EXISTS idx_work_claims_created ON work_claims(created_at);

-- Trigger to update updated_at
CREATE TRIGGER IF NOT EXISTS work_claims_updated_at
    AFTER UPDATE ON work_claims
    FOR EACH ROW
BEGIN
    UPDATE work_claims SET updated_at = CURRENT_TIMESTAMP WHERE claim_id = NEW.claim_id;
END;

-- ============================================================================
-- SHARED KNOWLEDGE (Cross-instance learning)
-- ============================================================================

CREATE TABLE IF NOT EXISTS shared_knowledge (
    knowledge_id TEXT PRIMARY KEY,
    knowledge_type TEXT CHECK(knowledge_type IN (
        'decision',     -- Architectural/design decisions
        'pattern',      -- Good patterns to follow
        'anti_pattern', -- Patterns to avoid
        'blocker',      -- Current blockers
        'solution',     -- Solutions to problems
        'context'       -- Project context/understanding
    )) NOT NULL,
    domain TEXT,  -- e.g., "auth", "database", "frontend"
    title TEXT NOT NULL,
    content TEXT NOT NULL,  -- JSON with full details
    content_hash TEXT NOT NULL,  -- For deduplication
    source_instance TEXT REFERENCES instances(instance_id) ON DELETE SET NULL,
    confidence REAL CHECK(confidence BETWEEN 0 AND 1) DEFAULT 0.7,
    verification_count INTEGER DEFAULT 1,  -- How many instances verified this
    verified_by TEXT,  -- JSON array of instance_ids
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    last_accessed_at TIMESTAMP,
    access_count INTEGER DEFAULT 0,
    related_knowledge TEXT,  -- JSON array of related knowledge_ids
    tags TEXT,  -- JSON array of tags
    UNIQUE(content_hash)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_type ON shared_knowledge(knowledge_type, domain);
CREATE INDEX IF NOT EXISTS idx_knowledge_confidence ON shared_knowledge(confidence DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_expires ON shared_knowledge(expires_at);

-- ============================================================================
-- MESSAGE QUEUE (Inter-instance communication)
-- ============================================================================

CREATE TABLE IF NOT EXISTS messages (
    message_id TEXT PRIMARY KEY,
    from_instance TEXT REFERENCES instances(instance_id) ON DELETE CASCADE,
    to_instance TEXT REFERENCES instances(instance_id) ON DELETE CASCADE,  -- NULL for broadcast
    message_type TEXT CHECK(message_type IN (
        -- Lock messages
        'lock_request', 'lock_granted', 'lock_denied', 'lock_release',
        -- Work messages
        'work_offer', 'work_accept', 'work_reject', 'work_progress', 'work_done',
        -- Knowledge messages
        'knowledge_share', 'knowledge_query', 'knowledge_response',
        -- Coordination messages
        'blocker_alert', 'help_request', 'help_offer',
        -- Quality messages
        'review_request', 'review_result', 'quality_alert',
        -- System messages
        'heartbeat', 'status_change', 'shutdown'
    )) NOT NULL,
    payload TEXT NOT NULL,  -- JSON
    priority INTEGER DEFAULT 1 CHECK(priority BETWEEN 0 AND 3),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP,
    acknowledged_at TIMESTAMP,
    expires_at TIMESTAMP,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3
);

CREATE INDEX IF NOT EXISTS idx_messages_to_instance ON messages(to_instance, read_at);
CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(message_type, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_expires ON messages(expires_at);

-- ============================================================================
-- CONFLICT LOG (Record of detected conflicts)
-- ============================================================================

CREATE TABLE IF NOT EXISTS conflict_log (
    conflict_id TEXT PRIMARY KEY,
    conflict_type TEXT CHECK(conflict_type IN (
        'file_lock',       -- Two instances wanted same file
        'merge_conflict',  -- Git merge conflict
        'semantic',        -- Semantic conflict (interface changes, etc.)
        'scope_overlap',   -- Work claims overlapped
        'dependency'       -- Circular or broken dependency
    )) NOT NULL,
    severity TEXT CHECK(severity IN ('low', 'medium', 'high', 'critical')) NOT NULL,
    involved_instances TEXT NOT NULL,  -- JSON array of instance_ids
    affected_files TEXT,  -- JSON array of file paths
    description TEXT NOT NULL,
    resolution TEXT,  -- How it was resolved
    resolved_by TEXT REFERENCES instances(instance_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    auto_resolved INTEGER DEFAULT 0  -- Was it auto-resolved?
);

CREATE INDEX IF NOT EXISTS idx_conflict_type ON conflict_log(conflict_type, resolved_at);
CREATE INDEX IF NOT EXISTS idx_conflict_severity ON conflict_log(severity, created_at);

-- ============================================================================
-- AUDIT LOG (Complete audit trail)
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_log (
    audit_id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    instance_id TEXT,
    action_type TEXT CHECK(action_type IN (
        'instance_start', 'instance_stop',
        'lock_acquire', 'lock_release', 'lock_extend',
        'work_claim', 'work_complete', 'work_abandon',
        'knowledge_add', 'knowledge_verify',
        'message_send', 'message_receive',
        'conflict_detect', 'conflict_resolve',
        'review_request', 'review_complete'
    )) NOT NULL,
    target_type TEXT,  -- 'file', 'claim', 'knowledge', 'message', 'instance'
    target_id TEXT,
    details TEXT,  -- JSON with full details
    success INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_instance ON audit_log(instance_id, action_type);

-- ============================================================================
-- VIEWS (Convenience views for common queries)
-- ============================================================================

-- Active instances with their current workload
CREATE VIEW IF NOT EXISTS v_active_instances AS
SELECT
    i.instance_id,
    i.worktree_name,
    i.branch,
    i.agent_type,
    i.capabilities,
    i.priority,
    i.status,
    i.last_heartbeat,
    COUNT(DISTINCT wc.claim_id) as active_claims,
    COUNT(DISTINCT fl.lock_id) as held_locks
FROM instances i
LEFT JOIN work_claims wc ON i.instance_id = wc.instance_id AND wc.status IN ('claimed', 'in_progress')
LEFT JOIN file_locks fl ON i.instance_id = fl.instance_id AND fl.expires_at > datetime('now')
WHERE i.status = 'active'
AND i.last_heartbeat > datetime('now', '-30 seconds')
GROUP BY i.instance_id;

-- Current locks with instance info
CREATE VIEW IF NOT EXISTS v_current_locks AS
SELECT
    fl.lock_id,
    fl.file_path,
    fl.lock_type,
    fl.acquired_at,
    fl.expires_at,
    fl.extensions,
    fl.reason,
    i.worktree_name,
    i.branch,
    CAST((julianday(fl.expires_at) - julianday('now')) * 24 * 60 AS INTEGER) as minutes_remaining
FROM file_locks fl
JOIN instances i ON fl.instance_id = i.instance_id
WHERE fl.expires_at > datetime('now');

-- Pending and in-progress work
CREATE VIEW IF NOT EXISTS v_active_work AS
SELECT
    wc.claim_id,
    wc.task_description,
    wc.task_type,
    wc.scope,
    wc.priority,
    wc.status,
    wc.claimed_at,
    wc.started_at,
    i.worktree_name,
    i.branch,
    CAST((julianday('now') - julianday(wc.started_at)) * 24 * 60 AS INTEGER) as minutes_elapsed
FROM work_claims wc
LEFT JOIN instances i ON wc.instance_id = i.instance_id
WHERE wc.status IN ('pending', 'claimed', 'in_progress', 'blocked');

-- Recent knowledge by confidence
CREATE VIEW IF NOT EXISTS v_top_knowledge AS
SELECT
    knowledge_id,
    knowledge_type,
    domain,
    title,
    confidence,
    verification_count,
    created_at,
    access_count
FROM shared_knowledge
WHERE expires_at IS NULL OR expires_at > datetime('now')
ORDER BY confidence DESC, verification_count DESC
LIMIT 50;

-- Unread messages
CREATE VIEW IF NOT EXISTS v_unread_messages AS
SELECT
    m.message_id,
    m.message_type,
    m.from_instance,
    fi.worktree_name as from_worktree,
    m.to_instance,
    ti.worktree_name as to_worktree,
    m.priority,
    m.created_at,
    m.payload
FROM messages m
LEFT JOIN instances fi ON m.from_instance = fi.instance_id
LEFT JOIN instances ti ON m.to_instance = ti.instance_id
WHERE m.read_at IS NULL
AND (m.expires_at IS NULL OR m.expires_at > datetime('now'))
ORDER BY m.priority DESC, m.created_at ASC;

-- ============================================================================
-- MAINTENANCE PROCEDURES (Run periodically)
-- ============================================================================

-- Note: SQLite doesn't have stored procedures, so these are example queries
-- to run for maintenance. Implement in shell/Python script.

-- Cleanup expired locks
-- DELETE FROM file_locks WHERE expires_at < datetime('now');
-- DELETE FROM region_locks WHERE expires_at < datetime('now');

-- Mark stale instances as terminated
-- UPDATE instances
-- SET status = 'terminated'
-- WHERE status = 'active'
-- AND last_heartbeat < datetime('now', '-30 seconds');

-- Cleanup old messages
-- DELETE FROM messages
-- WHERE created_at < datetime('now', '-24 hours')
-- AND acknowledged_at IS NOT NULL;

-- Cleanup expired knowledge
-- DELETE FROM shared_knowledge
-- WHERE expires_at < datetime('now');

-- Archive old audit logs (keep last 7 days)
-- DELETE FROM audit_log
-- WHERE timestamp < datetime('now', '-7 days');

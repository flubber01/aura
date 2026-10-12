-- AURA Agent Command Center — PostgreSQL schema
-- Equivalent of the JSON store used by the sandbox backend (backend/src/lib/store.js).
-- Apply with explicit migration tooling; SQL snippets are not "applied migrations" by themselves.

BEGIN;

CREATE TABLE IF NOT EXISTS roles (
    id           SERIAL PRIMARY KEY,
    role         TEXT NOT NULL UNIQUE,
    department   TEXT NOT NULL,
    description  TEXT NOT NULL DEFAULT '',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tasks (
    id        BIGSERIAL PRIMARY KEY,
    trace_id  UUID NOT NULL UNIQUE,
    task      TEXT NOT NULL CHECK (char_length(task) <= 2000),
    role      TEXT NOT NULL,
    state     TEXT NOT NULL DEFAULT 'queued' CHECK (state IN ('queued','running','done','failed')),
    result    TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tasks_state ON tasks(state);

CREATE TABLE IF NOT EXISTS audit_log (
    id        BIGSERIAL PRIMARY KEY,
    at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    area      TEXT NOT NULL,
    event     TEXT NOT NULL,
    detail    JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_audit_area ON audit_log(area, at DESC);

CREATE TABLE IF NOT EXISTS mcp_tools (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    grants      TEXT[] NOT NULL CHECK (array_length(grants, 1) > 0),
    args_schema TEXT[] NOT NULL,
    enabled     BOOLEAN NOT NULL DEFAULT TRUE,
    registered_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS snapshots (
    id        BIGSERIAL PRIMARY KEY,
    name      TEXT NOT NULL UNIQUE,
    checksum  CHAR(64) NOT NULL,
    payload   JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS catalog_records (
    id         BIGSERIAL PRIMARY KEY,
    name       TEXT NOT NULL,
    url        TEXT NOT NULL UNIQUE,
    category   TEXT NOT NULL DEFAULT 'uncategorized',
    provenance TEXT NOT NULL DEFAULT 'ingest/apis.txt',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMIT;

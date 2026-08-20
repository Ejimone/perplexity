CREATE TABLE IF NOT EXISTS code_buffers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    language TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    updatedAt TEXT NOT NULL
);

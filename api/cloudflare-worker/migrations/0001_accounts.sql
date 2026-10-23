CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','player','parent','psychologist')), players_json TEXT NOT NULL DEFAULT '[]', can_p54 INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, must_change INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires INTEGER NOT NULL, data_reads INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS attempts (key TEXT NOT NULL, at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_attempts_key_time ON attempts(key,at);
CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, actor TEXT, action TEXT NOT NULL, target TEXT);

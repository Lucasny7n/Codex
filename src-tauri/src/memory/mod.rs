use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

pub struct DbState {
    pub conn: Mutex<Connection>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct MemoryItem {
    pub id: i64,
    pub content: String,
    pub tags: String,
    pub created_at: String,
}

pub fn init_db() -> Result<Connection, String> {
    let home = dirs::home_dir().ok_or("Home dir not found")?;
    let db_dir = home.join(".local/share/ailu");
    std::fs::create_dir_all(&db_dir).unwrap_or_default();
    
    let db_path = db_dir.join("memory.db");
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS memories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            content TEXT NOT NULL,
            tags TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    ).map_err(|e| e.to_string())?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS execution_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            command TEXT NOT NULL,
            success BOOLEAN NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    ).map_err(|e| e.to_string())?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS session_summaries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            summary TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    ).map_err(|e| e.to_string())?;

    Ok(conn)
}

#[tauri::command]
pub fn create_memory(db: State<DbState>, content: String, tags: String) -> Result<i64, String> {
    let conn = db.conn.lock().unwrap();
    conn.execute(
        "INSERT INTO memories (content, tags) VALUES (?1, ?2)",
        params![content, tags],
    ).map_err(|e| e.to_string())?;
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
pub fn list_memories(db: State<DbState>) -> Result<Vec<MemoryItem>, String> {
    let conn = db.conn.lock().unwrap();
    let mut stmt = conn.prepare("SELECT id, content, tags, created_at FROM memories ORDER BY created_at DESC").map_err(|e| e.to_string())?;
    let memory_iter = stmt.query_map([], |row| {
        Ok(MemoryItem {
            id: row.get(0)?,
            content: row.get(1)?,
            tags: row.get(2)?,
            created_at: row.get(3)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut memories = Vec::new();
    for mem in memory_iter {
        memories.push(mem.map_err(|e| e.to_string())?);
    }
    Ok(memories)
}

#[tauri::command]
pub fn delete_memory(db: State<DbState>, id: i64) -> Result<bool, String> {
    let conn = db.conn.lock().unwrap();
    conn.execute("DELETE FROM memories WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
pub fn search_memories(db: State<DbState>, query: String) -> Result<Vec<MemoryItem>, String> {
    let conn = db.conn.lock().unwrap();
    let mut stmt = conn.prepare("SELECT id, content, tags, created_at FROM memories WHERE content LIKE ?1 OR tags LIKE ?1 ORDER BY created_at DESC").map_err(|e| e.to_string())?;
    let search_term = format!("%{}%", query);
    let memory_iter = stmt.query_map([&search_term], |row| {
        Ok(MemoryItem {
            id: row.get(0)?,
            content: row.get(1)?,
            tags: row.get(2)?,
            created_at: row.get(3)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut memories = Vec::new();
    for mem in memory_iter {
        memories.push(mem.map_err(|e| e.to_string())?);
    }
    Ok(memories)
}

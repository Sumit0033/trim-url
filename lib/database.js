const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
let sqliteDb = null;

function mapLink(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    originalUrl: row.original_url,
    shortCode: row.short_code,
    clickCount: row.click_count,
    lastVisitedAt: row.last_visited_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getSqliteDb() {
  if (!sqliteDb) {
    const configuredPath = process.env.DATABASE_PATH && process.env.DATABASE_PATH.trim()
      ? process.env.DATABASE_PATH.trim()
      : path.join(process.env.LOCALAPPDATA || process.cwd(), "Trimly", "urls.db");
    const resolvedPath = path.resolve(configuredPath);

    fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
    sqliteDb = new Database(resolvedPath);
    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        original_url TEXT NOT NULL,
        short_code TEXT NOT NULL UNIQUE,
        click_count INTEGER NOT NULL DEFAULT 0,
        last_visited_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  return sqliteDb;
}

async function getAllLinks() {
  return getSqliteDb()
    .prepare(`
      SELECT *
      FROM links
      ORDER BY datetime(created_at) DESC
    `)
    .all()
    .map(mapLink);
}

async function getLinkByShortCode(shortCode) {
  return mapLink(
    getSqliteDb()
      .prepare(`
        SELECT *
        FROM links
        WHERE short_code = ?
      `)
      .get(shortCode)
  );
}

async function shortCodeExists(shortCode) {
  return Boolean(
    getSqliteDb()
      .prepare(`
        SELECT 1
        FROM links
        WHERE short_code = ?
        LIMIT 1
      `)
      .get(shortCode)
  );
}

async function createLink({ originalUrl, shortCode }) {
  const sqlite = getSqliteDb();
  const result = sqlite
    .prepare(`
      INSERT INTO links (original_url, short_code, updated_at)
      VALUES (@original_url, @short_code, CURRENT_TIMESTAMP)
    `)
    .run({
      original_url: originalUrl,
      short_code: shortCode,
    });

  return mapLink(
    sqlite.prepare("SELECT * FROM links WHERE id = ?").get(result.lastInsertRowid)
  );
}

async function incrementClicks(id) {
  getSqliteDb()
    .prepare(`
      UPDATE links
      SET click_count = click_count + 1,
          last_visited_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)
    .run(id);
}

async function deleteLink(id) {
  getSqliteDb()
    .prepare(`
      DELETE FROM links
      WHERE id = ?
    `)
    .run(id);
}

module.exports = {
  createLink,
  deleteLink,
  getAllLinks,
  getLinkByShortCode,
  incrementClicks,
  shortCodeExists,
};

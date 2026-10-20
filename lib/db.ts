import 'server-only';
import { createClient, type Client } from '@libsql/client';
let client: Client | undefined;
export function getDb(): Client {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL;
    if (!url) throw new Error('Database configuration missing');
    client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  }
  return client;
}
let migration: Promise<unknown> | undefined;
const tableSql = `CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 150),
  description TEXT NOT NULL DEFAULT '' CHECK(length(description) <= 3000),
  priority TEXT NOT NULL DEFAULT 'Media' CHECK(priority IN ('Baja','Media','Alta')),
  due_date TEXT NOT NULL CHECK(length(due_date) = 10 AND due_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  status TEXT NOT NULL DEFAULT 'pendiente' CHECK(status IN ('pendiente','completada')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  CHECK((status = 'pendiente' AND completed_at IS NULL) OR (status = 'completada' AND completed_at IS NOT NULL))
)`;
async function migrate() {
  const transaction = await getDb().transaction('write');
  try {
    const columns = await transaction.execute('PRAGMA table_info(tasks)');
    const legacy = columns.rows.length > 0 && !columns.rows.some((column) => column.name === 'completed_at');
    if (legacy) await transaction.execute('ALTER TABLE tasks RENAME TO tasks_legacy');
    await transaction.execute(tableSql);
    if (legacy) {
      // The copy must satisfy every new constraint before the old table is removed.
      await transaction.execute(`INSERT INTO tasks
        SELECT id, title, coalesce(description, ''), upper(substr(priority,1,1)) || lower(substr(priority,2)),
          due_date, status, created_at, updated_at,
          CASE WHEN status = 'completada' THEN updated_at ELSE NULL END
        FROM tasks_legacy`);
      await transaction.execute('DROP TABLE tasks_legacy');
    }
    await transaction.execute('CREATE INDEX IF NOT EXISTS tasks_status_due_created_idx ON tasks(status, due_date ASC, created_at DESC)');
    await transaction.execute('CREATE INDEX IF NOT EXISTS tasks_due_created_idx ON tasks(due_date ASC, created_at DESC)');
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  } finally { transaction.close(); }
}
export async function ensureTasks() {
  if (!migration) migration = migrate().catch((error) => { migration = undefined; throw error; });
  await migration;
}

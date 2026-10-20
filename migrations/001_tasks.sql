CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 150),
  description TEXT NOT NULL DEFAULT '' CHECK(length(description) <= 3000),
  priority TEXT NOT NULL DEFAULT 'Media' CHECK(priority IN ('Baja', 'Media', 'Alta')),
  due_date TEXT NOT NULL CHECK(length(due_date) = 10 AND due_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  status TEXT NOT NULL DEFAULT 'pendiente' CHECK(status IN ('pendiente', 'completada')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  CHECK((status = 'pendiente' AND completed_at IS NULL) OR (status = 'completada' AND completed_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS tasks_status_due_created_idx ON tasks(status, due_date ASC, created_at DESC);
CREATE INDEX IF NOT EXISTS tasks_due_created_idx ON tasks(due_date ASC, created_at DESC);

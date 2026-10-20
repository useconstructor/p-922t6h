import 'server-only';
import { randomUUID } from 'node:crypto';
import { ensureTasks, getDb } from '@/lib/db';
import { statuses, validId, validateTask, type FieldErrors } from '@/lib/tasks';
export function failure(status: number, code: string, message: string, fieldErrors: FieldErrors = {}) {
  return Response.json({ ok: false, error: { code, message, fieldErrors } }, { status });
}
export function success(data: unknown, status = 200) {
  return Response.json({ ok: true, data }, { status, headers: { 'Cache-Control': 'no-store' } });
}
function allowedOrigins(requestUrl: URL): Set<string> {
  // Public domains belong to server configuration. Client-supplied Host and
  // X-Forwarded-* headers never add an origin to this allowlist, even on a proxy.
  const configured = [
    ...(process.env.TASKS_ALLOWED_ORIGINS ?? '').split(','),
    process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`,
    process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`,
  ];
  const origins = new Set<string>();
  for (const value of configured) {
    if (!value?.trim()) continue;
    try {
      const url = new URL(value.trim());
      if (['http:', 'https:'].includes(url.protocol)) origins.add(url.origin);
    } catch { /* An invalid setting must not authorize a request. */ }
  }
  // Next also uses its wildcard bind address in request.url under `next start`.
  // Allow only loopback browser origins on that listening port, never wildcard
  // origins or domains supplied through Host / X-Forwarded-* headers.
  if (['localhost', '127.0.0.1', '[::1]', '0.0.0.0', '[::]'].includes(requestUrl.hostname)) {
    for (const hostname of ['localhost', '127.0.0.1', '[::1]']) {
      origins.add(`${requestUrl.protocol}//${hostname}${requestUrl.port ? `:${requestUrl.port}` : ''}`);
    }
  }
  return origins;
}
export async function listTasks(request: Request) {
  const url = new URL(request.url);
  const state = url.searchParams.get('estado') ?? 'todas';
  if (!['todas', ...statuses].includes(state) || url.searchParams.getAll('estado').length > 1 || [...url.searchParams.keys()].some((key) => key !== 'estado')) return failure(422, 'VALIDATION_ERROR', 'El filtro de estado no es válido.', { estado: 'Selecciona todas, pendiente o completada.' });
  try {
    await ensureTasks();
    const result = await getDb().execute({ sql: `SELECT * FROM tasks ${state === 'todas' ? '' : 'WHERE status = ?'} ORDER BY due_date ASC, created_at DESC`, args: state === 'todas' ? [] : [state] });
    return success(result.rows);
  } catch { return failure(500, 'INTERNAL_ERROR', 'No se pudieron cargar las tareas. Vuelve a intentarlo.'); }
}
export async function mutateTasks(request: Request, operation: 'create' | 'update' | 'status' | 'delete') {
  const origin = request.headers.get('origin');
  // An iframe sends the app's origin, not its parent's origin.
  const requestUrl = new URL(request.url);
  if ((origin && !allowedOrigins(requestUrl).has(origin)) || request.headers.get('sec-fetch-site') === 'cross-site') return failure(403, 'INVALID_ORIGIN', 'La solicitud no está permitida.');
  let body: Record<string, unknown>;
  try {
    const data = await request.json();
    if (!data || typeof data !== 'object' || Array.isArray(data)) return failure(422, 'VALIDATION_ERROR', 'Envía un objeto JSON válido.');
    body = data;
  } catch { return failure(422, 'VALIDATION_ERROR', 'Envía un objeto JSON válido.'); }
  const errors: FieldErrors = {};
  const allowed = operation === 'create' ? ['title', 'description', 'priority', 'due_date'] : operation === 'update' ? ['id', 'title', 'description', 'priority', 'due_date'] : operation === 'status' ? ['id', 'status'] : ['id', 'confirmed'];
  if (requestUrl.search || Object.keys(body).some((key) => !allowed.includes(key))) return failure(422, 'VALIDATION_ERROR', 'La solicitud contiene parámetros no admitidos.');
  if (operation !== 'create' && !validId(body.id)) errors.id = 'El identificador de tarea no es válido.';
  if (operation === 'create' || operation === 'update') Object.assign(errors, validateTask(body));
  if (operation === 'status' && !statuses.includes(body.status as typeof statuses[number])) errors.status = 'Selecciona pendiente o completada.';
  if (operation === 'delete' && body.confirmed !== true) errors.confirmed = 'Confirma explícitamente la eliminación.';
  if (Object.keys(errors).length) return failure(422, 'VALIDATION_ERROR', 'Revisa los campos indicados.', errors);
  try {
    await ensureTasks();
    const db = getDb();
    const now = new Date().toISOString();
    if (operation === 'create') {
      const result = await db.execute({ sql: 'INSERT INTO tasks (id,title,description,priority,due_date,status,created_at,updated_at,completed_at) VALUES (?,?,?,?,?,?,?,?,NULL) RETURNING *', args: [randomUUID(), (body.title as string).trim(), (body.description as string | undefined) ?? '', body.priority as string, body.due_date as string, 'pendiente', now, now] });
      return success(result.rows[0], 201);
    }
    const id = body.id as string;
    const result = operation === 'delete'
      ? await db.execute({ sql: 'DELETE FROM tasks WHERE id = ? RETURNING id', args: [id] })
      : operation === 'status'
        ? await db.execute({ sql: `UPDATE tasks SET
          updated_at = CASE WHEN status <> ? THEN ? ELSE updated_at END,
          completed_at = CASE WHEN status = ? THEN completed_at WHEN ? = 'completada' THEN ? ELSE NULL END,
          status = ? WHERE id = ? RETURNING *`,
          args: [body.status as string, now, body.status as string, body.status as string, now, body.status as string, id] })
        : await db.execute({ sql: 'UPDATE tasks SET title = ?, description = ?, priority = ?, due_date = ?, updated_at = ? WHERE id = ? RETURNING *', args: [(body.title as string).trim(), (body.description as string | undefined) ?? '', body.priority as string, body.due_date as string, now, id] });
    if (!result.rows.length) return failure(404, 'NOT_FOUND', 'La tarea ya no existe. Actualiza la lista.');
    return success(result.rows[0]);
  } catch { return failure(500, 'INTERNAL_ERROR', 'No se pudo guardar el cambio. Vuelve a intentarlo.'); }
}

export type Priority = 'Baja' | 'Media' | 'Alta';
export type Status = 'pendiente' | 'completada';
export type Filter = 'todas' | Status;
export type Task = { id: string; title: string; description: string; priority: Priority; due_date: string; status: Status; created_at: string; updated_at: string; completed_at: string | null };
export type TaskInput = { title: string; description: string; priority: Priority; due_date: string };
export type FieldErrors = Record<string, string>;
export type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string; fieldErrors: FieldErrors } };
export const priorities: Priority[] = ['Baja', 'Media', 'Alta'];
export const statuses: Status[] = ['pendiente', 'completada'];
export const priorityLabels: Record<Priority, string> = { Baja: 'Baja', Media: 'Media', Alta: 'Alta' };
export function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}
export function validateTask(input: Record<string, unknown>): FieldErrors {
  const errors: FieldErrors = {};
  if (typeof input.title !== 'string' || [...input.title.trim()].length < 1 || [...input.title.trim()].length > 150) errors.title = 'Escribe un título de entre 1 y 150 caracteres.';
  if (input.description !== undefined && (typeof input.description !== 'string' || [...input.description].length > 3000)) errors.description = 'La descripción debe tener como máximo 3.000 caracteres.';
  if (!priorities.includes(input.priority as Priority)) errors.priority = 'Selecciona Baja, Media o Alta.';
  if (!validDate(input.due_date)) errors.due_date = 'Introduce una fecha válida.';
  return errors;
}
export function sortTasks(tasks: Task[]) {
  return tasks.sort((a, b) => a.due_date.localeCompare(b.due_date) || b.created_at.localeCompare(a.created_at));
}
export function validId(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
export function formatDate(value: string) {
  const [year, month, day] = value.split('-');
  return `${day} ${['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][Number(month) - 1]} ${year}`;
}
export function formatLongDate(value: string) {
  const [year, month, day] = value.split('-');
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${Number(day)} de ${months[Number(month) - 1]} de ${year}`;
}

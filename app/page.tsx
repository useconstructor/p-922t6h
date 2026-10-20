'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { ArrowDown, ArrowRight, CalendarDays, Check, CheckCheck, ChevronDown, Circle, Loader2, Pencil, Plus, RotateCcw, Trash2, TriangleAlert, X } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetClose } from '@/components/ui/sheet';
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { formatDate, formatLongDate, validDate, priorities, priorityLabels, validateTask, sortTasks, type ApiResponse, type FieldErrors, type Filter, type Task, type TaskInput } from '@/lib/tasks';

const filters: { value: Filter; label: string }[] = [{ value: 'todas', label: 'Todas' }, { value: 'pendiente', label: 'Pendientes' }, { value: 'completada', label: 'Completadas' }];
const blank: TaskInput = { title: '', description: '', priority: 'Media', due_date: '' };
const columns = 'lg:grid-cols-[44px_minmax(0,1fr)_64px_120px_100px_168px]';

class RequestError extends Error {
  constructor(message: string, public fieldErrors: FieldErrors = {}) { super(message); }
}
async function api<T>(url: string, input?: Record<string, unknown>): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, input === undefined ? { cache: 'no-store' } : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  } catch { throw new RequestError('No se pudo conectar. Comprueba tu conexión y vuelve a intentarlo.'); }
  let result: ApiResponse<T>;
  try { result = await response.json(); } catch { throw new RequestError('No se pudo leer la respuesta. Vuelve a intentarlo.'); }
  if (!result.ok) throw new RequestError(result.error.message, result.error.fieldErrors);
  if (!response.ok) throw new RequestError('No se pudo confirmar el cambio. Vuelve a intentarlo.');
  return result.data;
}
function ErrorNotice({ message, retry }: { message: string; retry?: () => void }) {
  return <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive"><TriangleAlert size={18} className="shrink-0" /><span className="flex-1">{message}</span>{retry && <Button variant="outline" onClick={retry} className="border-destructive/30 text-destructive"><RotateCcw size={16} />Reintentar</Button>}</div>;
}
function FieldError({ name, errors }: { name: string; errors: FieldErrors }) {
  return errors[name] ? <p id={`${name}-error`} className="mt-2 flex items-start gap-2 text-sm font-medium leading-6 text-destructive"><TriangleAlert size={16} aria-hidden="true" className="mt-1 shrink-0" /><span>{errors[name]}</span></p> : null;
}

function TitleField(props: React.ComponentProps<typeof Textarea>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const resize = useCallback(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight + 2}px`;
  }, []);
  useLayoutEffect(resize, [props.value, resize]);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let width = 0;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width !== width) {
        width = entry.contentRect.width;
        resize();
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [resize]);
  return <Textarea {...props} ref={ref} rows={1} className="min-h-12 resize-none overflow-hidden leading-6"
    onKeyDown={(event) => {
      // This is a single task title; wrapped lines are visual, not line breaks.
      if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
        event.preventDefault();
        event.currentTarget.form?.requestSubmit();
      }
    }} />;
}

function DateFields({ value, onChange, errors }: { value: string; onChange: (value: string) => void; errors: FieldErrors }) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [year, month, day] = value.split('-');
  const [parts, setParts] = useState({ day: day ?? '', month: month ?? '', year: year ?? '' });
  const latestParts = useRef(parts);
  function update(part: keyof typeof parts, value: string) {
    const next = { ...latestParts.current, [part]: value };
    latestParts.current = next;
    setParts(next);
    onChange(`${next.year}-${next.month.padStart(2, '0')}-${next.day.padStart(2, '0')}`);
  }
  const describedBy = cn('date-hint', validDate(value) && 'date-selected', errors.due_date && 'due_date-error');
  return <div data-field="due_date" role="group" aria-labelledby="date-label" aria-describedby={describedBy} className="scroll-my-8">
    <div className="mb-2 flex min-h-11 flex-wrap items-center justify-between gap-x-2">
      <p id="date-label" className="text-sm font-medium">Fecha <span className="text-muted-foreground">(obligatoria)</span></p>
      <Button type="button" variant="ghost" aria-expanded={calendarOpen} aria-controls="date-calendar" onClick={() => setCalendarOpen((open) => !open)} className="px-2 text-sm text-primary hover:bg-primary/5"><CalendarDays size={16} aria-hidden="true" />Elegir en calendario</Button>
    </div>
    <div className="grid grid-cols-[1fr_1fr_1.4fr] gap-2">
      {([{ part: 'day', label: 'Día', length: 2, placeholder: 'DD' }, { part: 'month', label: 'Mes', length: 2, placeholder: 'MM' }, { part: 'year', label: 'Año', length: 4, placeholder: 'AAAA' }] as const).map(({ part, label, length, placeholder }) => <div key={part}>
        <label htmlFor={`date-${part}`} className="mb-1 block text-xs text-muted-foreground">{label}</label>
        <Input id={`date-${part}`} name={part === 'day' ? 'due_date' : `date_${part}`} type="text" inputMode="numeric" autoComplete="off" required maxLength={length} placeholder={placeholder} value={parts[part]} onChange={(event) => update(part, event.target.value)} aria-invalid={!!errors.due_date} aria-describedby={describedBy} className="font-mono" />
      </div>)}
    </div>
    <FieldError name="due_date" errors={errors} />
    <div id="date-calendar" hidden={!calendarOpen} className="mt-2">
      <Input type="date" aria-label="Fecha en calendario" aria-describedby={describedBy} value={validDate(value) ? value : ''} className="font-mono" onChange={(event) => {
        const selected = event.target.value;
        const [year = '', month = '', day = ''] = selected.split('-');
        const next = { year, month, day };
        latestParts.current = next;
        setParts(next);
        onChange(selected);
      }} />
    </div>
    {validDate(value) && <p id="date-selected" className="mt-2 font-mono text-xs text-foreground">{formatLongDate(value)}</p>}
    <p id="date-hint" className="mt-1 text-xs text-muted-foreground">También puedes indicar una fecha pasada.</p>
  </div>;
}

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<Filter>('todas');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const [feedback, setFeedback] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [form, setForm] = useState<TaskInput>({ ...blank });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Task | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmedId, setConfirmedId] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<{ id: string; message: string } | null>(null);
  const filterRef = useRef<Filter>('todas');
  const loadSequence = useRef(0);
  const saveLock = useRef(false);
  const deleteLock = useRef(false);
  const statusLock = useRef(false);
  const originRef = useRef<HTMLElement | null>(null);
  const deletedRef = useRef(false);
  const removalFocusId = useRef<string | null>(null);
  const pendingStatusFocus = useRef(false);
  const editButtons = useRef(new Map<string, HTMLButtonElement>());
  const taskRows = useRef(new Map<string, HTMLLIElement>());
  const listHeading = useRef<HTMLHeadingElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [editorViewport, setEditorViewport] = useState<{ height: number; top: number } | null>(null);
  const [initialForm, setInitialForm] = useState<TaskInput>({ ...blank });
  const dirty = editorOpen && JSON.stringify(form) !== JSON.stringify(initialForm);
  const dirtyRef = useRef(false);
  useLayoutEffect(() => { dirtyRef.current = dirty; }, [dirty]);
  const historyIndex = useRef(0);

  function selectFilter(value: Filter) {
    if (value !== filterRef.current) {
      historyIndex.current += 1;
      window.history.pushState({ ...window.history.state, taskIndex: historyIndex.current }, '', `/?estado=${value}`);
    }
    filterRef.current = value;
    setFilter(value); setFeedback('');
  }
  useEffect(() => {
    function readFilter(): Filter {
      const value = new URLSearchParams(window.location.search).get('estado');
      return value === 'pendiente' || value === 'completada' ? value : 'todas';
    }
    const initial = readFilter();
    historyIndex.current = window.history.state?.taskIndex ?? 0;
    window.history.replaceState({ ...window.history.state, taskIndex: historyIndex.current }, '', `/?estado=${initial}`);
    filterRef.current = initial;
    queueMicrotask(() => setFilter(initial));
    let restoring = false;
    function onPop(event: PopStateEvent) {
      if (restoring) { restoring = false; return; }
      const nextIndex = event.state?.taskIndex ?? 0;
      if (saveLock.current || (dirtyRef.current && !window.confirm('Hay cambios sin guardar. ¿Quieres descartarlos y salir?'))) {
        const distance = historyIndex.current - nextIndex;
        if (distance) { restoring = true; window.history.go(distance); }
        else window.history.pushState({ ...window.history.state, taskIndex: historyIndex.current }, '', `/?estado=${filterRef.current}`);
        return;
      }
      historyIndex.current = nextIndex;
      setEditorOpen(false);
      const value = readFilter();
      filterRef.current = value;
      setFilter(value); setFeedback('');
    }
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    const guardLink = (event: MouseEvent) => {
      const link = (event.target as Element).closest('a[href]');
      if (link && !window.confirm('Hay cambios sin guardar. ¿Quieres descartarlos y salir?')) event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    document.addEventListener('click', guardLink, true);
    return () => { window.removeEventListener('beforeunload', warn); document.removeEventListener('click', guardLink, true); };
  }, [dirty]);

  function closeEditor() {
    if (saveLock.current) return;
    if (dirty) setDiscardOpen(true); else setEditorOpen(false);
  }

  useEffect(() => {
    if (!editorOpen || !window.visualViewport) return;
    const viewport = window.visualViewport;
    const updateViewport = () => setEditorViewport(window.innerWidth < 640
      ? { height: viewport.height, top: viewport.offsetTop }
      : null);
    updateViewport();
    viewport.addEventListener('resize', updateViewport);
    viewport.addEventListener('scroll', updateViewport);
    return () => {
      viewport.removeEventListener('resize', updateViewport);
      viewport.removeEventListener('scroll', updateViewport);
    };
  }, [editorOpen]);

  useLayoutEffect(() => {
    if (!editorOpen || !editorViewport) return;
    const frame = requestAnimationFrame(() => {
      const active = document.activeElement;
      if (active instanceof HTMLElement && formRef.current?.querySelector('fieldset')?.contains(active)) {
        active.scrollIntoView({ block: 'nearest' });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [editorOpen, editorViewport]);

  const load = useCallback(async (showLoading = true) => {
    const sequence = ++loadSequence.current;
    const currentFilter = filterRef.current;
    if (showLoading) setLoading(true);
    setLoadError('');
    try {
      const data = await api<Task[]>(`/api/tareas?estado=${currentFilter}`);
      if (sequence !== loadSequence.current) return;
      setTasks(data);
    } catch (error) {
      if (sequence === loadSequence.current) setLoadError((error as Error).message);
    } finally { if (sequence === loadSequence.current) setLoading(false); }
  }, []);
  useEffect(() => {
    filterRef.current = filter;
    const sequenceRef = loadSequence;
    let active = true;
    queueMicrotask(() => { if (active) void load(); });
    return () => { active = false; ++sequenceRef.current; };
  }, [filter, load]);

  function announce(message: string) { setAnnouncement(message); setFeedback(message); }
  function openEditor(task: Task | null, origin: HTMLElement) {
    originRef.current = origin;
    setEditing(task);
    const values = task ? { title: task.title, description: task.description ?? '', priority: task.priority, due_date: task.due_date } : { ...blank };
    setInitialForm(values);
    setForm(values);
    setFieldErrors({}); setSaveError(''); setEditorOpen(true); setFeedback('');
    (window as Window & { constructorTrack?: (event: string) => void }).constructorTrack?.(task ? 'Task edit opened' : 'Task creation opened');
  }
  function returnFocus(event: Event) {
    event.preventDefault();
    const target = originRef.current;
    if (target?.isConnected) target.focus(); else addButton.current?.focus();
  }
  function rememberRemovalFocus(id: string) {
    const index = tasks.findIndex((task) => task.id === id);
    removalFocusId.current = tasks[index + 1]?.id ?? tasks[index - 1]?.id ?? null;
  }
  function focusAfterRemoval() {
    const target = removalFocusId.current ? editButtons.current.get(removalFocusId.current) : null;
    if (target?.isConnected && !target.disabled) target.focus(); else listHeading.current?.focus();
  }
  // Focus only after React commits the reconciled list and enables its actions.
  // A frame scheduled from the mutation can run before that commit.
  useLayoutEffect(() => {
    if (!pendingStatusFocus.current || busyId || loading) return;
    pendingStatusFocus.current = false;
    focusAfterRemoval();
  }, [tasks, busyId, loading]);
  function changeField(name: keyof TaskInput, value: string) {
    setForm((previous) => ({ ...previous, [name]: value }));
    setFieldErrors((previous) => { const next = { ...previous }; delete next[name]; return next; });
  }
  function focusInvalid(errors: FieldErrors) {
    const first = ['title', 'description', 'priority', 'due_date'].find((name) => errors[name]);
    if (first) requestAnimationFrame(() => {
      const input = formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`);
      input?.focus({ preventScroll: true });
      // Scroll the input and its message as one group, above the fixed footer.
      const field = input?.closest('[data-field]') ?? input?.parentElement;
      field?.scrollIntoView({ block: 'center', behavior: 'instant' });
    });
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (saveLock.current) return;
    const errors = validateTask(form);
    setFieldErrors(errors); setSaveError('');
    if (Object.keys(errors).length) { focusInvalid(errors); return; }
    saveLock.current = true; setSaving(true);
    try {
      const saved = await api<Task>(editing ? '/api/tareas/editar' : '/api/tareas', { ...form, ...(editing ? { id: editing.id } : {}) });
      setTasks((previous) => {
        const next = previous.filter((task) => task.id !== saved.id);
        if (filterRef.current === 'todas' || saved.status === filterRef.current) next.push(saved);
        return sortTasks(next);
      });
      setInitialForm(form); dirtyRef.current = false; setEditorOpen(false);
      announce(editing ? 'Cambios guardados.' : 'Tarea creada.');
      void load(false);
    } catch (error) {
      const problem = error as RequestError;
      setSaveError(problem.message); setFieldErrors(problem.fieldErrors ?? {}); focusInvalid(problem.fieldErrors ?? {});
    } finally { saveLock.current = false; setSaving(false); }
  }
  async function changeStatus(task: Task) {
    if (statusLock.current) return;
    statusLock.current = true; setBusyId(task.id); setStatusError(null); setFeedback('');
    try {
      const saved = await api<Task>('/api/tareas/estado', { id: task.id, status: task.status === 'pendiente' ? 'completada' : 'pendiente' });
      const removed = filterRef.current !== 'todas' && saved.status !== filterRef.current;
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (removed) rememberRemovalFocus(task.id);
      if (removed && reducedMotion) pendingStatusFocus.current = true;
      const layers = taskRows.current.get(saved.id)?.querySelectorAll<HTMLElement>('[data-status-layer], [data-title-layer]');
      // Establish each layer's current style before committing the confirmed status.
      layers?.forEach((layer) => { void getComputedStyle(layer).opacity; });
      flushSync(() => {
        setConfirmedId(saved.id);
        setTasks((previous) => removed && reducedMotion
          ? previous.filter((item) => item.id !== saved.id)
          : previous.map((item) => item.id === saved.id ? saved : item));
        // Reduced motion reconciles the row and focus in this confirmed commit.
        // Neither an animation frame nor the follow-up GET delays its removal.
        if (removed && reducedMotion) setBusyId(null);
        announce(saved.status === 'completada' ? 'Tarea marcada como completada.' : 'Tarea marcada como pendiente.');
      });
      if (!reducedMotion) {
        // Wait for the actual CSS transitions, not a timer racing the renderer.
        // Cancellation (for example, enabling reduced motion) must also release actions.
        const transitions = Array.from(layers ?? []).flatMap((layer) => layer.getAnimations());
        await Promise.allSettled(transitions.map((transition) => transition.finished));
        if (transitions.length) {
          // Keep the row mounted through the browser's transitionend dispatch.
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        }
      }
      if (removed && !reducedMotion) {
        pendingStatusFocus.current = true;
        setTasks((previous) => previous.filter((item) => filterRef.current === 'todas' || item.status === filterRef.current));
      }
      await load(false);
    } catch (error) { setStatusError({ id: task.id, message: (error as Error).message }); }
    finally { setBusyId(null); setConfirmedId(null); statusLock.current = false; }
  }
  async function confirmDelete() {
    if (!deleting || deleteLock.current) return;
    deleteLock.current = true; setDeleteBusy(true); setDeleteError('');
    try {
      await api('/api/tareas/eliminar', { id: deleting.id, confirmed: true });
      rememberRemovalFocus(deleting.id);
      setTasks((previous) => previous.filter((task) => task.id !== deleting.id));
      deletedRef.current = true; setDeleting(null); announce('Tarea eliminada.'); void load(false);
    } catch (error) { setDeleteError((error as Error).message); }
    finally { setDeleteBusy(false); deleteLock.current = false; }
  }

  return <main className="mx-auto min-h-screen max-w-[1184px] px-4 pb-8 pt-6 sm:px-8 sm:pt-8">
    <header className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-center sm:justify-between">
      <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.5px] sm:text-[28px]">Tareas AWS Frontend</h1>
      <Button ref={addButton} className="w-full focus:ring-2 focus:ring-ring focus:ring-offset-2 sm:w-auto" onClick={(event) => openEditor(null, event.currentTarget)}><Plus size={18} aria-hidden="true" />Añadir tarea</Button>
    </header>
    <div className="flex flex-wrap items-center justify-between gap-x-4 pb-1 pt-3 sm:pb-3">
      <nav aria-label="Filtrar por estado" className="inline-flex max-w-full gap-1">{filters.map((item) => <button key={item.value} type="button" aria-current={filter === item.value ? 'page' : undefined} onClick={() => selectFilter(item.value)} className={cn('relative flex min-h-11 items-center gap-2 rounded-t-md border-b-2 px-3 text-sm font-medium sm:px-4', filter === item.value ? 'border-primary bg-primary/10 text-primary' : 'border-transparent text-muted-foreground hover:bg-foreground/5 hover:text-foreground active:bg-foreground/10')}><span aria-hidden="true" className={cn('h-1 w-1 rounded-full bg-primary', filter !== item.value && 'invisible')} />{item.label}</button>)}</nav>
      <div data-utility className={cn('flex min-h-8 w-full items-center sm:min-h-11 sm:w-auto sm:justify-end', !feedback && tasks.length === 0 && 'hidden')}>
        {feedback ? <div data-feedback className="relative flex min-h-11 w-full items-center gap-2 pl-3 text-sm text-primary before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:bg-primary"><Check size={16} aria-hidden="true" className="shrink-0" /><span className="flex-1">{feedback}</span><Button variant="ghost" size="icon" aria-label="Cerrar mensaje" onClick={() => setFeedback('')} className="shrink-0 text-muted-foreground"><X size={16} aria-hidden="true" /></Button></div>
          : !loading && !loadError && tasks.length > 0 && <span className="flex items-center gap-1 text-xs text-muted-foreground"><ArrowDown size={14} aria-hidden="true" />Por fecha de vencimiento</span>}
      </div>
    </div>
    <section aria-labelledby="list-heading" aria-busy={loading} className="border-y bg-card">
      <h2 id="list-heading" ref={listHeading} tabIndex={-1} className="sr-only focus:not-sr-only focus:px-4 focus:py-3 focus:text-base focus:font-medium">{filter === 'todas' ? 'Lista de tareas' : filter === 'pendiente' ? 'Tareas pendientes' : 'Tareas completadas'}</h2>
      {!loading && !loadError && tasks.length > 0 && <div className={cn('hidden items-center gap-4 border-b bg-background/60 px-6 py-3 text-xs font-medium text-muted-foreground lg:grid', columns)} aria-hidden="true"><Check size={16} className="mx-auto" /><span>Tarea</span><span>Prioridad</span><span>Fecha</span><span>Estado</span><span className="pl-3">Acciones</span></div>}
      {loading ? <div aria-label="Cargando tareas" role="status" className="divide-y">{[1, 2, 3].map((index) => <div key={index} className="flex gap-6 px-6 py-8 motion-safe:animate-pulse"><div className="h-8 w-8 rounded border bg-muted" /><div className="flex-1 space-y-3"><div className="h-4 w-2/5 rounded bg-border/80" /><div className="h-3 w-3/5 rounded bg-muted" /></div><div className="hidden h-4 w-24 rounded bg-muted sm:block" /></div>)}<span className="sr-only">Cargando tareas…</span></div>
        : loadError ? <div className="p-6"><ErrorNotice message={loadError} retry={() => void load()} /></div>
          : tasks.length === 0 ? <div data-empty-register className="grid grid-cols-[44px_minmax(0,1fr)] gap-x-3 px-4 py-8 sm:px-6 lg:gap-x-4">
            <span data-empty-rail aria-hidden="true" className="w-[3px] self-stretch justify-self-center rounded-full bg-border" />
            <div className="min-w-0">
              <h3 className="text-lg font-semibold leading-6">{filter !== 'todas' ? 'No hay tareas en este estado' : 'Todavía no hay tareas'}</h3>
              <p className="mt-2 text-base leading-6 text-muted-foreground">{filter !== 'todas' ? 'Consulta el registro completo o añade una tarea.' : 'Añade tu primera tarea y empieza por lo importante.'}</p>
              {filter !== 'todas' ? <Button variant="outline" className="mt-4" onClick={() => selectFilter('todas')}>Ver todas<ArrowRight size={16} /></Button> : <Button variant="outline" className="mt-4 border-primary/30 text-primary hover:bg-primary/5" onClick={(event) => openEditor(null, event.currentTarget)}><Plus size={18} />Añadir tarea</Button>}
            </div>
          </div>
            : <ul className="divide-y">{tasks.map((task) => {
              const completed = task.status === 'completada';
              const statusLabel = completed ? 'Completada' : 'Pendiente';
              const actionLabel = completed ? 'Marcar como pendiente' : 'Marcar como completada';
              return <li key={task.id} ref={(element) => { if (element) taskRows.current.set(task.id, element); else taskRows.current.delete(task.id); }} data-task-id={task.id} className={cn('relative px-4 py-4 sm:px-6 hover:bg-background/60', editing?.id === task.id && editorOpen && 'bg-secondary shadow-[inset_3px_0_0_var(--color-primary)]', deleting?.id === task.id && 'bg-muted shadow-[inset_3px_0_0_var(--color-foreground)]')}>
                <div className={cn('grid grid-cols-[44px_minmax(0,1fr)] items-start gap-x-3 gap-y-2 sm:grid-cols-[44px_minmax(0,1fr)_168px] lg:gap-x-4', columns)}>
                  <Button variant="ghost" size="icon" aria-label={`${actionLabel}: ${task.title}`} title={actionLabel} disabled={!!busyId} onClick={() => void changeStatus(task)} className={cn('rounded-md sm:row-span-2 lg:row-span-1', completed ? 'text-completed hover:text-completed' : 'text-muted-foreground')}>
                    <span aria-hidden="true" className="relative block h-6 w-6"><span data-status-layer="pending" className={cn('absolute inset-0 rounded-md border border-foreground/50 transition-opacity duration-[140ms]', completed ? 'opacity-0' : 'opacity-100')} /><span data-status-layer="completed" className={cn('absolute inset-0 flex items-center justify-center rounded-md bg-completed text-white transition-opacity duration-[140ms]', completed ? 'opacity-100' : 'opacity-0')}><Check size={16} /></span>{busyId === task.id && confirmedId !== task.id && <Loader2 size={24} className="absolute inset-0 animate-spin bg-card" />}</span>
                  </Button>
                  <div className="col-start-2 min-w-0 lg:col-auto">
                    <h3 className="relative break-words pt-2 text-base font-semibold leading-6" aria-label={task.title}><span data-title-layer="pending" aria-hidden="true" className={cn('block transition-opacity duration-[140ms] lg:line-clamp-2', completed ? 'opacity-0' : 'opacity-100')}>{task.title}</span><span data-title-layer="completed" aria-hidden="true" className={cn('absolute inset-0 pt-2 text-completed line-through decoration-completed/25 decoration-1 transition-opacity duration-[140ms] lg:line-clamp-2', completed ? 'opacity-100' : 'opacity-0')}>{task.title}</span></h3>
                    {task.description && <p className="mt-2 line-clamp-1 whitespace-pre-wrap break-words text-base leading-6 text-muted-foreground sm:line-clamp-2">{task.description}</p>}
                  </div>
                  <div data-task-metadata className="col-start-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm lg:contents">
                    <span className={cn('lg:pt-2', task.priority === 'Alta' ? 'font-medium text-foreground' : 'text-muted-foreground')}><span className="sr-only">Prioridad </span>{priorityLabels[task.priority]}</span>
                    <time dateTime={task.due_date} className="flex items-center gap-2 whitespace-nowrap font-mono text-sm text-muted-foreground lg:pt-2"><CalendarDays size={14} className="lg:hidden" aria-hidden="true" />{formatDate(task.due_date)}</time>
                    <span className={cn('flex items-center gap-1 text-xs font-medium lg:min-h-11', completed ? 'text-completed' : 'text-muted-foreground')}>{completed ? <CheckCheck size={15} aria-hidden="true" /> : <Circle size={12} aria-hidden="true" />}{statusLabel}</span>
                  </div>
                  <div data-task-actions className="col-start-2 flex flex-wrap justify-start gap-1 sm:col-start-3 sm:row-start-1 sm:row-span-2 sm:justify-end lg:col-auto lg:row-span-1 lg:flex-nowrap">
                    <Button ref={(element) => { if (element) editButtons.current.set(task.id, element); else editButtons.current.delete(task.id); }} variant="ghost" aria-label={`Editar: ${task.title}`} className="px-2 text-sm text-muted-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2" disabled={!!busyId} onClick={(event) => openEditor(task, event.currentTarget)}><Pencil size={14} aria-hidden="true" />Editar</Button>
                    <Button variant="ghost" aria-label={`Eliminar: ${task.title}`} className="px-2 text-sm text-muted-foreground hover:text-foreground" disabled={!!busyId} onClick={(event) => { originRef.current = event.currentTarget; deletedRef.current = false; setDeleting(task); setDeleteError(''); }}><Trash2 size={14} aria-hidden="true" />Eliminar</Button>
                  </div>
                </div>
                {statusError?.id === task.id && <div className="mt-4"><ErrorNotice message={statusError.message} retry={() => void changeStatus(task)} /></div>}
              </li>;
            })}</ul>}
    </section>
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">{announcement}</div>

    <Sheet open={editorOpen} onOpenChange={(open) => { if (!open) closeEditor(); }}>
      <SheetContent onOpenAutoFocus={(event) => { event.preventDefault(); const title = document.getElementById('title') as HTMLTextAreaElement | null; title?.focus(); title?.setSelectionRange(0, 0); if (title) { title.scrollLeft = 0; title.scrollTop = 0; } }} onCloseAutoFocus={returnFocus} onEscapeKeyDown={(event) => { event.preventDefault(); closeEditor(); }} onPointerDownOutside={(event) => { event.preventDefault(); closeEditor(); }} style={editorViewport ? { '--editor-height': `${editorViewport.height}px`, '--editor-top': `${editorViewport.top}px` } as React.CSSProperties : undefined} className="fixed right-0 top-[var(--editor-top,0px)] z-50 flex h-[var(--editor-height,100dvh)] w-full animate-panel flex-col border-l-[3px] border-primary bg-card shadow-2xl outline-none sm:max-w-[480px]">
        <div className="flex items-start justify-between gap-4 border-b px-6 py-6 sm:px-8"><div><SheetTitle className="text-2xl font-semibold tracking-tight">{editing ? 'Editar tarea' : 'Añadir tarea'}</SheetTitle><SheetDescription className="mt-2 text-sm leading-6 text-muted-foreground">{editing ? 'Actualiza los detalles de esta tarea.' : 'Define lo que hay que hacer y para cuándo.'}</SheetDescription></div><SheetClose asChild><Button variant="ghost" size="icon" aria-label="Cerrar formulario" disabled={saving} className="-mr-2 -mt-2 shrink-0"><X size={20} /></Button></SheetClose></div>
        <form ref={formRef} noValidate onSubmit={save} className="flex min-h-0 flex-1 flex-col">
          <fieldset disabled={saving} className="min-h-0 flex-1 scroll-py-8 space-y-6 overflow-y-auto px-6 pb-8 pt-6 sm:px-8">
            <div><label htmlFor="title" className="mb-2 block text-sm font-medium">Título <span className="text-muted-foreground">(obligatorio)</span></label><TitleField id="title" name="title" required autoComplete="off" value={form.title} onChange={(event) => changeField('title', event.target.value)} aria-invalid={!!fieldErrors.title} aria-describedby={fieldErrors.title ? 'title-hint title-error' : 'title-hint'} placeholder="¿Qué hay que hacer?" /><p id="title-hint" className="mt-2 text-xs text-muted-foreground">Hasta 150 caracteres.</p><FieldError name="title" errors={fieldErrors} /></div>
            <div><label htmlFor="description" className="mb-2 block text-sm font-medium">Descripción <span className="text-muted-foreground">(opcional)</span></label><Textarea id="description" name="description" rows={5} value={form.description} onChange={(event) => changeField('description', event.target.value)} className="resize-y" aria-invalid={!!fieldErrors.description} aria-describedby={fieldErrors.description ? 'description-error' : 'description-hint'} placeholder="Añade los detalles que necesites" /><p id="description-hint" className="mt-2 text-xs text-muted-foreground">Hasta 3.000 caracteres.</p><FieldError name="description" errors={fieldErrors} /></div>
            <div>
              <label htmlFor="priority" className="mb-2 block text-sm font-medium">Prioridad</label>
              <div className="relative">
                <select id="priority" name="priority" required value={form.priority} onChange={(event) => changeField('priority', event.target.value)} aria-invalid={!!fieldErrors.priority} aria-describedby={fieldErrors.priority ? 'priority-error' : undefined} className="h-12 w-full appearance-none rounded-md border border-foreground/50 bg-card pl-3 pr-12 text-base focus-visible:ring-2 focus-visible:ring-ring">
                  {priorities.map((priority) => <option key={priority} value={priority}>{priorityLabels[priority]}</option>)}
                </select>
                <ChevronDown size={20} aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              </div>
              <FieldError name="priority" errors={fieldErrors} />
            </div>
            <DateFields value={form.due_date} onChange={(value) => changeField('due_date', value)} errors={fieldErrors} />
            {saveError && <ErrorNotice message={saveError} />}
          </fieldset>
          <div className="flex shrink-0 flex-wrap gap-3 border-t bg-card px-6 py-4 pb-[max(16px,env(safe-area-inset-bottom))] sm:px-8"><Button type="submit" disabled={saving} className="flex-1">{saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}{saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Guardar tarea'}</Button><Button type="button" variant="outline" disabled={saving} onClick={closeEditor}>Cancelar</Button></div>
        </form>
      </SheetContent>
    </Sheet>

    <AlertDialog open={!!deleting} onOpenChange={(open) => { if (!open && !deleteLock.current) setDeleting(null); }}>
      <AlertDialogContent onCloseAutoFocus={(event) => { if (deletedRef.current) { event.preventDefault(); focusAfterRemoval(); } else returnFocus(event); }} onEscapeKeyDown={(event) => { if (deleteLock.current) event.preventDefault(); }}>
        <AlertDialogTitle className="text-2xl font-semibold tracking-tight">¿Eliminar esta tarea?</AlertDialogTitle>
        <AlertDialogDescription asChild><div className="mt-4 text-base leading-6"><p className="break-words font-medium text-foreground">{deleting?.title}</p><p className="mt-3 text-muted-foreground">La eliminación es permanente. Esta acción no se puede deshacer.</p></div></AlertDialogDescription>
        {deleteError && <div className="mt-4"><ErrorNotice message={deleteError} /></div>}
        <div className="mt-8 flex flex-wrap gap-3"><AlertDialogCancel asChild><Button id="cancel-delete" variant="outline" disabled={deleteBusy} className="flex-1">Cancelar</Button></AlertDialogCancel><Button variant="destructive" disabled={deleteBusy} onClick={() => void confirmDelete()} className="flex-1">{deleteBusy && <Loader2 size={16} className="animate-spin" />}{deleteBusy ? 'Eliminando…' : 'Eliminar tarea'}</Button></div>
      </AlertDialogContent>
    </AlertDialog>
    <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
      <AlertDialogContent>
        <AlertDialogTitle className="text-2xl font-semibold tracking-tight">¿Descartar los cambios?</AlertDialogTitle>
        <AlertDialogDescription className="mt-4 text-base leading-6 text-muted-foreground">Tienes cambios sin guardar. Si cierras el formulario, se perderán.</AlertDialogDescription>
        <div className="mt-8 flex flex-wrap gap-3"><AlertDialogCancel asChild><Button variant="outline" className="flex-1">Seguir editando</Button></AlertDialogCancel><Button className="flex-1" onClick={() => { dirtyRef.current = false; setDiscardOpen(false); setEditorOpen(false); }}>Descartar cambios</Button></div>
      </AlertDialogContent>
    </AlertDialog>
  </main>;
}

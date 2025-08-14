// src/components/dashboard/WeeklyCalendar.tsx
import { useEffect, useMemo, useState } from 'react';

type CalendarEvent = {
  id: string;
  title: string;
  start: string; // ISO
  end: string;   // ISO
  allDay?: boolean;
  workerId?: string | null;
  taskTypeId?: string | null;
  color?: string | null;
  extendedProps?: {
    type?: 'baja' | 'vacaciones' | 'permiso' | string;
    status?: 'pendiente' | 'aprobado' | 'rechazado' | string;
    kind?: 'leave' | 'task';
    worker?: { id: string; username?: string; email?: string };
    workers?: Array<{ id: string; username?: string }>;
    taskTypeId?: string;
    taskTypeName?: string;
    [k: string]: any;
  };
};

type Worker = { id: string; username: string };
type TaskType = { id: string; name: string; color?: string | null };

type WeeklyCalendarProps = {
  defaultWorkerId?: string;
  lockToWorker?: boolean;
  onRangeChange?: (r: { start: Date; end: Date }) => void;
};

const HOUR_START = 7;
const HOUR_END = 19;
const SLOT_PX = 56; // altura de 1 hora
const TOTAL_HEIGHT = (HOUR_END - HOUR_START) * SLOT_PX;

function hexToRgba(hex: string, alpha = 0.18) {
  const h = (hex || '#3b82f6').replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMonday = (day + 6) % 7;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - diffToMonday);
  return d;
}
function endOfWeek(fromMonday: Date) {
  const d = new Date(fromMonday);
  d.setDate(d.getDate() + 7);
  d.setHours(0, 0, 0, 0);
  return d;
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth() === b.getMonth() &&
         a.getDate() === b.getDate();
}
function isToday(d: Date) {
  const now = new Date();
  return sameDay(d, now);
}
function isWeekend(d: Date) {
  const n = d.getDay(); // 0 dom, 6 sáb
  return n === 0 || n === 6;
}
function coerceArray<T = any>(payload: any, keyOrder: string[] = ['events', 'data', 'items']): T[] {
  if (Array.isArray(payload)) return payload as T[];
  for (const k of keyOrder) {
    if (payload && Array.isArray(payload[k])) return payload[k] as T[];
  }
  return [];
}

/** Expande un evento a eventos diarios si cruza varios días.
 *  All-day: se renderiza 07:00–19:00 para encajar en el grid horario (solo para el grid de horas).
 */
function expandEventByDay(ev: CalendarEvent, weekStart: Date, weekEnd: Date): CalendarEvent[] {
  const s = new Date(ev.start);
  const e = new Date(ev.end);
  const from = new Date(Math.max(s.getTime(), weekStart.getTime()));
  const to = new Date(Math.min(e.getTime(), (new Date(weekEnd.getTime() - 1)).getTime())); // inclusive

  if (sameDay(from, to)) {
    const start = new Date(from);
    const end = new Date(to);
    if (ev.allDay) {
      start.setHours(HOUR_START, 0, 0, 0);
      end.setHours(HOUR_END, 0, 0, 0);
    }
    return [{ ...ev, start: start.toISOString(), end: end.toISOString() }];
  }

  const days: CalendarEvent[] = [];
  const cursor = new Date(from);
  while (cursor <= to) {
    const dayStart = new Date(cursor);
    const dayEnd = new Date(cursor);

    const isFirst = sameDay(cursor, s);
    const isLast  = sameDay(cursor, e);

    if (ev.allDay) {
      dayStart.setHours(HOUR_START, 0, 0, 0);
      dayEnd.setHours(HOUR_END, 0, 0, 0);
    } else {
      if (isFirst) {
        dayStart.setHours(s.getHours(), s.getMinutes(), 0, 0);
        dayEnd.setHours(HOUR_END, 0, 0, 0);
      } else if (isLast) {
        dayStart.setHours(HOUR_START, 0, 0, 0);
        dayEnd.setHours(e.getHours(), e.getMinutes(), 0, 0);
      } else {
        dayStart.setHours(HOUR_START, 0, 0, 0);
        dayEnd.setHours(HOUR_END, 0, 0, 0);
      }
    }

    days.push({
      ...ev,
      id: `${ev.id}:${dayStart.toISOString().slice(0,10)}`,
      start: dayStart.toISOString(),
      end: dayEnd.toISOString(),
    });

    cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(0, 0, 0, 0);
  }

  return days;
}

/** Calcula columnas internas para eventos solapados (por día). */
function layoutOverlaps(dayEvents: CalendarEvent[]) {
  type Positioned = CalendarEvent & { _col: number; _cols: number };
  // Orden por inicio asc, fin asc
  const evs = [...dayEvents].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
      || new Date(a.end).getTime() - new Date(b.end).getTime()
  );

  const active: Positioned[] = [];
  const out: Positioned[] = [];

  const freeCols: number[] = []; // pila de columnas libres (reutilizar huecos)

  for (const ev of evs) {
    const s = new Date(ev.start).getTime();
    // limpia activos finalizados antes del inicio de ev
    for (let i = active.length - 1; i >= 0; i--) {
      const a = active[i];
      if (new Date(a.end).getTime() <= s) {
        freeCols.push(a._col);
        active.splice(i, 1);
      }
    }

    // asigna columna
    let col: number;
    if (freeCols.length > 0) {
      col = freeCols.pop() as number;
    } else {
      col = active.length; // siguiente columna
    }

    const positioned: Positioned = { ...ev, _col: col, _cols: 1 };
    active.push(positioned);
    out.push(positioned);

    // recalcula _cols (ancho total) = nº máximo de simultáneos
    const maxSimult = active.length;
    for (const a of active) a._cols = Math.max(a._cols, maxSimult);
  }

  // devuelve ancho y left en porcentaje
  return out.map(p => {
    const width = 100 / p._cols;
    const left = p._col * width;
    return { ...p, _leftPct: left, _widthPct: width };
  }) as Array<CalendarEvent & { _leftPct: number; _widthPct: number }>;
}

export default function WeeklyCalendar({
  defaultWorkerId = '',
  lockToWorker = false,
  onRangeChange,
}: WeeklyCalendarProps) {
  // Estado
  const [workerId, setWorkerId] = useState<string>(() => (lockToWorker ? defaultWorkerId : ''));
  const [taskTypeId, setTaskTypeId] = useState<string>(''); // filtro por tipo
  const [showWeekends, setShowWeekends] = useState<boolean>(true); // ⬅️ toggle fines de semana
  const [currentMonday, setCurrentMonday] = useState(() => startOfWeek(new Date()));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [err, setErr] = useState<string>('');
  const [nowY, setNowY] = useState<number | null>(null); // posición de la línea “now” en px

  // Sincroniza bloqueo por trabajador
  useEffect(() => {
    if (lockToWorker && defaultWorkerId && defaultWorkerId !== workerId) {
      setWorkerId(defaultWorkerId);
    }
  }, [defaultWorkerId, lockToWorker, workerId]);

  const fullWeekDays = useMemo(() => (
    Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(currentMonday);
      d.setDate(currentMonday.getDate() + i);
      return d;
    })
  ), [currentMonday]);

  const weekDays = useMemo(() => {
    if (showWeekends) return fullWeekDays;
    // oculta sábado(6) y domingo(0)
    return fullWeekDays.filter(d => !isWeekend(d));
  }, [fullWeekDays, showWeekends]);

  const weekStartISO = useMemo(() => {
    const d = new Date(currentMonday);
    d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
  }, [currentMonday]);

  const weekEndISO = useMemo(() => {
    const d = endOfWeek(currentMonday);
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }, [currentMonday]);

  // Notificar al padre
  useEffect(() => {
    onRangeChange?.({
      start: new Date(weekStartISO + 'T00:00:00'),
      end: new Date(weekEndISO + 'T23:59:59'),
    });
  }, [weekStartISO, weekEndISO, onRangeChange]);

  // Carga de eventos con filtros (worker + taskType)
  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setErr('');
        const url = new URL('/api/calendar/events', window.location.origin);
        url.searchParams.set('start', weekStartISO);
        url.searchParams.set('end', weekEndISO);
        if (workerId) url.searchParams.set('workerId', workerId);
        if (taskTypeId) url.searchParams.set('taskTypeId', taskTypeId);

        const r = await fetch(url.toString(), { cache: 'no-store' });
        const j = await r.json();
        const base = coerceArray<any>(j, ['events', 'data', 'items']);

        const normalized: CalendarEvent[] = base.map((ev: any) => ({
          id: String(ev.id),
          title: String(ev.title ?? 'Evento'),
          start: new Date(ev.start).toISOString(),
          end: new Date(ev.end).toISOString(),
          allDay: Boolean(ev.allDay),
          color: ev.backgroundColor ?? ev.borderColor ?? ev.color ?? null,
          workerId:
            ev.extendedProps?.kind === 'task'
              ? ev.extendedProps?.workers?.[0]?.id ?? null
              : ev.extendedProps?.worker?.id ?? null,
          taskTypeId: ev.extendedProps?.taskTypeId ?? null,
          extendedProps: ev.extendedProps,
        }));

        const weekStart = new Date(weekStartISO + 'T00:00:00');
        const weekEnd = new Date(weekEndISO + 'T23:59:59');
        const expanded = normalized.flatMap(ev => expandEventByDay(ev, weekStart, weekEnd));

        // Filtros locales
        const byWorker = workerId ? expanded.filter(ev => ev.workerId === workerId) : expanded;
        const byType = taskTypeId
          ? byWorker.filter(ev => ev.taskTypeId === taskTypeId || ev.extendedProps?.taskTypeId === taskTypeId)
          : byWorker;

        setEvents(byType);
      } catch (e: any) {
        console.error('WeeklyCalendar: error cargando eventos', e);
        setErr(e?.message || 'Error cargando eventos');
        setEvents([]);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [weekStartISO, weekEndISO, workerId, taskTypeId]);

  // Carga catálogos (workers, tipos de tarea)
  useEffect(() => {
    if (!lockToWorker) {
      (async () => {
        try {
          const res = await fetch('/api/workers', { cache: 'no-store' });
          const data = await res.json().catch(() => []);
          const arr = Array.isArray(data) ? data : coerceArray(data);
          setWorkers(arr.map((w: any) => ({ id: w.id, username: w.username })));
        } catch { setWorkers([]); }
      })();
    }
    (async () => {
      try {
        const res = await fetch('/api/taskTypes', { cache: 'no-store' });
        const data = await res.json().catch(() => []);
        const arr = Array.isArray(data) ? data : coerceArray(data);
        setTaskTypes(arr.map((t: any) => ({ id: t.id, name: t.name, color: t.color ?? null })));
      } catch { setTaskTypes([]); }
    })();
  }, [lockToWorker]);

  const hourSlots = useMemo(
    () => Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i),
    []
  );

  const fmtDayShort = (d: Date) =>
    new Intl.DateTimeFormat('es-ES', { weekday: 'short' }).format(d);

  const fmtDayFull = (d: Date) =>
    new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit' }).format(d);

  // Particionar por día y por tipo (allDay vs timed)
  const ofDay = (day: Date) => {
    const dayEvents = events.filter(ev => sameDay(new Date(ev.start), day));
    const allDay = dayEvents.filter(ev => !!ev.allDay);
    const timed = dayEvents.filter(ev => !ev.allDay);
    return { allDay, timed };
  };

  // helpers px
  const topPxFromDate = (d: Date) => {
    const hour = Math.max(d.getHours(), HOUR_START); // clamp: nunca antes de 07:00
    const min = (hour - HOUR_START) * 60 + d.getMinutes();
    return Math.max(0, Math.min(TOTAL_HEIGHT, (min / 60) * SLOT_PX));
  };
  const heightPxFromRange = (s: Date, e: Date) => {
    const top = topPxFromDate(s);
    const bottom = topPxFromDate(e);
    const h = Math.max(28, bottom - top);
    return Math.min(TOTAL_HEIGHT - top, h);
  };

  // Línea “now” (solo cuando hoy está dentro de la vista semanal)
  useEffect(() => {
    const today = new Date();
    const inRange =
      new Date(weekStartISO) <= today &&
      today <= new Date(new Date(weekEndISO).toISOString().slice(0,10) + 'T23:59:59');

    if (!inRange) {
      setNowY(null);
      return;
    }
    const update = () => {
      const y = topPxFromDate(new Date());
      setNowY(y);
    };
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStartISO, weekEndISO]);

  // Colores leyenda para leaves (coinciden con /api)
  const leaveColors: Record<string, string> = {
    baja: '#ef4444',
    vacaciones: '#10b981',
    permiso: '#6366f1',
  };

  return (
    <div className="w-full">
      <div className="rounded-2xl border bg-white shadow-sm ring-1 ring-black/5 overflow-hidden">
        {/* Controles */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between p-4 border-b bg-gradient-to-b from-white to-gray-50">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentMonday(prev => { const d = new Date(prev); d.setDate(d.getDate() - 7); return startOfWeek(d); })}
              className="px-3 py-2 rounded-full border shadow-sm hover:bg-gray-50 active:scale-[0.98] transition"
              title="Semana anterior"
            >
              ◀
            </button>
            <button
              onClick={() => setCurrentMonday(startOfWeek(new Date()))}
              className="px-3 py-2 rounded-full border shadow-sm hover:bg-gray-50 active:scale-[0.98] transition"
              title="Ir a hoy"
            >
              Hoy
            </button>
            <button
              onClick={() => setCurrentMonday(prev => { const d = new Date(prev); d.setDate(d.getDate() + 7); return startOfWeek(d); })}
              className="px-3 py-2 rounded-full border shadow-sm hover:bg-gray-50 active:scale-[0.98] transition"
              title="Semana siguiente"
            >
              ▶
            </button>

            <label className="ml-3 inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="rounded border-gray-300"
                checked={showWeekends}
                onChange={e => e.target.checked ? setShowWeekends(true) : setShowWeekends(false)}
              />
              Mostrar fines de semana
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {!lockToWorker ? (
              <label className="flex items-center gap-2 text-sm">
                <span className="text-gray-600">Trabajador</span>
                <select
                  className="px-3 py-2 rounded-xl border shadow-sm bg-white"
                  value={workerId}
                  onChange={e => setWorkerId(e.target.value)}
                >
                  <option value="">Todos</option>
                  {workers.map(w => (
                    <option key={w.id} value={w.id}>{w.username}</option>
                  ))}
                </select>
              </label>
            ) : (
              <span className="text-sm text-gray-600">Filtrado por <span className="font-semibold">mi calendario</span></span>
            )}

            <label className="flex items-center gap-2 text-sm">
              <span className="text-gray-600">Tipo de tarea</span>
              <select
                className="px-3 py-2 rounded-xl border shadow-sm bg-white"
                value={taskTypeId}
                onChange={e => setTaskTypeId(e.target.value)}
              >
                <option value="">Todos</option>
                {taskTypes.map(tt => (
                  <option key={tt.id} value={tt.id}>{tt.name}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* Cabecera por columna (día de la semana + fecha) */}
        <div
          className="grid border-b"
          style={{ gridTemplateColumns: '64px repeat(' + weekDays.length + ', 1fr)' }}
        >
          <div className="bg-gray-50 p-2 text-xs font-medium text-gray-500 flex items-center justify-center">
            {/* hueco para la columna de horas */}
            &nbsp;
          </div>
          {weekDays.map((d, idx) => {
            const today = isToday(d);
            return (
              <div
                key={idx}
                className={
                  'p-2 text-center text-sm font-semibold ' +
                  (today ? 'bg-blue-50 text-blue-700' : 'bg-gray-50 text-gray-700')
                }
              >
                <div className="uppercase tracking-wide">{fmtDayShort(d)}</div>
                <div className="text-xs font-normal">{fmtDayFull(d)}</div>
              </div>
            );
          })}
        </div>

        {/* ===== Fila “Todo el día” (ausencias y eventos allDay) ===== */}
        <div
          className="grid"
          style={{ gridTemplateColumns: '64px repeat(' + weekDays.length + ', 1fr)' }}
        >
          <div className="bg-gray-50 border-b p-2 text-xs font-medium text-gray-500 flex items-center justify-center">
            Todo el día
          </div>
          {weekDays.map((d, idx) => {
            const dayIsToday = isToday(d);
            const { allDay } = ofDay(d);
            return (
              <div
                key={idx}
                className={
                  'border-l border-b p-2 flex flex-col gap-2 min-h-[44px] ' +
                  (dayIsToday ? 'bg-blue-50/40' : 'bg-white')
                }
              >
                {allDay.length === 0 ? (
                  <div className="text-[11px] text-gray-400">—</div>
                ) : (
                  allDay.map(ev => {
                    const baseColor =
                      ev.extendedProps?.kind === 'leave'
                        ? leaveColors[ev.extendedProps?.type ?? ''] ?? ev.color ?? '#6b7280'
                        : ev.color || '#6b7280';
                    const bg = hexToRgba(baseColor, 0.22);
                    return (
                      <div
                        key={ev.id}
                        className="px-2 py-1 rounded-md border text-xs shadow-sm hover:shadow transition truncate"
                        style={{ borderColor: baseColor, backgroundColor: bg }}
                        title={ev.title}
                      >
                        <span className="font-medium">{ev.title}</span>
                      </div>
                    );
                  })
                )}
              </div>
            );
          })}
        </div>

        {/* ===== Grid horario 07:00–19:00 ===== */}
        <div
          className="grid"
          style={{ gridTemplateColumns: '64px repeat(' + weekDays.length + ', 1fr)' }}
        >
          {/* Gutter horas */}
          <div className="relative border-r bg-white" style={{ height: TOTAL_HEIGHT, minHeight: TOTAL_HEIGHT }}>
            <div
              className="absolute inset-0"
              style={{ backgroundImage: `repeating-linear-gradient(to bottom, #e5e7eb 0, #e5e7eb 1px, transparent 1px, transparent ${SLOT_PX}px)` }}
            />
            {hourSlots.map((h, i) => (
              <div key={h} className="absolute right-2 text-[11px] text-gray-500 select-none" style={{ top: i * SLOT_PX + 6 }}>
                {String(h).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {/* Columnas por día con eventos con hora (con compactación de solapes) */}
          {weekDays.map((day, idx) => {
            const { timed } = ofDay(day);
            const dayIsToday = isToday(day);
            const weekend = isWeekend(day);

            // calcula layout de solapes por día
            const positioned = layoutOverlaps(timed);

            return (
              <div
                key={idx}
                className={
                  'relative border-l ' +
                  (weekend ? 'bg-gray-50' : 'bg-white')
                }
                style={{ height: TOTAL_HEIGHT, minHeight: TOTAL_HEIGHT }}
              >
                {/* fondo de líneas */}
                <div
                  className="absolute inset-0"
                  style={{ backgroundImage: `repeating-linear-gradient(to bottom, #f3f4f6 0, #f3f4f6 1px, transparent 1px, transparent ${SLOT_PX}px)` }}
                />
                {/* resaltado de hoy */}
                {dayIsToday && (
                  <div className="absolute inset-0 bg-blue-50/40 pointer-events-none" />
                )}

                {/* eventos con hora (posicionados con left/width %) */}
                {positioned.map(ev => {
                  const s = new Date(ev.start);
                  const e = new Date(ev.end);
                  const col = ev.color || '#3b82f6';
                  const bg  = hexToRgba(col, 0.18);
                  const top = topPxFromDate(s);
                  const height = heightPxFromRange(s, e);
                  return (
                    <div
                      key={ev.id}
                      className="absolute rounded-xl border bg-white shadow-sm p-2 text-xs pointer-events-auto hover:shadow-md transition"
                      style={{
                        top,
                        height,
                        left: `${ev._leftPct + 0.5}%`,
                        width: `${ev._widthPct - 1}%`,
                        borderColor: col,
                        backgroundColor: bg
                      }}
                      title={ev.title}
                    >
                      <div className="font-semibold truncate">{ev.title}</div>
                      <div className="text-[11px] text-gray-600">
                        {s.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} – {e.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  );
                })}

                {/* Línea de hora actual en la columna de hoy */}
                {dayIsToday && nowY !== null && nowY >= 0 && nowY <= TOTAL_HEIGHT && (
                  <div className="absolute left-0 right-0" style={{ top: nowY }}>
                    <div className="h-[2px] w-full bg-blue-500/80" />
                    <div className="absolute -top-2 right-2 text-[10px] text-blue-700 bg-white/80 rounded px-1 shadow">
                      Ahora
                    </div>
                  </div>
                )}

                {!loading && timed.length === 0 && (
                  <div className="absolute inset-x-2 top-2 text-[11px] text-gray-400 select-none">Sin tareas</div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer: estado, leyenda y conteo */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 border-t bg-white/70">
          <div className="flex items-center gap-3 text-[11px] text-gray-600">
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: leaveColors.baja }} />
              Baja
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: leaveColors.vacaciones }} />
              Vacaciones
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: leaveColors.permiso }} />
              Permiso
            </span>
          </div>
          <div className="text-[11px] text-gray-500">
            {loading ? 'Cargando…' : `${events.length} eventos visibles`}
            {err && <span className="ml-2 text-red-600">{err}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

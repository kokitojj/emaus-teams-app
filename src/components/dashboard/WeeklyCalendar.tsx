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
    [k: string]: any;
  };
};

type Worker = { id: string; username: string };

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

export default function WeeklyCalendar({
  defaultWorkerId = '',
  lockToWorker = false,
  onRangeChange,
}: WeeklyCalendarProps) {
  // ⬇️ Inicial: si NO está bloqueado, empezamos con "Todos" (''), así admin/supervisor ven todo
  const [workerId, setWorkerId] = useState<string>(() => (lockToWorker ? defaultWorkerId : ''));
  const [currentMonday, setCurrentMonday] = useState(() => startOfWeek(new Date()));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [err, setErr] = useState<string>('');

  // Si está bloqueado al usuario (empleado), sincroniza cualquier cambio de defaultWorkerId.
  useEffect(() => {
    if (lockToWorker && defaultWorkerId && defaultWorkerId !== workerId) {
      setWorkerId(defaultWorkerId);
    }
  }, [defaultWorkerId, lockToWorker, workerId]);

  const weekDays = useMemo(() => (
    Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(currentMonday);
      d.setDate(currentMonday.getDate() + i);
      return d;
    })
  ), [currentMonday]);

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

  // Notificar al padre (opcional)
  useEffect(() => {
    onRangeChange?.({
      start: new Date(weekStartISO + 'T00:00:00'),
      end: new Date(weekEndISO + 'T23:59:59'),
    });
  }, [weekStartISO, weekEndISO, onRangeChange]);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setErr('');
        const url = new URL('/api/calendar/events', window.location.origin);
        url.searchParams.set('start', weekStartISO);
        url.searchParams.set('end', weekEndISO);
        // Solo enviamos workerId si hay uno seleccionado (empleado bloqueado o admin que elige uno)
        if (workerId) url.searchParams.set('workerId', workerId);

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
          extendedProps: ev.extendedProps,
        }));

        const weekStart = new Date(weekStartISO + 'T00:00:00');
        const weekEnd = new Date(weekEndISO + 'T23:59:59');
        const expanded = normalized.flatMap(ev => expandEventByDay(ev, weekStart, weekEnd));

        // Si hay workerId seleccionado, filtramos; si no, mostramos todo (admin/supervisor)
        const filtered = workerId ? expanded.filter(ev => ev.workerId === workerId) : expanded;

        setEvents(filtered);
      } catch (e: any) {
        console.error('WeeklyCalendar: error cargando eventos', e);
        setErr(e?.message || 'Error cargando eventos');
        setEvents([]);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [weekStartISO, weekEndISO, workerId]);

  useEffect(() => {
    if (lockToWorker) return;
    (async () => {
      try {
        const res = await fetch('/api/workers', { cache: 'no-store' });
        const data = await res.json().catch(() => []);
        const arr = Array.isArray(data) ? data : coerceArray(data);
        setWorkers(arr.map((w: any) => ({ id: w.id, username: w.username })));
      } catch {
        setWorkers([]);
      }
    })();
  }, [lockToWorker]);

  const hourSlots = useMemo(
    () => Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i),
    []
  );

  const fmtDay = (d: Date) =>
    new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: '2-digit', month: '2-digit' }).format(d);

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

  return (
    <div className="w-full">
      {/* Controles */}
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentMonday(prev => { const d = new Date(prev); d.setDate(d.getDate() - 7); return startOfWeek(d); })}
            className="px-3 py-2 rounded-xl border shadow-sm hover:bg-gray-50"
          >
            ◀ Semana anterior
          </button>
          <button
            onClick={() => setCurrentMonday(startOfWeek(new Date()))}
            className="px-3 py-2 rounded-xl border shadow-sm hover:bg-gray-50"
          >
            Hoy
          </button>
          <button
            onClick={() => setCurrentMonday(prev => { const d = new Date(prev); d.setDate(d.getDate() + 7); return startOfWeek(d); })}
            className="px-3 py-2 rounded-xl border shadow-sm hover:bg-gray-50"
          >
            Semana siguiente ▶
          </button>
        </div>

        {!lockToWorker ? (
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Trabajador:</label>
            <select
              className="px-3 py-2 rounded-xl border shadow-sm"
              value={workerId}
              onChange={e => setWorkerId(e.target.value)}
            >
              <option value="">Todos</option>
              {workers.map(w => (
                <option key={w.id} value={w.id}>{w.username}</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="text-sm text-gray-600">Filtrado por <span className="font-semibold">mi calendario</span></div>
        )}
      </div>

      {/* Cabecera semana */}
      <div className="mb-2 text-sm text-gray-600">
        Semana del <strong>{fmtDay(weekDays[0])}</strong> al <strong>{fmtDay(weekDays[6])}</strong>
      </div>

      {/* ===== Fila “Todo el día” (ausencias y eventos allDay) ===== */}
      <div
        className="grid border rounded-t-2xl"
        style={{ gridTemplateColumns: '64px repeat(7, 1fr)' }}
      >
        <div className="bg-gray-50 border-r p-2 text-xs font-medium text-gray-500">
          Todo el día
        </div>
        {weekDays.map((d, idx) => {
          const { allDay } = ofDay(d);
          return (
            <div key={idx} className="border-l p-2 flex flex-col gap-2 min-h-[40px] bg-white">
              {allDay.length === 0 ? (
                <div className="text-[11px] text-gray-400">—</div>
              ) : (
                allDay.map(ev => {
                  const col = ev.color || '#6b7280';
                  const bg = hexToRgba(col, 0.22);
                  return (
                    <div
                      key={ev.id}
                      className="px-2 py-1 rounded-md border text-xs"
                      style={{ borderColor: col, backgroundColor: bg }}
                      title={ev.title}
                    >
                      {ev.title}
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
        className="grid border-x border-b rounded-b-2xl"
        style={{ gridTemplateColumns: '64px repeat(7, 1fr)' }}
      >
        {/* Gutter de horas */}
        <div className="relative border-r bg-white" style={{ height: TOTAL_HEIGHT, minHeight: TOTAL_HEIGHT }}>
          <div
            className="absolute inset-0"
            style={{ backgroundImage: `repeating-linear-gradient(to bottom, #e5e7eb 0, #e5e7eb 1px, transparent 1px, transparent ${SLOT_PX}px)` }}
          />
          {hourSlots.map((h, i) => (
            <div key={h} className="absolute right-1 text-xs text-gray-500" style={{ top: i * SLOT_PX + 6 }}>
              {String(h).padStart(2, '0')}:00
            </div>
          ))}
        </div>

        {/* 7 columnas de día con eventos con hora */}
        {weekDays.map((day, idx) => {
          const { timed } = ofDay(day);
          return (
            <div key={idx} className="relative border-l bg-white" style={{ height: TOTAL_HEIGHT, minHeight: TOTAL_HEIGHT }}>
              <div
                className="absolute inset-0"
                style={{ backgroundImage: `repeating-linear-gradient(to bottom, #f3f4f6 0, #f3f4f6 1px, transparent 1px, transparent ${SLOT_PX}px)` }}
              />
              {timed.map(ev => {
                const s = new Date(ev.start);
                const e = new Date(ev.end);
                const col = ev.color || '#3b82f6';
                const bg  = hexToRgba(col, 0.18);
                const top = topPxFromDate(s);
                const height = heightPxFromRange(s, e);
                return (
                  <div
                    key={ev.id}
                    className="absolute left-1 right-1 rounded-xl border bg-white shadow-sm p-2 text-xs pointer-events-auto"
                    style={{ top, height, borderColor: col, backgroundColor: bg }}
                    title={ev.title}
                  >
                    <div className="font-semibold truncate">{ev.title}</div>
                    <div className="text-[11px] text-gray-600">
                      {s.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} – {e.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                );
              })}
              {!loading && timed.length === 0 && (
                <div className="absolute inset-x-2 top-2 text-[11px] text-gray-400">Sin tareas</div>
              )}
            </div>
          );
        })}
      </div>

      {loading && <div className="mt-2 text-sm text-gray-500">Cargando eventos…</div>}
      {err && <div className="mt-2 text-sm text-red-600">{err}</div>}
    </div>
  );
}

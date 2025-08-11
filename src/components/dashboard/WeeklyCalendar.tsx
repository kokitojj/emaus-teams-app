import { useEffect, useMemo, useState } from 'react';

type CalendarEvent = {
  id: string;
  title: string;
  start: string; // ISO
  end: string;   // ISO
  workerId?: string | null;
};

type Worker = { id: string; username: string };

type WeeklyCalendarProps = {
  defaultWorkerId?: string;
  lockToWorker?: boolean;
};

const HOUR_START = 8;
const HOUR_END = 20;
const SLOT_PX = 56; // altura de 1 hora
const TOTAL_HEIGHT = (HOUR_END - HOUR_START) * SLOT_PX;

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 dom … 6 sáb
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
function minutesSinceHour(d: Date, baseHour: number) {
  return (d.getHours() - baseHour) * 60 + d.getMinutes();
}
// normaliza payload a array
function coerceEvents(payload: any): CalendarEvent[] {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.events)) return payload.events;
  if (payload && Array.isArray(payload.data)) return payload.data;
  if (payload && Array.isArray(payload.items)) return payload.items;
  return [];
}

export default function WeeklyCalendar({
  defaultWorkerId = '',
  lockToWorker = false,
}: WeeklyCalendarProps) {
  const [currentMonday, setCurrentMonday] = useState(() => startOfWeek(new Date()));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [workerId, setWorkerId] = useState<string>(defaultWorkerId);

  useEffect(() => {
    if (defaultWorkerId && defaultWorkerId !== workerId) setWorkerId(defaultWorkerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultWorkerId]);

  const weekDays = useMemo(() => (
    Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(currentMonday);
      d.setDate(currentMonday.getDate() + i);
      return d;
    })
  ), [currentMonday]);

  const fromISO = useMemo(() => currentMonday.toISOString(), [currentMonday]);
  const toISO = useMemo(() => endOfWeek(currentMonday).toISOString(), [currentMonday]);

  useEffect(() => {
    const url = new URL('/api/calendar/events', window.location.origin);
    url.searchParams.set('from', fromISO);
    url.searchParams.set('to', toISO);
    if (workerId) url.searchParams.set('workerId', workerId);

    (async () => {
      try {
        const res = await fetch(url.toString(), { cache: 'no-store' });
        const raw = await res.json().catch(() => null);
        const list = coerceEvents(raw);
        setEvents(list);
        if (!Array.isArray(raw)) console.warn('WeeklyCalendar: coerceEvents()', raw);
      } catch (e) {
        console.error('WeeklyCalendar: error cargando eventos', e);
        setEvents([]);
      }
    })();
  }, [fromISO, toISO, workerId]);

  useEffect(() => {
    if (lockToWorker) return;
    (async () => {
      try {
        const res = await fetch('/api/workers', { cache: 'no-store' });
        const data = await res.json().catch(() => []);
        const arr = Array.isArray(data) ? data : coerceEvents(data);
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

  const eventsOfDay = (day: Date) => {
    const arr = Array.isArray(events) ? events : [];
    return arr.filter(ev => sameDay(new Date(ev.start), day));
  };

  // helpers px
  const topPxFromDate = (d: Date) => {
    const min = minutesSinceHour(d, HOUR_START);
    return Math.max(0, Math.min(TOTAL_HEIGHT, (min / 60) * SLOT_PX));
  };
  const heightPxFromRange = (s: Date, e: Date) => {
    const top = topPxFromDate(s);
    const bottom = topPxFromDate(e);
    const h = Math.max(28, bottom - top); // altura mínima visible
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

      {/* Cabecera (hora + días) */}
      <div className="grid grid-cols-[64px_repeat(7,1fr)] border rounded-t-2xl overflow-hidden">
        <div className="bg-gray-50 border-r p-2 text-xs font-medium text-gray-500">Hora</div>
        {weekDays.map((d, idx) => (
          <div key={idx} className="bg-gray-50 border-l p-2 text-xs font-semibold text-gray-700 text-center">
            {fmtDay(d)}
          </div>
        ))}
      </div>

      {/* Cuerpo calendario: 1 fila, 8 columnas (gutter + 7 días) */}
      <div className="grid grid-cols-[64px_repeat(7,1fr)] border-x border-b rounded-b-2xl">
        {/* Gutter de horas */}
        <div className="relative border-r" style={{ height: TOTAL_HEIGHT }}>
          {/* líneas de hora */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `repeating-linear-gradient(to bottom, #e5e7eb 0, #e5e7eb 1px, transparent 1px, transparent ${SLOT_PX}px)`
            }}
          />
          {/* labels de hora */}
          {hourSlots.map((h, i) => (
            <div key={h} className="absolute right-1 text-xs text-gray-500"
                 style={{ top: i * SLOT_PX + 6 }}>
              {String(h).padStart(2, '0')}:00
            </div>
          ))}
        </div>

        {/* 7 columnas de día */}
        {weekDays.map((day, idx) => {
          const evs = eventsOfDay(day);
          return (
            <div key={idx} className="relative border-l" style={{ height: TOTAL_HEIGHT }}>
              {/* líneas de hora */}
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: `repeating-linear-gradient(to bottom, #f3f4f6 0, #f3f4f6 1px, transparent 1px, transparent ${SLOT_PX}px)`
                }}
              />
              {/* eventos */}
              {evs.map(ev => {
                const s = new Date(ev.start);
                const e = new Date(ev.end);
                const top = topPxFromDate(s);
                const height = heightPxFromRange(s, e);
                return (
                  <div
                    key={ev.id}
                    className="absolute left-1 right-1 rounded-xl border bg-white shadow-sm p-2 text-xs"
                    style={{ top, height }}
                    title={ev.title}
                  >
                    <div className="font-semibold truncate">{ev.title}</div>
                    <div className="text-[11px] text-gray-500">
                      {s.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} – {e.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

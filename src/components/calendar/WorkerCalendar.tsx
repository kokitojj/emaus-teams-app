'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar as RBC, Views, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { es } from 'date-fns/locale'; // <-- cambio: import nombrado
import 'react-big-calendar/lib/css/react-big-calendar.css';

type CalendarEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  taskTypeName?: string;
  resourceId?: string;
};

const locales = { es } as any;
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
});

const TASK_TYPE_COLORS: Record<string, string> = {
  Limpieza: '#22c55e',
  Reparación: '#f59e0b',
  Atención: '#3b82f6',
};
const taskTypeToColor = (name?: string) => (name ? TASK_TYPE_COLORS[name] ?? '#64748b' : '#64748b');

export default function WorkerCalendar({ workerId }: { workerId: string }) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [range, setRange] = useState<{ start: Date; end: Date }>(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 });
    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
    return { start, end };
  });

  const fetchEvents = useCallback(async () => {
    const params = new URLSearchParams({
      from: range.start.toISOString(),
      to: range.end.toISOString(),
      workerId,
    });
    const res = await fetch(`/api/calendar/events?${params.toString()}`);
    const json = await res.json();
    setEvents(
      (json.events ?? []).map((e: any) => ({
        ...e,
        start: new Date(e.start),
        end: new Date(e.end),
      }))
    );
  }, [range, workerId]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const eventPropGetter = useCallback(
    (event: CalendarEvent) => ({ style: { backgroundColor: taskTypeToColor(event.taskTypeName), borderRadius: '8px' } }),
    []
  );

  const onRangeChange = useCallback((newRange: any) => {
    if (Array.isArray(newRange)) {
      const start = newRange[0];
      const end = newRange[newRange.length - 1];
      setRange({ start, end });
    } else if (newRange?.start && newRange?.end) {
      setRange({ start: newRange.start, end: newRange.end });
    }
  }, []);

  const defaultDate = useMemo(() => new Date(), []);

  return (
    <div className="p-4">
      <RBC
        localizer={localizer}
        defaultView={Views.WEEK}
        views={[Views.DAY, Views.WEEK, Views.AGENDA]}
        step={30}
        timeslots={2}
        events={events}
        startAccessor="start"
        endAccessor="end"
        defaultDate={defaultDate}
        onRangeChange={onRangeChange}
        eventPropGetter={eventPropGetter as any}  // tipos a veces estrictos; opcional castear
        messages={{ next: 'Sig.', previous: 'Ant.', today: 'Hoy', month: 'Mes', week: 'Semana', day: 'Día', agenda: 'Agenda' }}
        style={{ height: '80vh', borderRadius: 12 }}
      />
    </div>
  );
}

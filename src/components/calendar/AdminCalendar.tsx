'use client';
import type { EventInteractionArgs } from 'react-big-calendar/lib/addons/dragAndDrop';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar as RBC, Views, dateFnsLocalizer } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { es } from 'date-fns/locale'; // <-- cambio: import nombrado

import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';

type CalendarEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  taskTypeName?: string;
  resourceId?: string; // workerId
};

type CalendarResource = {
  resourceId: string;
  resourceTitle: string;
};

import { Locale } from 'date-fns';

const locales: Record<string, Locale> = { es };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
});

// Tipamos el HOC con nuestros tipos de evento y recurso:
const DnDCalendar = withDragAndDrop<CalendarEvent, CalendarResource>(RBC);

const TASK_TYPE_COLORS: Record<string, string> = {
  Limpieza: '#22c55e',
  Reparación: '#f59e0b',
  Atención: '#3b82f6',
};
const taskTypeToColor = (name?: string) => (name ? TASK_TYPE_COLORS[name] ?? '#64748b' : '#64748b');

interface RawCalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  taskTypeName?: string;
  resourceId?: string;
}

interface RawCalendarResource {
  resourceId: string;
  resourceTitle: string;
}

export default function AdminCalendar() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [resources, setResources] = useState<CalendarResource[]>([]);
  const [range, setRange] = useState<{ start: Date; end: Date }>(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 });
    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
    return { start, end };
  });

  const fetchAll = useCallback(async () => {
    const params = new URLSearchParams({ from: range.start.toISOString(), to: range.end.toISOString() });
    const [evRes, resRes] = await Promise.all([
      fetch(`/api/calendar/events?${params.toString()}`).then((r) => r.json()),
      fetch(`/api/calendar/resources`).then((r) => r.json()),
    ]);

    setEvents(
      (evRes.events ?? []).map((e: RawCalendarEvent) => ({
        ...e,
        start: new Date(e.start),
        end: new Date(e.end),
      }))
    );

    setResources(
      (resRes.resources ?? []).map((r: RawCalendarResource) => ({
        resourceId: r.resourceId,
        resourceTitle: r.resourceTitle,
      }))
    );
  }, [range]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const eventPropGetter = useCallback(
    (event: CalendarEvent) => ({ style: { backgroundColor: taskTypeToColor(event.taskTypeName), borderRadius: '8px' } }),
    []
  );

  const onRangeChange = useCallback((newRange: Date[] | { start: Date; end: Date }) => {
    if (Array.isArray(newRange)) {
      const start = newRange[0];
      const end = newRange[newRange.length - 1];
      setRange({ start, end });
    } else if (newRange?.start && newRange?.end) {
      setRange({ start: newRange.start, end: newRange.end });
    }
  }, []);

  const onEventResize = useCallback(
  async ({ event, start, end }: EventInteractionArgs<CalendarEvent>) => {
    const s = start;
    const e = end;

    const res = await fetch(`/api/calendar/events/${event.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ start: s.toISOString(), end: e.toISOString() }),
    });
    if (res.ok) {
      setEvents(prev => prev.map(ev => (ev.id === event.id ? { ...ev, start: s, end: e } : ev)));
    }
  },
  []
);
// onEventDrop: misma idea; extraemos resourceId si viene
const onEventDrop = useCallback(
  async (args: EventInteractionArgs<CalendarEvent>) => {
    const { event, start, end, resourceId } = args;

    const s = start;
    const e = end;

    const body: Record<string, string | undefined> = { start: s.toISOString(), end: e.toISOString() };
    if (resourceId) body.workerId = resourceId as string;

    const res = await fetch(`/api/calendar/events/${event.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setEvents(prev => prev.map(ev => (ev.id === event.id ? { ...ev, start: s, end: e, resourceId: resourceId as string | undefined } : ev)));
    }
  },
  []
);

  const defaultDate = useMemo(() => new Date(), []);

  return (
    <div className="p-4">
      <DndProvider backend={HTML5Backend}>
        <DnDCalendar
          localizer={localizer}
          defaultView={Views.WEEK}
          views={[Views.DAY, Views.WEEK, Views.AGENDA]}
          step={30}
          timeslots={2}
          events={events}
          // ✅ accessors como funciones (evita el error TS2769 con tipos antiguos)
          resourceIdAccessor={(r) => r.resourceId}
          resourceTitleAccessor={(r) => r.resourceTitle}
          startAccessor={(e) => e.start}
          endAccessor={(e) => e.end}
          defaultDate={defaultDate}
          onRangeChange={onRangeChange}
          eventPropGetter={eventPropGetter}
          resizable
          onEventResize={onEventResize}
          onEventDrop={onEventDrop}
          draggableAccessor={() => true}
          messages={{ next: 'Sig.', previous: 'Ant.', today: 'Hoy', month: 'Mes', week: 'Semana', day: 'Día', agenda: 'Agenda' }}
          style={{ height: '80vh', borderRadius: 12 }}
        />
      </DndProvider>
    </div>
  );
}

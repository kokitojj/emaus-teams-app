
// =====================================================
// lib/calendar.ts — utilidades de mapeo/colores (sin cambios funcionales)
// =====================================================
// file: lib/calendar.ts
import { differenceInMinutes } from 'date-fns';

export type CalendarEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resourceId?: string;
  taskTypeName?: string;
};

export type CalendarResource = {
  resourceId: string;
  resourceTitle: string;
};

export function ensureValidRange(start: Date, end: Date) {
  if (end <= start) {
    const fixed = new Date(start.getTime() + 30 * 60 * 1000);
    return { start, end: fixed };
  }
  return { start, end };
}

export function eventDurationMinutes(event: CalendarEvent) {
  return differenceInMinutes(event.end, event.start);
}

export const TASK_TYPE_COLORS: Record<string, string> = {
  Limpieza: '#22c55e',
  Reparación: '#f59e0b',
  Atención: '#3b82f6',
};

export function taskTypeToColor(name?: string) {
  if (!name) return '#64748b';
  return TASK_TYPE_COLORS[name] ?? '#64748b';
}

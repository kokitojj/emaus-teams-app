import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '@/lib/prisma';

/* =========================
 * Utilidades en UTC (sin desfases DST/servidor)
 * ========================= */
function pad2(n: number) { return String(n).padStart(2, '0'); }
function parseYmdHhmmAsUTC(ymd: string, hhmm: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  const [h, min] = hhmm.split(':').map(Number);
  return new Date(Date.UTC(y, m - 1, d, h, min, 0, 0));
}
function startOfDayUTC(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}
function endOfDayUTC(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
}
function addDaysUTC(d: Date, days: number) {
  const x = new Date(d.getTime());
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}
function sameYmdUTC(a: Date, b: Date) {
  return a.getUTCFullYear() === b.getUTCFullYear()
      && a.getUTCMonth() === b.getUTCMonth()
      && a.getUTCDate() === b.getUTCDate();
}

/* =========================
 * Conflictos (tareas por hora + leaves aprobadas por día)
 * ========================= */
async function getConflictsByDay(workerIds: string[], taskStart: Date, taskEnd: Date) {
  const dayStart = startOfDayUTC(taskStart);
  const dayEnd   = endOfDayUTC(taskEnd);

  // Tareas que se solapan por horas
  const tasks = await prisma.task.findMany({
    where: {
      startTime: { lte: taskEnd },
      endTime:   { gte: taskStart },
      workers: { some: { id: { in: workerIds } } },
    },
    select: {
      id: true,
      name: true,
      startTime: true,
      endTime: true,
      taskType: { select: { name: true } },
      workers: { select: { id: true, username: true } },
    },
    orderBy: { startTime: 'asc' },
  });

  // Leaves aprobadas que pisan el DÍA (independiente de la hora)
  const leaves = await prisma.leaveRequest.findMany({
    where: {
      status: 'aprobado',
      startDate: { lte: dayEnd },
      endDate:   { gte: dayStart },
      workerId:  { in: workerIds },
    },
    select: {
      id: true,
      type: true,
      startDate: true,
      endDate: true,
      worker: { select: { id: true, username: true } },
    },
    orderBy: { startDate: 'asc' },
  });

  const byWorker: Record<string, {
    workerId: string;
    workerName?: string;
    tasks: { id: string; name: string; taskTypeName?: string; startTime: string; endTime: string }[];
    leaves: { id: string; type: string; startDate: string; endDate: string }[];
  }> = {};

  for (const t of tasks) {
    for (const w of t.workers) {
      if (!workerIds.includes(w.id)) continue;
      byWorker[w.id] ||= { workerId: w.id, workerName: w.username, tasks: [], leaves: [] };
      byWorker[w.id].tasks.push({
        id: t.id,
        name: t.name,
        taskTypeName: t.taskType?.name || undefined,
        startTime: t.startTime.toISOString(),
        endTime: t.endTime.toISOString(),
      });
    }
  }

  for (const l of leaves) {
    const wid = l.worker?.id;
    if (!wid || !workerIds.includes(wid)) continue;
    byWorker[wid] ||= { workerId: wid, workerName: l.worker?.username, tasks: [], leaves: [] };
    byWorker[wid].leaves.push({
      id: l.id,
      type: String(l.type),
      startDate: l.startDate.toISOString(),
      endDate: l.endDate.toISOString(),
    });
  }

  return Object.values(byWorker);
}

/* =========================
 * Repetición semanal en UTC
 * ========================= */
function expandWeeklyOccurrencesUTC(params: {
  baseDateUTC: Date;           // 00:00:00 UTC del día base
  startHHmm: string;           // "HH:mm"
  endHHmm: string;             // "HH:mm"
  weekdays: number[];          // 0..6 (Dom..Sáb)
  intervalWeeks: number;       // >=1
  until?: Date | null;         // inclusive (UTC)
  count?: number | null;       // límite de ocurrencias
}) {
  const { baseDateUTC, startHHmm, endHHmm, weekdays, intervalWeeks, until, count } = params;
  const [sh, sm] = startHHmm.split(':').map(Number);
  const [eh, em] = endHHmm.split(':').map(Number);

  const results: { start: Date; end: Date; ymd: string; weekday: number }[] = [];
  if (!Array.isArray(weekdays) || weekdays.length === 0) return results;

  let occurrences = 0;

  // Posicionar cursor al LUNES de la semana del baseDateUTC (en UTC)
  const wdBase = baseDateUTC.getUTCDay();         // 0..6 (Dom..Sáb)
  const diffToMonday = (wdBase + 6) % 7;          // días hacia atrás hasta lunes
  let cursorWeekStart = addDaysUTC(startOfDayUTC(baseDateUTC), -diffToMonday);

  while (true) {
    for (const wd of weekdays) {
      const candidate = addDaysUTC(cursorWeekStart, wd); // wd ya es 0..6 (Dom..Sáb)
      const s = new Date(candidate); s.setUTCHours(sh, sm, 0, 0);
      const e = new Date(candidate); e.setUTCHours(eh, em, 0, 0);

      // Cortar por 'until'
      if (until && startOfDayUTC(s) > endOfDayUTC(until)) return results;

      const ymd = `${s.getUTCFullYear()}-${pad2(s.getUTCMonth()+1)}-${pad2(s.getUTCDate())}`;
      results.push({ start: s, end: e, ymd, weekday: wd });
      occurrences++;
      if (count && occurrences >= count) return results;
    }
    cursorWeekStart = addDaysUTC(cursorWeekStart, 7 * intervalWeeks);
    if (results.length > 5000) break; // safety
  }

  return results;
}

/* =========================
 * Handler
 * ========================= */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ message: 'No autorizado' });

  const role = (session.user as any)?.role ?? 'empleado';
  if (!['admin', 'supervisor'].includes(role)) {
    return res.status(403).json({ message: 'Acceso denegado' });
  }

  try {
    const body = req.body ?? {};

    const title: string = body.title ?? body.name;
    const taskTypeId: string = body.taskTypeId;
    const description: string | undefined = body.description ?? body.observations;

    const dateStr: string | undefined  = body.date;   // YYYY-MM-DD
    const startStr: string | undefined = body.start;  // HH:mm
    const endStr: string | undefined   = body.end;    // HH:mm

    const repeat: boolean = !!body.repeat;
    const weekdays: number[] = Array.isArray(body.weekdays) ? body.weekdays : [];
    const intervalWeeks: number = Math.max(1, Number(body.intervalWeeks || 1));
    const untilStr: string | undefined = body.until;
    const count: number | null = body.count ? Math.max(1, Number(body.count)) : null;

    const assignAllQualified: boolean = !!body.assignAllQualified;

    let workerIds: string[] = Array.isArray(body.workerIds) ? body.workerIds : [];
    const force: boolean = body?.force === true || body?.force === 'true';

    if (!title)      return res.status(400).json({ message: 'Falta título' });
    if (!taskTypeId) return res.status(400).json({ message: 'Falta taskTypeId' });

    if (assignAllQualified) {
      const tt = await prisma.taskType.findUnique({
        where: { id: taskTypeId },
        select: { qualifiedWorkers: { select: { id: true } } },
      });
      const allQualified = (tt?.qualifiedWorkers || []).map(w => w.id);
      workerIds = Array.from(new Set([ ...allQualified, ...workerIds ]));
    }
    if (!Array.isArray(workerIds) || workerIds.length === 0) {
      return res.status(400).json({ message: 'Debes seleccionar al menos un trabajador (o activar "asignar a todos los cualificados")' });
    }

    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return res.status(400).json({ message: 'date debe ser YYYY-MM-DD' });
    }
    if (!startStr || !/^\d{2}:\d{2}$/.test(startStr) || !endStr || !/^\d{2}:\d{2}$/.test(endStr)) {
      return res.status(400).json({ message: 'start/end deben ser HH:mm' });
    }

    // Expandir ocurrencias en UTC
    let occurrences: { start: Date; end: Date; ymd: string; weekday: number }[] = [];
    if (!repeat) {
      const s = parseYmdHhmmAsUTC(dateStr, startStr);
      const e = parseYmdHhmmAsUTC(dateStr, endStr);
      occurrences = [{ start: s, end: e, ymd: dateStr, weekday: s.getUTCDay() }];
    } else {
      const baseUTC = parseYmdHhmmAsUTC(dateStr, '00:00');
      const untilUTC = untilStr ? parseYmdHhmmAsUTC(untilStr, '23:59') : null;
      occurrences = expandWeeklyOccurrencesUTC({
        baseDateUTC: baseUTC,
        startHHmm: startStr,
        endHHmm: endStr,
        weekdays,
        intervalWeeks,
        until: untilUTC,
        count
      });
      if (occurrences.length === 0) {
        return res.status(400).json({ message: 'Configura al menos una ocurrencia válida (días/intervalo/hasta o nº)' });
      }
    }

    for (const occ of occurrences) {
      if (isNaN(occ.start.getTime()) || isNaN(occ.end.getTime())) {
        return res.status(400).json({ message: `Fecha inválida en la ocurrencia ${occ.ymd}` });
      }
      if (occ.start >= occ.end) {
        return res.status(400).json({ message: `El fin debe ser posterior al inicio en la ocurrencia ${occ.ymd}` });
      }
    }

    // Conflictos (solo si NO force)
    if (!force) {
      const allConflicts: any[] = [];
      for (const occ of occurrences) {
        const conflicts = await getConflictsByDay(workerIds, occ.start, occ.end);
        const has = conflicts.some(c => c.tasks.length > 0 || c.leaves.length > 0);
        if (has) allConflicts.push({ ymd: occ.ymd, start: occ.start, end: occ.end, conflicts });
      }
      if (allConflicts.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'Conflictos de agenda en una o más ocurrencias',
          conflictsByOccurrence: allConflicts,
        });
      }
    }

    // Crear todas las ocurrencias
    const created = [];
    for (const occ of occurrences) {
      const row = await prisma.task.create({
        data: {
          name: title,
          observations: description ?? null,
          taskType: { connect: { id: taskTypeId } },
          startTime: occ.start,
          endTime: occ.end,
          workers: { connect: workerIds.map(id => ({ id })) },
        },
        include: {
          workers: { select: { id: true, username: true } },
          taskType: { select: { id: true, name: true, color: true } },
        },
      });
      created.push(row);
    }

    return res.status(201).json({
      success: true,
      count: created.length,
      tasks: created.map(t => ({
        id: t.id,
        title: t.name,
        description: t.observations,
        start: t.startTime,
        end: t.endTime,
        taskTypeId: t.taskTypeId,
        taskTypeName: t.taskType?.name,
        taskTypeColor: t.taskType?.color,
        workers: t.workers,
        workerIds: t.workers.map(w => w.id),
      })),
    });
  } catch (e: any) {
    console.error('POST /api/tasks/create', e);
    return res.status(500).json({ message: 'Error interno', detail: e?.message });
  }
}

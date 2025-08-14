// src/pages/api/tasks/create.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '@/lib/prisma';

function toDateSafe(v?: string): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}
function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}
function endOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

/** Conflictos: tareas por hora y leaves aprobadas por DÍA (rango inclusivo) */
async function getConflictsByDay(workerIds: string[], taskStart: Date, taskEnd: Date) {
  const dayStart = startOfDay(taskStart);
  const dayEnd   = endOfDay(taskEnd);

  // Tareas solapadas (comparación por hora)
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

  // Leaves aprobadas de día completo (comparación por fechas)
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

  const byWorker: Record<
    string,
    {
      workerId: string;
      workerName?: string;
      tasks: { id: string; name: string; taskTypeName?: string; startTime: string; endTime: string }[];
      leaves: { id: string; type: string; startDate: string; endDate: string }[];
    }
  > = {};

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

    // Formato 1: date + start + end (HH:mm)
    const dateStr: string | undefined  = body.date;
    const startStr: string | undefined = body.start;
    const endStr: string | undefined   = body.end;

    // Formato 2: startISO + endISO (ISO completos)
    const startISO: string | undefined = body.startISO;
    const endISO: string | undefined   = body.endISO;

    const workerIds: string[] = Array.isArray(body.workerIds) ? body.workerIds : [];
    const force: boolean = body?.force === true || body?.force === 'true';

    // Validaciones básicas
    if (!title)      return res.status(400).json({ message: 'Falta título' });
    if (!taskTypeId) return res.status(400).json({ message: 'Falta taskTypeId' });
    if (!Array.isArray(workerIds) || workerIds.length === 0) {
      return res.status(400).json({ message: 'Debes seleccionar al menos un trabajador' });
    }

    // Construir fechas según formato recibido
    let finalStart: Date | null = null;
    let finalEnd: Date | null   = null;

    if (dateStr && startStr && endStr) {
      // date + HH:mm
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return res.status(400).json({ message: 'date debe ser YYYY-MM-DD' });
      }
      if (!/^\d{2}:\d{2}$/.test(startStr) || !/^\d{2}:\d{2}$/.test(endStr)) {
        return res.status(400).json({ message: 'start/end deben ser HH:mm' });
      }
      finalStart = new Date(`${dateStr}T${startStr}:00`);
      finalEnd   = new Date(`${dateStr}T${endStr}:00`);
    } else if (startISO && endISO) {
      // ISO completos
      const s = toDateSafe(startISO);
      const e = toDateSafe(endISO);
      if (!s || !e) return res.status(400).json({ message: 'Proporciona startISO y endISO válidos' });
      finalStart = s;
      finalEnd   = e;
    } else {
      // ni (date+HH:mm) ni (ISO)
      return res.status(400).json({ message: 'Proporciona (date,start,end) o (startISO,endISO)' });
    }

    if (!finalStart || !finalEnd || isNaN(finalStart.getTime()) || isNaN(finalEnd.getTime())) {
      return res.status(400).json({ message: 'Fechas inválidas' });
    }
    if (finalStart >= finalEnd) {
      return res.status(400).json({ message: 'El fin debe ser posterior al inicio' });
    }

    // Conflictos (si no se fuerza)
    if (!force) {
      const conflicts = await getConflictsByDay(workerIds, finalStart, finalEnd);
      const hasConflicts = conflicts.some(c => c.tasks.length > 0 || c.leaves.length > 0);
      if (hasConflicts) {
        return res.status(409).json({ success: false, error: 'Conflictos de agenda', conflicts });
      }
    }

    // Crear
    const created = await prisma.task.create({
      data: {
        name: title,
        observations: description ?? null,
        taskType: { connect: { id: taskTypeId } },
        startTime: finalStart,
        endTime: finalEnd,
        workers: { connect: workerIds.map(id => ({ id })) },
      },
      include: {
        workers: { select: { id: true, username: true } },
        taskType: { select: { id: true, name: true, color: true } },
      },
    });

    return res.status(201).json({
      success: true,
      task: {
        id: created.id,
        title: created.name,
        description: created.observations,
        start: created.startTime,
        end: created.endTime,
        taskTypeId: created.taskTypeId,
        taskTypeName: created.taskType?.name,
        taskTypeColor: created.taskType?.color,
        workers: created.workers,
        workerIds: created.workers.map(w => w.id),
      },
    });
  } catch (e: any) {
    console.error('POST /api/tasks/create', e);
    return res.status(500).json({ message: 'Error interno', detail: e?.message });
  }
}

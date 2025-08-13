// src/pages/api/tasks/[id].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '@/lib/prisma';

function toDateSafe(v?: string): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

/** Devuelve conflictos de agenda (otras tareas + leaves aprobadas) para workerIds en [start,end] de forma inclusiva */
async function getConflicts(params: {
  taskId: string;
  workerIds: string[];
  start: Date;
  end: Date;
}) {
  const { taskId, workerIds, start, end } = params;

  // TAREAS que se solapan (EXCLUYE la propia) — comparaciones inclusivas
  const tasks = await prisma.task.findMany({
    where: {
      id: { not: taskId },
      startTime: { lte: end },
      endTime: { gte: start },
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

  // LEAVES aprobadas que se solapan — inclusivo
  const leaves = await prisma.leaveRequest.findMany({
    where: {
      status: 'aprobado',
      startDate: { lte: end },
      endDate: { gte: start },
      workerId: { in: workerIds },
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
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ message: 'No autorizado' });
  const role = (session.user as any)?.role ?? 'empleado';
  const { id } = req.query as { id: string };

  if (req.method === 'GET') {
    try {
      const task = await prisma.task.findUnique({
        where: { id },
        include: {
          taskType: { select: { id: true, name: true, color: true } },
          workers: { select: { id: true, username: true } },
        },
      });
      if (!task) return res.status(404).json({ message: 'Tarea no encontrada' });

      return res.status(200).json({
        success: true,
        task: {
          id: task.id,
          title: task.name,
          description: task.observations,
          start: task.startTime,
          end: task.endTime,
          date: task.startTime.toISOString().slice(0, 10),
          startTimeHHmm: task.startTime.toISOString().slice(11, 16),
          endTimeHHmm: task.endTime.toISOString().slice(11, 16),
          taskTypeId: task.taskTypeId,
          taskTypeName: task.taskType?.name,
          taskTypeColor: task.taskType?.color,
          isCompleted: !!task.isCompleted,
          workers: task.workers,
          workerIds: task.workers.map(w => w.id),
        },
      });
    } catch (e: any) {
      console.error('GET /api/tasks/[id]', e);
      return res.status(500).json({ message: 'Error interno', detail: e?.message });
    }
  }

  if (req.method === 'PATCH') {
    if (!['admin', 'supervisor'].includes(role)) {
      return res.status(403).json({ message: 'Acceso denegado' });
    }

    try {
      const current = await prisma.task.findUnique({
        where: { id },
        include: { workers: { select: { id: true, username: true } } },
      });
      if (!current) return res.status(404).json({ message: 'Tarea no encontrada' });

      const body = req.body ?? {};
      const title: string | undefined = body.title ?? body.name;
      const description: string | undefined = body.description ?? body.observations;
      const taskTypeId: string | undefined = body.taskTypeId;
      const dateStr: string | undefined = body.date;   // YYYY-MM-DD
      const startStr: string | undefined = body.start; // HH:mm o ISO
      const endStr: string | undefined = body.end;     // HH:mm o ISO
      const workerIdsBody: string[] | undefined = body.workerIds;

      // Parseo ESTRICTO de force (evita que "false" cuente como true)
      const force: boolean = body?.force === true || body?.force === 'true';

      // Fechas
      let finalStart: Date = current.startTime;
      let finalEnd: Date = current.endTime;

      if (dateStr && startStr && endStr && /^\d{2}:\d{2}$/.test(startStr) && /^\d{2}:\d{2}$/.test(endStr)) {
        finalStart = new Date(`${dateStr}T${startStr}:00`);
        finalEnd = new Date(`${dateStr}T${endStr}:00`);
      } else {
        const sISO = toDateSafe(startStr);
        const eISO = toDateSafe(endStr);
        if (sISO) finalStart = sISO;
        if (eISO) finalEnd = eISO;
      }

      if (isNaN(finalStart.getTime()) || isNaN(finalEnd.getTime())) {
        return res.status(400).json({ message: 'Fechas inválidas' });
      }
      if (finalStart >= finalEnd) {
        return res.status(400).json({ message: 'El fin debe ser posterior al inicio' });
      }

      const finalWorkerIds =
        Array.isArray(workerIdsBody) && workerIdsBody.length > 0
          ? workerIdsBody
          : current.workers.map(w => w.id);

      if (!force && finalWorkerIds.length === 0) {
        return res.status(400).json({ message: 'Debe haber al menos un trabajador asignado para validar conflictos' });
      }

      // CONFLICTOS (inclusivo)
      if (!force && finalWorkerIds.length > 0) {
        const conflicts = await getConflicts({
          taskId: id,
          workerIds: finalWorkerIds,
          start: finalStart,
          end: finalEnd,
        });

        const hasConflicts = conflicts.some(c => c.tasks.length > 0 || c.leaves.length > 0);
        if (hasConflicts) {
          return res.status(409).json({ success: false, error: 'Conflictos de agenda', conflicts });
        }
      }

      const updated = await prisma.task.update({
        where: { id },
        data: {
          name: title ?? current.name,
          observations: description ?? current.observations,
          taskTypeId: taskTypeId ?? current.taskTypeId,
          startTime: finalStart,
          endTime: finalEnd,
          workers: {
            set: [],
            connect: finalWorkerIds.map(wid => ({ id: wid })),
          },
        },
        include: {
          workers: { select: { id: true, username: true } },
          taskType: { select: { id: true, name: true, color: true } },
        },
      });

      return res.status(200).json({
        success: true,
        task: {
          id: updated.id,
          title: updated.name,
          description: updated.observations,
          start: updated.startTime,
          end: updated.endTime,
          taskTypeId: updated.taskTypeId,
          taskTypeName: updated.taskType?.name,
          taskTypeColor: updated.taskType?.color,
          isCompleted: !!updated.isCompleted,
          workers: updated.workers,
          workerIds: updated.workers.map(w => w.id),
        },
      });
    } catch (e: any) {
      console.error('PATCH /api/tasks/[id]', e);
      return res.status(500).json({ message: 'Error interno', detail: e?.message });
    }
  }

  if (req.method === 'DELETE') {
    if (!['admin', 'supervisor'].includes(role)) {
      return res.status(403).json({ message: 'Acceso denegado' });
    }
    try {
      await prisma.task.delete({ where: { id } });
      return res.status(200).json({ success: true });
    } catch (e: any) {
      console.error('DELETE /api/tasks/[id]', e);
      return res.status(500).json({ message: 'Error interno', detail: e?.message });
    }
  }

  return res.status(405).json({ message: 'Method not allowed' });
}

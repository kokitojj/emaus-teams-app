import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '@/lib/prisma';

type LeaveType = 'baja' | 'vacaciones' | 'permiso';
type LeaveStatus = 'pendiente' | 'aprobado' | 'rechazado';

function toDateSafe(v?: string) {
  if (!v) return null;
  if (/^\d+$/.test(v)) {
    const d = new Date(Number(v));
    return isNaN(d.getTime()) ? null : d;
  }
  const base = new Date(v);
  return isNaN(base.getTime()) ? null : base;
}
function monthWindow(month?: string) {
  const now = new Date();
  let y = now.getFullYear();
  let m = now.getMonth();
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    y = Number(month.slice(0, 4));
    m = Number(month.slice(5, 7)) - 1;
  }
  const start = new Date(y, m, 1, 0, 0, 0, 0);
  const end = new Date(y, m + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ success: false, error: 'No autorizado' });

  try {
    const {
      start: qsStart,
      end: qsEnd,
      month,
      workerId,
      include,
      status,
      type,
      taskTypeId,
      taskTypeIds,
    } = req.query as Record<string, string | undefined>;

    // rango
    let startDate = toDateSafe(qsStart);
    let endDate = toDateSafe(qsEnd);
    if (!startDate || !endDate) {
      const w = monthWindow(month);
      startDate = startDate ?? w.start;
      endDate = endDate ?? w.end;
    }
    startDate!.setHours(0, 0, 0, 0);
    endDate!.setHours(23, 59, 59, 999);
    if (startDate! > endDate!) {
      return res.status(400).json({ success: false, error: 'start debe ser ≤ end' });
    }

    // qué incluir
    const wants = new Set((include ?? 'leaves,tasks').split(',').map(s => s.trim()));

    // filtro por tipo de tarea (uno o varios)
    let taskTypeFilterIds: string[] | undefined = undefined;
    if (taskTypeIds) {
      taskTypeFilterIds = taskTypeIds.split(',').map(s => s.trim()).filter(Boolean);
    } else if (taskTypeId) {
      taskTypeFilterIds = [taskTypeId];
    }

    const colorByLeave: Record<string, string> = {
      baja: '#ef4444',
      vacaciones: '#10b981',
      permiso: '#6366f1',
    };

    const events: any[] = [];

    // LEAVES (all‑day)
    if (wants.has('leaves')) {
      const whereLeaves: any = {
        startDate: { lte: endDate },
        endDate: { gte: startDate },
        status: (status as LeaveStatus) || 'aprobado',
      };
      if (type) whereLeaves.type = type as LeaveType;
      if (workerId) whereLeaves.workerId = workerId;

      const leaves = await prisma.leaveRequest.findMany({
        where: whereLeaves,
        orderBy: { startDate: 'asc' },
        include: { worker: { select: { id: true, username: true, email: true } } },
      });

      for (const r of leaves) {
        events.push({
          id: r.id,
          title: `${r.type === 'baja' ? 'Baja' : r.type === 'vacaciones' ? 'Vacaciones' : 'Permiso'} · ${r.worker?.username ?? r.workerId}`,
          start: r.startDate,
          end: new Date(r.endDate.getTime() + 1), // end exclusivo
          allDay: true,
          backgroundColor: colorByLeave[r.type] ?? '#6b7280',
          borderColor: colorByLeave[r.type] ?? '#6b7280',
          extendedProps: {
            kind: 'leave',
            type: r.type,
            status: r.status,
            reason: r.reason,
            worker: r.worker,
            supervisorId: r.supervisorId,
            reviewedAt: r.reviewedAt,
          },
        });
      }
    }

    // TASKS
    if (wants.has('tasks')) {
      const whereTasks: any = {
        startTime: { lte: endDate },
        endTime: { gte: startDate },
      };
      if (workerId) whereTasks.workers = { some: { id: workerId } };
      if (taskTypeFilterIds?.length) whereTasks.taskTypeId = { in: taskTypeFilterIds };

      const tasks = await prisma.task.findMany({
        where: whereTasks,
        orderBy: { startTime: 'asc' },
        include: {
          taskType: { select: { id: true, name: true, color: true } },
          workers: { select: { id: true, username: true } },
        },
      });

      for (const t of tasks) {
        events.push({
          id: t.id,
          title: `${t.name} · ${t.taskType?.name ?? 'Tarea'}`,
          start: t.startTime,
          end: t.endTime,
          allDay: false,
          backgroundColor: t.taskType?.color ?? undefined,
          borderColor: t.taskType?.color ?? undefined,
          extendedProps: {
            kind: 'task',
            isCompleted: t.isCompleted,
            observations: t.observations,
            taskTypeId: t.taskTypeId,
            taskTypeName: t.taskType?.name,
            workers: t.workers,
          },
        });
      }
    }

    events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    return res.status(200).json({
      success: true,
      events,
      range: { start: startDate, end: endDate },
    });
  } catch (e: any) {
    console.error('ERROR /api/calendar/events:', e);
    return res.status(500).json({ success: false, error: e?.message || 'Error interno' });
  }
}

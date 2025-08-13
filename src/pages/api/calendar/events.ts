import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '@/lib/prisma';

type LeaveType = 'baja' | 'vacaciones' | 'permiso';
type LeaveStatus = 'pendiente' | 'aprobado' | 'rechazado';

function toDateSafe(v?: string) {
  if (!v) return null;
  // admite YYYY-MM-DD, ISO completo o timestamp
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

  const role = (session.user as any)?.role ?? 'empleado';

  // Resolver el Worker real asociado a la sesión (id || email || username)
  const sessionUserId = (session.user as any)?.id as string | undefined;
  const sessionEmail = (session.user as any)?.email as string | undefined;
  const sessionUsername = (session.user as any)?.username as string | undefined;

  let meWorkerId: string | undefined = undefined;
  try {
    const me = await prisma.worker.findFirst({
      where: {
        OR: [
          sessionUserId ? { id: sessionUserId } : undefined,
          sessionEmail ? { email: sessionEmail } : undefined,
          sessionUsername ? { username: sessionUsername } : undefined,
        ].filter(Boolean) as any[],
      },
      select: { id: true },
    });
    meWorkerId = me?.id;
  } catch {
    // noop
  }

  try {
    const { start: qsStart, end: qsEnd, month, include, status, type } =
      req.query as Record<string, string | undefined>;
    let { workerId } = req.query as Record<string, string | undefined>;

    // Ventana de búsqueda
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

    // Seguridad: un empleado solo puede consultar SU propio workerId
    let effectiveWorkerId = workerId;
    if (role === 'empleado') {
      effectiveWorkerId = meWorkerId || workerId;
    }

    // Qué incluir (por defecto: leaves + tasks)
    const wants = new Set((include ?? 'leaves,tasks').split(',').map(s => s.trim().toLowerCase()));

    const colorByLeave: Record<string, string> = {
      baja: '#ef4444',        // rojo
      vacaciones: '#10b981',  // verde
      permiso: '#6366f1',     // índigo
    };

    const events: any[] = [];

    // ---- LEAVES (ausencias, solapan rango) ----
    if (wants.has('leaves')) {
      const whereLeaves: any = {
        startDate: { lte: endDate },
        endDate: { gte: startDate },
        status: (status as LeaveStatus) || 'aprobado',
      };
      if (type) whereLeaves.type = type as LeaveType;
      if (effectiveWorkerId) whereLeaves.workerId = effectiveWorkerId;

      const leaves = await prisma.leaveRequest.findMany({
        where: whereLeaves,
        orderBy: { startDate: 'asc' },
        include: { worker: { select: { id: true, username: true, email: true } } },
      });

      for (const r of leaves) {
        events.push({
          id: r.id,
          title: `${r.type === 'baja' ? 'Baja' : r.type === 'vacaciones' ? 'Vacaciones' : 'Permiso'} · ${r.worker?.username ?? r.workerId}`,
          start: r.startDate,                                 // ISO
          end: new Date(r.endDate.getTime() + 1),             // end exclusivo → +1 ms
          allDay: true,                                       // se dibujan como día completo (07–19 en UI)
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

    // ---- TASKS (solapan rango) ----
    if (wants.has('tasks')) {
      const whereTasks: any = {
        startTime: { lte: endDate },
        endTime: { gte: startDate },
      };
      if (effectiveWorkerId) {
        // many-to-many Task <-> Worker
        whereTasks.workers = { some: { id: effectiveWorkerId } };
      }

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
          allDay: false,                                       // tareas en horario real
          backgroundColor: t.taskType?.color ?? undefined,     // color por tipo
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

    // Orden final por fecha de inicio
    events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    return res.status(200).json({ success: true, events, range: { start: startDate, end: endDate } });
  } catch (e: any) {
    console.error('ERROR /api/calendar/events:', e);
    return res.status(500).json({ success: false, error: e?.message || 'Error interno' });
  }
}

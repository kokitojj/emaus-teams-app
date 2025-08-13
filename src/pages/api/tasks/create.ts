// src/pages/api/tasks/create.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '@/lib/prisma';

type Body = {
  name?: string;
  taskTypeId?: string;
  // variantes de fechas soportadas:
  date?: string;      // YYYY-MM-DD
  start?: string;     // HH:mm o ISO con 'T'
  end?: string;       // HH:mm o ISO con 'T'
  startTime?: string; // ISO
  endTime?: string;   // ISO
  observations?: string | null;
  workerIds?: string[]; // IDs de Worker
};

function toISOFromLocal(date: string, hhmm: string) {
  const [h, m] = (hhmm || '').split(':').map(Number);
  const [y, mo, d] = (date || '').split('-').map(Number);
  const dt = new Date(y, (mo || 1) - 1, d || 1, h || 0, m || 0, 0, 0);
  return dt.toISOString();
}

/** Acepta (date,start,end HH:mm), o (start,end ISO), o (startTime,endTime ISO) */
function parseStartEnd(body: Body): { start: Date; end: Date } | null {
  // 1) start/end ISO directos
  if (body.start && body.end && body.start.includes('T') && body.end.includes('T')) {
    const s = new Date(body.start); const e = new Date(body.end);
    if (!isNaN(s.getTime()) && !isNaN(e.getTime())) return { start: s, end: e };
  }
  // 2) startTime/endTime ISO
  if (body.startTime && body.endTime) {
    const s = new Date(body.startTime); const e = new Date(body.endTime);
    if (!isNaN(s.getTime()) && !isNaN(e.getTime())) return { start: s, end: e };
  }
  // 3) date + start/end HH:mm
  if (body.date && body.start && body.end && !body.start.includes('T') && !body.end.includes('T')) {
    const sISO = toISOFromLocal(body.date, body.start);
    const eISO = toISOFromLocal(body.date, body.end);
    const s = new Date(sISO); const e = new Date(eISO);
    if (!isNaN(s.getTime()) && !isNaN(e.getTime())) return { start: s, end: e };
  }
  return null;
}

/** true si hay solape (rango abierto) */
function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && aEnd > bStart;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session) return res.status(401).json({ success: false, error: 'No autorizado' });

    const role = (session.user as any)?.role ?? 'empleado';
    if (!['admin', 'supervisor'].includes(role)) {
      return res.status(403).json({ success: false, error: 'Acceso denegado' });
    }

    const body = (req.body || {}) as Body;
    const { name, taskTypeId, observations, workerIds = [] } = body;

    // Validaciones básicas
    if (!name || !taskTypeId) {
      return res.status(400).json({ success: false, error: 'Faltan campos requeridos (name, taskTypeId)' });
    }
    if (!Array.isArray(workerIds) || workerIds.length === 0) {
      return res.status(400).json({ success: false, error: 'Selecciona al menos un trabajador' });
    }

    const parsed = parseStartEnd(body);
    if (!parsed) {
      return res.status(400).json({
        success: false,
        error: 'Proporciona (date,start,end) o (start,end) ISO.',
      });
    }
    const { start, end } = parsed;
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ success: false, error: 'Fechas inválidas' });
    }
    if (!(end > start)) {
      return res.status(400).json({ success: false, error: 'La fecha de fin debe ser posterior al inicio' });
    }

    // Verifica TaskType
    const tt = await prisma.taskType.findUnique({ where: { id: taskTypeId }, select: { id: true } });
    if (!tt) return res.status(404).json({ success: false, error: 'Tipo de tarea no encontrado' });

    // ---------- DETECCIÓN DE CONFLICTOS ----------
    // Por cada worker, buscamos tareas y leaves que SOLAPEN el rango propuesto
    // Solape: start < existing.end AND end > existing.start
    const conflicts: Array<{
      workerId: string;
      workerName?: string;
      tasks: { id: string; name: string; taskTypeName?: string; startTime: string; endTime: string }[];
      leaves: { id: string; type: string; startDate: string; endDate: string }[];
    }> = [];

    // Cargamos nombres para el informe
    const workersMap = new Map<string, string>();
    const workersInfo = await prisma.worker.findMany({
      where: { id: { in: workerIds } },
      select: { id: true, username: true },
    });
    for (const w of workersInfo) workersMap.set(w.id, w.username || '');

    for (const wId of workerIds) {
      // TAREAS del worker que solapan
      const overlappingTasks = await prisma.task.findMany({
        where: {
          startTime: { lt: end },
          endTime: { gt: start },
          workers: { some: { id: wId } }, // M:N
        },
        select: {
          id: true, name: true, startTime: true, endTime: true,
          taskType: { select: { name: true } },
        },
        orderBy: { startTime: 'asc' },
      });

      // LEAVES (aprobadas) del worker que solapan
      const overlappingLeaves = await prisma.leaveRequest.findMany({
        where: {
          workerId: wId,
          status: 'aprobado',
          startDate: { lt: end },
          endDate: { gt: start },
        },
        select: { id: true, type: true, startDate: true, endDate: true },
        orderBy: { startDate: 'asc' },
      });

      if (overlappingTasks.length || overlappingLeaves.length) {
        conflicts.push({
          workerId: wId,
          workerName: workersMap.get(wId) || undefined,
          tasks: overlappingTasks.map(t => ({
            id: t.id,
            name: t.name,
            taskTypeName: t.taskType?.name || undefined,
            startTime: t.startTime.toISOString(),
            endTime: t.endTime.toISOString(),
          })),
          leaves: overlappingLeaves.map(l => ({
            id: l.id,
            type: l.type,
            startDate: l.startDate.toISOString(),
            endDate: l.endDate.toISOString(),
          })),
        });
      }
    }

    if (conflicts.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Conflictos de agenda detectados',
        conflicts,
      });
    }
    // ---------- FIN CONFLICTOS ----------

    // Crear tarea
    const created = await prisma.task.create({
      data: {
        name,
        taskTypeId,
        startTime: start,
        endTime: end,
        observations: observations ?? null,
        workers: { connect: workerIds.map(id => ({ id })) }, // M:N
      },
      include: {
        taskType: { select: { id: true, name: true, color: true } },
        workers: { select: { id: true, username: true } },
      },
    });

    return res.status(201).json({ success: true, task: created });
  } catch (err: any) {
    console.error('ERROR /api/tasks/create:', err);
    if (err?.code === 'P2025') {
      return res.status(400).json({ success: false, error: 'Alguno de los IDs proporcionados no existe' });
    }
    return res.status(500).json({ success: false, error: err?.message || 'Error interno' });
  }
}

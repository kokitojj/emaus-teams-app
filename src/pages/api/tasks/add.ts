// src/pages/api/tasks/create.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '@/lib/prisma';

type Body = {
  name: string;
  taskTypeId: string;
  startTime: string;      // ISO
  endTime: string;        // ISO
  observations?: string | null;
  workerIds?: string[];   // IDs de Worker a asignar (many-to-many)
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session) return res.status(401).json({ success: false, error: 'No autorizado' });

    const role = (session.user as any)?.role ?? 'empleado';
    // Solo admin o supervisor pueden crear tareas
    if (!['admin', 'supervisor'].includes(role)) {
      return res.status(403).json({ success: false, error: 'Acceso denegado' });
    }

    const { name, taskTypeId, startTime, endTime, observations, workerIds = [] } = (req.body || {}) as Body;

    // Validaciones básicas
    if (!name || !taskTypeId || !startTime || !endTime) {
      return res.status(400).json({ success: false, error: 'Faltan campos requeridos' });
    }
    const start = new Date(startTime);
    const end = new Date(endTime);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ success: false, error: 'Fechas inválidas' });
    }
    if (end <= start) {
      return res.status(400).json({ success: false, error: 'La fecha de fin debe ser posterior al inicio' });
    }

    // Verifica que el TaskType exista
    const tt = await prisma.taskType.findUnique({ where: { id: taskTypeId }, select: { id: true } });
    if (!tt) {
      return res.status(404).json({ success: false, error: 'Tipo de tarea no encontrado' });
    }

    // Crea la tarea con conexión many-to-many a Workers (si se pasan)
    const created = await prisma.task.create({
      data: {
        name,
        observations: observations ?? null,
        taskTypeId,
        startTime: start,
        endTime: end,
        // relación M:N
        workers: workerIds.length
          ? { connect: workerIds.map((id) => ({ id })) }
          : undefined,
      },
      include: {
        taskType: { select: { id: true, name: true, color: true } },
        workers:  { select: { id: true, username: true } },
      },
    });

    return res.status(201).json({ success: true, task: created });
  } catch (err: any) {
    console.error('ERROR /api/tasks/create:', err);
    // Prisma: error típico al conectar IDs inexistentes
    if (err?.code === 'P2025') {
      return res.status(400).json({ success: false, error: 'Alguno de los IDs proporcionados no existe' });
    }
    return res.status(500).json({ success: false, error: err?.message || 'Error interno' });
  }
}

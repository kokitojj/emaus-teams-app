// src/pages/api/tasks/[id].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { authenticateAndAuthorize } from '../../../utils/auth';

type WorkerDTO = { id: string; username: string };

function toDTO(task: any) {
  const workers: WorkerDTO[] = task.workers ?? [];
  return {
    id: task.id,
    title: task.name,                           // <- name -> title
    description: task.observations,             // <- observations -> description
    start: task.startTime?.toISOString?.() ?? task.startTime,
    end: task.endTime?.toISOString?.() ?? task.endTime,
    taskTypeId: task.taskTypeId ?? null,
    isCompleted: !!task.isCompleted,
    workers,
    workerIds: workers.map(w => w.id),
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query as { id: string };
  if (!id) return res.status(400).json({ message: 'Falta id.' });

  if (req.method === 'GET') {
    // cualquier rol autenticado puede ver
    const session = await authenticateAndAuthorize(req, res, ['admin', 'supervisor', 'empleado']);
    if (!session) return;

    try {
      const task = await prisma.task.findUnique({
        where: { id },
        include: { workers: { select: { id: true, username: true } } },
      });
      if (!task) return res.status(404).json({ message: 'Tarea no encontrada' });
      return res.status(200).json(toDTO(task));
    } catch (e: any) {
      console.error('GET /api/tasks/[id]', e);
      return res.status(500).json({ message: 'Error interno', detail: e?.message });
    }
  }

  if (req.method === 'PATCH') {
    // solo admin/supervisor pueden editar
    const session = await authenticateAndAuthorize(req, res, ['admin', 'supervisor']);
    if (!session) return;

    try {
      const body = req.body ?? {};

      // Acepta tanto los nombres del front como los del modelo
      const title: string | undefined = body.title ?? body.name;
      const description: string | null | undefined = (body.description ?? body.observations) ?? undefined;
      const startStr: string | undefined = body.start ?? body.startTime;
      const endStr: string | undefined = body.end ?? body.endTime;
      const taskTypeId: string | null | undefined = body.taskTypeId ?? undefined;
      const isCompleted: boolean | undefined = typeof body.isCompleted === 'boolean' ? body.isCompleted : undefined;
      const workerIds: string[] | undefined = Array.isArray(body.workerIds) ? body.workerIds : undefined;

      const data: any = {};
      if (typeof title === 'string') data.name = title;
      if (typeof description !== 'undefined') data.observations = description;
      if (typeof startStr === 'string') data.startTime = new Date(startStr);
      if (typeof endStr === 'string') data.endTime = new Date(endStr);
      if (typeof taskTypeId !== 'undefined') data.taskTypeId = taskTypeId;
      if (typeof isCompleted === 'boolean') data.isCompleted = isCompleted;
      if (workerIds) {
        data.workers = { set: workerIds.map((wid) => ({ id: wid })) }; // reemplaza M:N
      }

      const updated = await prisma.task.update({
        where: { id },
        data,
        include: { workers: { select: { id: true, username: true } } },
      });

      return res.status(200).json(toDTO(updated));
    } catch (e: any) {
      console.error('PATCH /api/tasks/[id]', e);
      return res.status(500).json({ message: 'Error interno', detail: e?.message });
    }
  }

  return res.status(405).json({ message: 'Método no permitido' });
}

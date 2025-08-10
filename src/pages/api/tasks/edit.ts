// src/pages/api/tasks/edit.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, Prisma } from '@prisma/client';
import { authenticateAndAuthorize } from '@/utils/auth';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await authenticateAndAuthorize(req, res, ['admin', 'supervisor']);
  if (!session) return;

  if (req.method !== 'PUT') {
    return res.status(405).json({ message: 'Método no permitido. Solo se acepta PUT.' });
  }

  const { id, name, isCompleted, startTime, endTime, observations, taskTypeId, workerIds } = req.body;

  if (!id || !name || !startTime || !endTime || !taskTypeId || !workerIds) {
    return res.status(400).json({ message: 'Todos los campos son obligatorios.' });
  }

  try {
    const updatedTask = await prisma.task.update({
      where: { id: id as string },
      data: {
        name,
        isCompleted,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        observations,
        taskTypeId,
        workers: {
          set: workerIds.map((workerId: string) => ({ id: workerId })),
        },
      },
    });

    res.status(200).json(updatedTask);
  } catch (error) {
    console.error('Error al editar tarea:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return res.status(404).json({ message: 'Tarea no encontrada.' });
    }
    return res.status(500).json({ message: 'Error interno del servidor.' });
  } finally {
    await prisma.$disconnect();
  }
}
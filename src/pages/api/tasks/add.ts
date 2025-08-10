// src/pages/api/tasks/add.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { authenticateAndAuthorize } from '../../../utils/auth';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await authenticateAndAuthorize(req, res, ['admin', 'supervisor']);
  if (!session) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método no permitido. Solo se acepta POST.' });
  }

  const { name, startTime, endTime, observations, taskTypeId, workerIds } = req.body;

  if (!name || !startTime || !endTime || !taskTypeId || !workerIds || workerIds.length === 0) {
    return res.status(400).json({ message: 'Todos los campos son obligatorios.' });
  }

  try {
    const newTask = await prisma.task.create({
      data: {
        name,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        observations,
        taskTypeId,
        workers: {
          connect: workerIds.map((id: string) => ({ id })),
        },
      },
    });

    res.status(201).json(newTask);
  } catch (error) {
    console.error('Error al añadir tarea:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  } finally {
    await prisma.$disconnect();
  }
}
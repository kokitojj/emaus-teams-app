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

  const { name, assignedWorkerId, taskTypeId } = req.body;

  if (!name || !assignedWorkerId || !taskTypeId) {
    return res.status(400).json({ message: 'Nombre, trabajador y tipo de tarea son obligatorios.' });
  }

  try {
    const newTask = await prisma.task.create({
      data: {
        name,
        assignedWorkerId,
        taskTypeId,
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
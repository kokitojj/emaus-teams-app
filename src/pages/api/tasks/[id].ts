// src/pages/api/tasks/[id].ts

import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { authenticateAndAuthorize } from '../../../utils/auth';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await authenticateAndAuthorize(req, res, ['admin', 'supervisor']);
  if (!session) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método no permitido. Solo se acepta GET.' });
  }

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ message: 'El ID de la tarea es obligatorio.' });
  }

  try {
    const task = await prisma.task.findUnique({
      where: { id: id as string },
      include: {
        taskType: true,
        workers: true,
      },
    });

    if (!task) {
      return res.status(404).json({ message: 'Tarea no encontrada.' });
    }

    res.status(200).json(task);
  } catch (error) {
    console.error('Error al obtener la tarea:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  } finally {
    await prisma.$disconnect();
  }
}
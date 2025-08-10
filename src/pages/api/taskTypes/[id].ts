// src/pages/api/taskTypes/[id].ts

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
    return res.status(400).json({ message: 'El ID del tipo de tarea es obligatorio.' });
  }

  try {
    const taskType = await prisma.taskType.findUnique({
      where: { id: id as string },
      include: {
        qualifiedWorkers: true,
      },
    });

    if (!taskType) {
      return res.status(404).json({ message: 'Tipo de tarea no encontrado.' });
    }

    res.status(200).json(taskType);
  } catch (error) {
    console.error('Error al obtener el tipo de tarea:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  } finally {
    await prisma.$disconnect();
  }
}
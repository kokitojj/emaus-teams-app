// src/pages/api/taskTypes/index.ts

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

  try {
    const taskTypes = await prisma.taskType.findMany({
      include: {
        qualifiedWorkers: true, // Incluimos los trabajadores que pueden realizar este tipo de tarea
      },
      orderBy: {
        name: 'asc',
      },
    });

    res.status(200).json(taskTypes);
  } catch (error) {
    console.error('Error al obtener los tipos de tareas:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  } finally {
    await prisma.$disconnect();
  }
}
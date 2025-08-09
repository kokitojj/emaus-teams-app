// src/pages/api/tasks/index.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { authenticateAndAuthorize } from '../../../utils/auth';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await authenticateAndAuthorize(req, res);
  if (!session) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método no permitido. Solo se acepta GET.' });
  }

  const userRole = session.user.role as string;
  const userId = session.user.id as string;
  
  let tasks;

  try {
    if (userRole === 'empleado') {
      // Los trabajadores solo pueden ver sus propias tareas
      tasks = await prisma.task.findMany({
        where: { assignedWorkerId: userId },
        include: {
          assignedWorker: true,
          taskType: true,
        },
        orderBy: {
          id: 'asc',
        },
      });
    } else {
      // Admins y Supervisores ven todas las tareas
      tasks = await prisma.task.findMany({
        include: {
          assignedWorker: true,
          taskType: true,
        },
        orderBy: {
          id: 'asc',
        },
      });
    }

    res.status(200).json(tasks);
  } catch (error) {
    console.error('Error al obtener las tareas:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  } finally {
    await prisma.$disconnect();
  }
}
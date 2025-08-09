// src/pages/api/tasks/edit.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { authenticateAndAuthorize } from '../../../utils/auth';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Solo administradores y supervisores pueden editar tareas
  const session = await authenticateAndAuthorize(req, res, ['admin', 'supervisor']);
  if (!session) return;

  if (req.method !== 'PUT') {
    return res.status(405).json({ message: 'Método no permitido. Solo se acepta PUT.' });
  }

  const { id, name, assignedWorkerId, taskTypeId, isCompleted } = req.body;

  if (!id || !name || !assignedWorkerId || !taskTypeId) {
    return res.status(400).json({ message: 'ID, nombre, trabajador y tipo de tarea son obligatorios.' });
  }

  try {
    const updatedTask = await prisma.task.update({
      where: { id: id as string },
      data: {
        name,
        assignedWorkerId,
        taskTypeId,
        isCompleted,
      },
    });

    res.status(200).json(updatedTask);
  } catch (error: any) {
    console.error('Error al editar tarea:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Tarea no encontrada.' });
    }
    res.status(500).json({ message: 'Error interno del servidor.' });
  } finally {
    await prisma.$disconnect();
  }
}
// src/pages/api/tasks/delete.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { authenticateAndAuthorize } from '../../../utils/auth';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Solo administradores y supervisores pueden eliminar tareas
  const session = await authenticateAndAuthorize(req, res, ['admin', 'supervisor']);
  if (!session) return;

  if (req.method !== 'DELETE') {
    return res.status(405).json({ message: 'Método no permitido. Solo se acepta DELETE.' });
  }

  const { id } = req.body;

  if (!id) {
    return res.status(400).json({ message: 'El ID de la tarea es obligatorio.' });
  }

  try {
    const deletedTask = await prisma.task.delete({
      where: { id: id as string },
    });

    res.status(200).json({ message: `Tarea con ID ${deletedTask.id} eliminada.` });
  } catch (error: any) {
    console.error('Error al eliminar tarea:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Tarea no encontrada.' });
    }
    res.status(500).json({ message: 'Error interno del servidor.' });
  } finally {
    await prisma.$disconnect();
  }
}
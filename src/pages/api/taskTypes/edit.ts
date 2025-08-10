// src/pages/api/taskTypes/edit.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { authenticateAndAuthorize } from '../../../utils/auth';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await authenticateAndAuthorize(req, res, ['admin', 'supervisor']);
  if (!session) return;

  if (req.method !== 'PUT') {
    return res.status(405).json({ message: 'Método no permitido. Solo se acepta PUT.' });
  }

  const { id, name, qualifiedWorkerIds } = req.body;

  if (!id || !name) {
    return res.status(400).json({ message: 'ID y nombre son obligatorios.' });
  }

  try {
    const updatedTaskType = await prisma.taskType.update({
      where: { id: id as string },
      data: {
        name,
        qualifiedWorkers: {
          set: qualifiedWorkerIds.map((workerId: string) => ({ id: workerId })),
        },
      },
    });

    res.status(200).json(updatedTaskType);
  } catch (error: any) {
    console.error('Error al editar tipo de tarea:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Tipo de tarea no encontrado.' });
    }
    if (error.code === 'P2002') {
      return res.status(409).json({ message: 'Ya existe un tipo de tarea con este nombre.' });
    }
    res.status(500).json({ message: 'Error interno del servidor.' });
  } finally {
    await prisma.$disconnect();
  }
}
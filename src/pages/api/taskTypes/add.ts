// src/pages/api/taskTypes/add.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, Prisma } from '@prisma/client';
import { authenticateAndAuthorize } from '@/utils/auth';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await authenticateAndAuthorize(req, res, ['admin', 'supervisor']);
  if (!session) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método no permitido. Solo se acepta POST.' });
  }

  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ message: 'El nombre del tipo de tarea es obligatorio.' });
  }

  try {
    const newTaskType = await prisma.taskType.create({
      data: {
        name,
      },
    });

    res.status(201).json(newTaskType);
  } catch (error) {
    console.error('Error al añadir tipo de tarea:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(409).json({ message: 'Ya existe un tipo de tarea con este nombre.' });
    }
    return res.status(500).json({ message: 'Error interno del servidor.' });
  } finally {
    await prisma.$disconnect();
  }
}
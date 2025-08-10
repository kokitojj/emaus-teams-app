// src/pages/api/deleteWorker.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, Prisma } from '@prisma/client';
import { authenticateAndAuthorize } from '@/utils/auth';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await authenticateAndAuthorize(req, res, ['admin']);
  if (!session) return;

  if (req.method !== 'DELETE') {
    return res.status(405).json({ message: 'Método no permitido. Solo se acepta DELETE.' });
  }

  const { id } = req.body;

  if (!id) {
    return res.status(400).json({ message: 'El ID del trabajador es obligatorio.' });
  }

  try {
    const deletedWorker = await prisma.worker.delete({
      where: { id: id as string },
    });

    res.status(200).json({ message: `Trabajador con ID ${deletedWorker.id} eliminado.` });
  } catch (error) {
    console.error('Error al eliminar trabajador:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return res.status(404).json({ message: 'Trabajador no encontrado.' });
    }
    return res.status(500).json({ message: 'Error interno del servidor.' });
  } finally {
    await prisma.$disconnect();
  }
}
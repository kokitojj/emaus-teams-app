// src/pages/api/deleteWorker.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { authenticateAndAuthorize } from '../../utils/auth';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Solo los administradores pueden eliminar trabajadores
  const session = await authenticateAndAuthorize(req, res, ['admin']);
  if (!session) return;
  
  if (req.method !== 'DELETE') {
    return res.status(405).json({ message: 'Método no permitido.' });
  }

  // Obtenemos el ID del trabajador del cuerpo de la petición
  const { id } = req.body;

  if (!id) {
    return res.status(400).json({ message: 'El ID del trabajador es obligatorio.' });
  }

  try {
    // Usamos Prisma para eliminar el trabajador por su ID
    const deletedWorker = await prisma.worker.delete({
      where: {
        id: id as string,
      },
    });

    // Si la eliminación fue exitosa, devolvemos un mensaje de éxito.
    res.status(200).json({ message: `Trabajador con ID ${deletedWorker.id} eliminado.` });
  } catch (error: any) {
    console.error('Error al eliminar trabajador:', error);

    // Si el trabajador no se encuentra, Prisma devolverá un error específico
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Trabajador no encontrado.' });
    }

    return res.status(500).json({ message: 'Error interno del servidor.' });
  } finally {
    await prisma.$disconnect();
  }
}
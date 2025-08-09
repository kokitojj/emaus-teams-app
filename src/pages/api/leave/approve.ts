// src/pages/api/leave/approve.ts

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

  const { id, status } = req.body;

  if (!id || !status) {
    return res.status(400).json({ message: 'El ID y el estado son obligatorios.' });
  }

  if (status !== 'aprobado' && status !== 'rechazado') {
    return res.status(400).json({ message: 'El estado debe ser "aprobado" o "rechazado".' });
  }

  try {
    const request = await prisma.leaveRequest.findUnique({
      where: { id: id as string },
    });

    if (!request) {
      return res.status(404).json({ message: 'Solicitud no encontrada.' });
    }

    const updatedRequest = await prisma.leaveRequest.update({
      where: { id: id as string },
      data: {
        status,
        supervisorId: session.user.id as string,
      },
    });

    // === Lógica nueva: actualizar el estado del trabajador si la solicitud es aprobada ===
    if (status === 'aprobado') {
      const newWorkerStatus = request.type === 'vacaciones' ? 'vacaciones' : 'permiso';

      await prisma.worker.update({
        where: { id: request.workerId },
        data: { status: newWorkerStatus },
      });
    }

    res.status(200).json(updatedRequest);
  } catch (error) {
    console.error('Error al actualizar solicitud:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Solicitud no encontrada.' });
    }
    res.status(500).json({ message: 'Error interno del servidor.' });
  } finally {
    await prisma.$disconnect();
  }
}
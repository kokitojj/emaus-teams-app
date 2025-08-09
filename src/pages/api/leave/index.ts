// src/pages/api/leave/index.ts

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

  const workerId = session.user.id as string;
  const userRole = session.user.role as string;
  
  let requests;
  
  try {
    if (userRole === 'empleado') {
      // Los trabajadores solo pueden ver sus propias solicitudes
      requests = await prisma.leaveRequest.findMany({
        where: { workerId },
        include: { worker: true },
        orderBy: { startDate: 'desc' },
      });
    } else {
      // Admins y Supervisores ven todas las solicitudes
      requests = await prisma.leaveRequest.findMany({
        include: { worker: true },
        orderBy: { startDate: 'desc' },
      });
    }

    res.status(200).json(requests);
  } catch (error) {
    console.error('Error al obtener solicitudes:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  } finally {
    await prisma.$disconnect();
  }
}
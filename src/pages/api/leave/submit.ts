// src/pages/api/leave/submit.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { authenticateAndAuthorize } from '../../../utils/auth';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Solo los usuarios autenticados pueden enviar solicitudes
  const session = await authenticateAndAuthorize(req, res);
  if (!session) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método no permitido. Solo se acepta POST.' });
  }

  const { type, startDate, endDate, reason } = req.body;
  const workerId = session.user.id as string;

  if (!type || !startDate || !endDate) {
    return res.status(400).json({ message: 'El tipo, fecha de inicio y fin son obligatorios.' });
  }

  try {
    const newRequest = await prisma.leaveRequest.create({
      data: {
        type,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        reason,
        workerId,
        status: 'pendiente',
      },
    });

    res.status(201).json(newRequest);
  } catch (error) {
    console.error('Error al enviar solicitud:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  } finally {
    await prisma.$disconnect();
  }
}
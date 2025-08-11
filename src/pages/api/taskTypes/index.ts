// src/pages/api/taskTypes/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { authenticateAndAuthorize } from '../../../utils/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await authenticateAndAuthorize(req, res, ['admin', 'supervisor']);
  if (!session) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método no permitido. Solo GET.' });
  }

  try {
    const taskTypes = await prisma.taskType.findMany({
      select: {
        id: true,
        name: true,
        color: true,
        // ⬇⬇ devolvemos los trabajadores calificados para que el front cuente
        qualifiedWorkers: {
          select: { id: true, username: true },
        },
        // (opcional) si luego quieres pintar solo el número sin traer la lista:
        // _count: { select: { qualifiedWorkers: true } },
      },
      orderBy: { name: 'asc' },
    });

    return res.status(200).json(taskTypes);
  } catch (e: any) {
    console.error('Error al obtener los tipos de tareas:', e);
    return res.status(500).json({ message: 'Error interno del servidor.', detail: e?.message });
  }
}

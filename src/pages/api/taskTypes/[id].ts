// src/pages/api/taskTypes/[id].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { authenticateAndAuthorize } from '../../../utils/auth';

const HEX = /^#(?:[0-9a-fA-F]{3}){1,2}$/;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query as { id: string };
  if (!id) return res.status(400).json({ message: 'Falta id.' });

  if (req.method === 'GET') {
    const session = await authenticateAndAuthorize(req, res, ['admin', 'supervisor', 'empleado']);
    if (!session) return;

    try {
      const tt = await prisma.taskType.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          color: true,
          qualifiedWorkers: { select: { id: true, username: true } },
        },
      });
      if (!tt) return res.status(404).json({ message: 'Tipo de tarea no encontrado.' });
      return res.status(200).json(tt);
    } catch (e: any) {
      console.error('GET /api/taskTypes/[id]', e);
      return res.status(500).json({ message: 'Error interno del servidor.', detail: e?.message });
    }
  }

  if (req.method === 'PATCH') {
    const session = await authenticateAndAuthorize(req, res, ['admin', 'supervisor']);
    if (!session) return;

    try {
      const { name, color, qualifiedWorkerIds } = (req.body ?? {}) as {
        name?: string;
        color?: string | null;
        qualifiedWorkerIds?: string[];
      };

      if (color && !HEX.test(color)) {
        return res.status(400).json({ message: 'Color inválido. Usa HEX (#RRGGBB).' });
      }

      const data: any = {};
      if (typeof name === 'string') data.name = name.trim();
      if (typeof color !== 'undefined') data.color = color || null;
      if (Array.isArray(qualifiedWorkerIds)) {
        data.qualifiedWorkers = { set: qualifiedWorkerIds.map((wid) => ({ id: wid })) };
      }

      const updated = await prisma.taskType.update({
        where: { id },
        data,
        select: {
          id: true,
          name: true,
          color: true,
          qualifiedWorkers: { select: { id: true, username: true } },
        },
      });

      return res.status(200).json(updated);
    } catch (e: any) {
      console.error('PATCH /api/taskTypes/[id]', e);
      return res.status(500).json({ message: 'Error interno del servidor.', detail: e?.message });
    }
  }

  return res.status(405).json({ message: 'Método no permitido. Usa GET o PATCH.' });
}

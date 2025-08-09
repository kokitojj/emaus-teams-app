// src/pages/api/workers/[id].ts

import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (typeof id !== 'string') {
    return res.status(400).json({ message: 'ID de trabajador inválido.' });
  }

  if (req.method === 'GET') {
    try {
      const worker = await prisma.worker.findUnique({
        where: {
          id: id,
        },
      });

      if (!worker) {
        return res.status(404).json({ message: 'Trabajador no encontrado.' });
      }

      return res.status(200).json(worker);
    } catch (error) {
      console.error("Error fetching worker:", error);
      return res.status(500).json({ message: 'Error interno del servidor.' });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

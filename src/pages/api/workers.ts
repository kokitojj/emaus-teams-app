// pages/api/workers.ts (Pages Router)
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { authenticateAndAuthorize } from '@/utils/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // ✅ Solo admin o supervisor
  const session = await authenticateAndAuthorize(req, res, ['admin', 'supervisor']);
  if (!session) return;

  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    const workers = await prisma.worker.findMany();
    res.status(200).json(workers);
  } catch (err: any) {
    console.error('API /workers error:', err);
    res.status(500).json({ error: 'No se pudo obtener la lista de trabajadores', detail: err?.message });
  }
}

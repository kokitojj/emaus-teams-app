import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type WorkerLite = { id: string; username: string };

type Success = { resources: { resourceId: string; resourceTitle: string }[] };
type Err = { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Success | Err>
) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ error: 'UNAUTHENTICATED' });
  const role = (session.user as any).role ?? 'empleado';
  if (!['admin', 'supervisor'].includes(role)) return res.status(403).json({ error: 'FORBIDDEN' });

  const workers = await prisma.worker.findMany({
    select: { id: true, username: true },
    orderBy: { username: 'asc' },
  });

  // ✅ tipado explícito del parámetro
  const resources = workers.map((w: WorkerLite) => ({
    resourceId: w.id,
    resourceTitle: w.username,
  }));

  return res.status(200).json({ resources });
}

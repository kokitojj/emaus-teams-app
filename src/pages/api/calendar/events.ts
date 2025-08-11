import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface CalendarEventDTO {
  id: string;
  title: string;
  start: string;        // ISO string
  end: string;          // ISO string
  resourceId?: string;
  taskTypeName?: string;
}

type Success = { events: CalendarEventDTO[] };
type Err = { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Success | Err>
) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user) return res.status(401).json({ error: 'UNAUTHENTICATED' });

    const { from, to, workerId } = req.query as {
      from?: string;
      to?: string;
      workerId?: string;
    };
    if (!from || !to) return res.status(400).json({ error: 'Missing from/to' });

    const fromDate = new Date(from);
    const toDate = new Date(to);

    const role = (session.user as any).role ?? 'empleado';
    const selfWorkerId = (session.user as any).workerId as string | undefined;
    const effectiveWorkerId = role === 'empleado' ? selfWorkerId : workerId ?? undefined;

    const tasks = await prisma.task.findMany({
      where: {
        AND: [
          { startTime: { lte: toDate } },
          { endTime: { gte: fromDate } },
          effectiveWorkerId ? { workers: { some: { id: effectiveWorkerId } } } : {},
        ],
      },
      include: { taskType: true, workers: { select: { id: true, username: true } } },
      orderBy: { startTime: 'asc' },
    });

    // Inferimos el tipo del elemento del array devuelto por findMany
    type TaskWithRelations = Awaited<typeof tasks>[number];

    const events: CalendarEventDTO[] = (tasks as TaskWithRelations[]).map((t) => ({
      id: t.id,
      title: t.name,
      start: t.startTime.toISOString(),
      end: t.endTime.toISOString(),
      resourceId: t.workers?.[0]?.id,
      taskTypeName: t.taskType?.name,
    }));
console.log('USANDO PAGES ROUTER')
    return res.status(200).json({ events });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error' });
  }
}

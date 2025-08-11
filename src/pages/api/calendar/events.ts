// src/pages/api/calendar/events.ts
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
  taskTypeId?: string | null;
  taskTypeName?: string | null;
  color?: string | null; // <- color HEX del tipo de tarea
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
      include: {
        taskType: { select: { id: true, name: true, color: true } }, // <- traemos color
        workers: { select: { id: true, username: true } },
      },
      orderBy: { startTime: 'asc' },
    });

    const events: CalendarEventDTO[] = tasks.map((t) => ({
      id: t.id,
      title: t.name,
      start: t.startTime.toISOString(),
      end: t.endTime.toISOString(),
      resourceId: t.workers?.[0]?.id,
      taskTypeId: t.taskTypeId ?? t.taskType?.id ?? null,
      taskTypeName: t.taskType?.name ?? null,
      color: t.taskType?.color ?? null, // <- color listo para el front
    }));

    
    return res.status(200).json({ events });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error' });
  }
}

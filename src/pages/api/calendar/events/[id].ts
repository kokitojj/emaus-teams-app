// pages/api/calendar/events/[id].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface EventPatchBody {
  start?: string;
  end?: string;
  workerId?: string | null;
}

interface EventPatchedDTO {
  event: {
    id: string;
    title: string;
    start: string;
    end: string;
    resourceId?: string;
    taskTypeName?: string;
  };
}

type Err = { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<EventPatchedDTO | Err>
) {
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user) return res.status(401).json({ error: 'UNAUTHENTICATED' });

    const role = (session.user as any).role ?? 'empleado';
    if (!['admin', 'supervisor'].includes(role)) {
      return res.status(403).json({ error: 'FORBIDDEN' });
    }

    const { id } = req.query as { id: string };
    const { start, end, workerId } = req.body as EventPatchBody;

    // Construimos 'data' sin pelear con los tipos generados
    const data: Record<string, any> = {};
    if (start) data.startTime = new Date(start);
    if (end) data.endTime = new Date(end);
    if (typeof workerId !== 'undefined') {
      // relación M-N: fijamos el único worker o limpiamos
      data.workers = workerId ? { set: [{ id: workerId }] } : { set: [] };
    }

    const updated = await prisma.task.update({
      where: { id },
      data,
      include: { taskType: true, workers: { select: { id: true, username: true } } },
    });

    return res.status(200).json({
      event: {
        id: updated.id,
        title: updated.name,
        start: updated.startTime.toISOString(),
        end: updated.endTime.toISOString(),
        resourceId: updated.workers?.[0]?.id ?? undefined,
        taskTypeName: updated.taskType?.name,
      },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error' });
  }
}

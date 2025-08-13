// src/lib/scheduling.ts
import { prisma } from '@/lib/prisma';

export type ConflictDetail = {
  workerId: string;
  workerName?: string | null;
  tasks: Array<{
    id: string;
    name: string;
    startTime: Date;
    endTime: Date;
    taskTypeName?: string | null;
  }>;
  leaves: Array<{
    id: string;
    type: string;
    status: string;
    startDate: Date;
    endDate: Date;
  }>;
};

export async function findWorkerConflicts(opts: {
  workerIds: string[];
  start: Date;
  end: Date;
  excludeTaskId?: string; // para updates (ignorar la propia tarea)
}) {
  const { workerIds, start, end, excludeTaskId } = opts;
  const uniqWorkers = Array.from(new Set(workerIds)).filter(Boolean);
  if (uniqWorkers.length === 0) return [] as ConflictDetail[];

  // TAREAS que se solapen: startTime <= end && endTime >= start
  const tasks = await prisma.task.findMany({
    where: {
      ...(excludeTaskId ? { id: { not: excludeTaskId } } : {}),
      startTime: { lte: end },
      endTime: { gte: start },
      workers: { some: { id: { in: uniqWorkers } } },
    },
    include: {
      taskType: { select: { name: true } },
      workers: { select: { id: true, username: true } },
    },
  });

  // LEAVES aprobadas que se solapen
  const leaves = await prisma.leaveRequest.findMany({
    where: {
      workerId: { in: uniqWorkers },
      status: 'aprobado',
      startDate: { lte: end },
      endDate: { gte: start },
    },
    select: {
      id: true, type: true, status: true, startDate: true, endDate: true,
      workerId: true,
      worker: { select: { username: true } },
    },
  });

  const byWorker: Record<string, ConflictDetail> = {};
  for (const wid of uniqWorkers) {
    byWorker[wid] = { workerId: wid, workerName: null, tasks: [], leaves: [] };
  }

  for (const t of tasks) {
    for (const w of t.workers) {
      if (!byWorker[w.id]) continue;
      byWorker[w.id].workerName = byWorker[w.id].workerName ?? w.username ?? null;
      byWorker[w.id].tasks.push({
        id: t.id,
        name: t.name,
        startTime: t.startTime,
        endTime: t.endTime,
        taskTypeName: t.taskType?.name ?? null,
      });
    }
  }

  for (const l of leaves) {
    const wid = l.workerId;
    if (!byWorker[wid]) continue;
    byWorker[wid].workerName = byWorker[wid].workerName ?? l.worker?.username ?? null;
    byWorker[wid].leaves.push({
      id: l.id,
      type: l.type,
      status: l.status,
      startDate: l.startDate,
      endDate: l.endDate,
    });
  }

  return Object.values(byWorker).filter(c => c.tasks.length > 0 || c.leaves.length > 0);
}

export function fmt(d: Date) {
  return d.toISOString().slice(0, 16).replace('T', ' ');
}

// src/pages/api/leave/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '@/lib/prisma';

type LeaveType = 'baja' | 'vacaciones' | 'permiso';
type LeaveStatus = 'pendiente' | 'aprobado' | 'rechazado';

type PostBody = {
  workerId: string;
  type: LeaveType;
  startDate: string | Date;
  endDate: string | Date;
  reason?: string | null;
  status?: LeaveStatus;        // default 'pendiente'
  force?: boolean;             // forzar creación aunque haya conflictos
  unassign?: boolean;          // si status='aprobado' y force, desasignar tareas
};

function normalizeDayRange(s: string | Date, e: string | Date) {
  const start = new Date(s);
  const end = new Date(e);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
  const dayStart = new Date(start); dayStart.setHours(0, 0, 0, 0);
  const dayEnd   = new Date(end);   dayEnd.setHours(23, 59, 59, 999);
  return { dayStart, dayEnd, start, end };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ success: false, error: 'No autorizado' });

  const role = (session.user as any)?.role ?? 'empleado';

  try {
    if (req.method === 'GET') {
      const {
        type, status, dateFrom, dateTo, sortBy = 'startDate', sortOrder = 'desc',
        page = '1', pageSize = '10'
      } = req.query as Record<string, string | undefined>;

      const where: any = {};
      if (type)   where.type   = type;
      if (status) where.status = status;

      if (dateFrom || dateTo) {
        where.AND = where.AND || [];
        if (dateFrom) where.AND.push({ endDate:   { gte: new Date(dateFrom) } });
        if (dateTo)   where.AND.push({ startDate: { lte: new Date(dateTo)   } });
      }

      const p = Math.max(1, Number(page || 1));
      const ps = Math.max(1, Number(pageSize || 10));

      const [total, requests] = await Promise.all([
        prisma.leaveRequest.count({ where }),
        prisma.leaveRequest.findMany({
          where,
          orderBy: { [sortBy as any]: sortOrder === 'asc' ? 'asc' : 'desc' },
          include: { worker: { select: { id: true, username: true, email: true } } },
          skip: (p - 1) * ps,
          take: ps,
        }),
      ]);

      return res.status(200).json({
        success: true,
        requests,
        pagination: { page: p, pageSize: ps, total, totalPages: Math.max(1, Math.ceil(total / ps)) },
      });
    }

    if (req.method === 'POST') {
      if (!['admin', 'supervisor'].includes(role)) {
        return res.status(403).json({ success: false, error: 'Acceso denegado' });
      }

      const { workerId, type, startDate, endDate, reason, status = 'pendiente', force, unassign } =
        (req.body || {}) as PostBody;

      if (!workerId || !type || !startDate || !endDate) {
        return res.status(400).json({ success: false, error: 'Faltan parámetros requeridos' });
      }

      const rng = normalizeDayRange(startDate, endDate);
      if (!rng) return res.status(400).json({ success: false, error: 'Fechas inválidas' });
      const { dayStart, dayEnd, start, end } = rng;
      if (!(end >= start)) return res.status(400).json({ success: false, error: 'endDate debe ser ≥ startDate' });

      // Conflictos si status !== 'rechazado'
      let conflictsTasks: Array<{
        id: string; name: string; startTime: Date; endTime: Date; taskType?: { name?: string | null };
      }> = [];

      if (status !== 'rechazado') {
        conflictsTasks = await prisma.task.findMany({
          where: {
            startTime: { lt: dayEnd },
            endTime:   { gt: dayStart },
            workers:   { some: { id: workerId } },
          },
          select: {
            id: true, name: true, startTime: true, endTime: true,
            taskType: { select: { name: true } },
          },
          orderBy: { startTime: 'asc' },
        });

        if (conflictsTasks.length > 0 && !force) {
          const workerName =
            (await prisma.worker.findUnique({ where: { id: workerId }, select: { username: true } }))?.username ||
            workerId;

          return res.status(409).json({
            success: false,
            error:
              status === 'aprobado'
                ? 'Existen tareas que se solapan. Confirma si deseas crearla aprobada y desasignar.'
                : 'Existen tareas que se solapan. ¿Deseas crearla igualmente como Pendiente?',
            conflicts: [
              {
                workerId,
                workerName,
                tasks: conflictsTasks.map((t) => ({
                  id: t.id,
                  name: t.name,
                  taskTypeName: t.taskType?.name || undefined,
                  startTime: t.startTime.toISOString(),
                  endTime: t.endTime.toISOString(),
                })),
              },
            ],
          });
        }
      }

      // —— Sin conflictos o con force —— //
      if (status === 'aprobado') {
        // Si aprobada y force+unassign => desasigna + crea aprobada (transacción)
        const result = await prisma.$transaction(async (tx) => {
          let unassigned = 0;

          if (conflictsTasks.length > 0 && force && unassign) {
            for (const t of conflictsTasks) {
              const connected = await tx.task.findFirst({
                where: { id: t.id, workers: { some: { id: workerId } } },
                select: { id: true },
              });
              if (connected) {
                await tx.task.update({
                  where: { id: t.id },
                  data: { workers: { disconnect: { id: workerId } } },
                });
                unassigned++;
              }
            }
          }

          const created = await tx.leaveRequest.create({
            data: {
              workerId,
              type,
              startDate: start,
              endDate: end,
              reason: reason ?? null,
              status: 'aprobado',
              reviewedAt: new Date(),
              reviewedBy: (session.user as any)?.id ?? null,
            },
            include: { worker: { select: { id: true, username: true, email: true } } },
          });

          return { created, unassigned };
        });

        return res.status(201).json({ success: true, request: result.created, unassignedTasks: result.unassigned });
      }

      // status = 'pendiente' (o explícito) → crear (si hubo conflictos, llegó con force:true)
      const created = await prisma.leaveRequest.create({
        data: {
          workerId,
          type,
          startDate: start,
          endDate: end,
          reason: reason ?? null,
          status: 'pendiente',
        },
        include: { worker: { select: { id: true, username: true, email: true } } },
      });

      return res.status(201).json({ success: true, request: created });
    }

    if (req.method === 'DELETE') {
      if (!['admin', 'supervisor'].includes(role)) {
        return res.status(403).json({ success: false, error: 'Acceso denegado' });
      }
      const id = (req.query?.id as string) || '';
      if (!id) return res.status(400).json({ success: false, error: 'Falta id' });

      await prisma.leaveRequest.delete({ where: { id } });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (e: any) {
    console.error('ERROR /api/leave:', e);
    return res.status(500).json({ success: false, error: e?.message || 'Error interno' });
  }
}

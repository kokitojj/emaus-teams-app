import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '@/lib/prisma';

type Body = {
  id: string;
  status: 'aprobado' | 'rechazado';
  managerNote?: string | null;
  force?: boolean;
  unassign?: boolean;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session) return res.status(401).json({ success: false, error: 'No autorizado' });
    const role = (session.user as any)?.role ?? '';
    if (!['admin', 'supervisor'].includes(role)) {
      return res.status(403).json({ success: false, error: 'Acceso denegado' });
    }

    const { id, status, managerNote, force, unassign }: Body = (req.body || {}) as any;
    if (!id || !status) return res.status(400).json({ success: false, error: 'Faltan parámetros' });

    const leave = await prisma.leaveRequest.findUnique({
      where: { id },
      include: { worker: { select: { id: true, username: true } } },
    });
    if (!leave) return res.status(404).json({ success: false, error: 'Solicitud no encontrada' });

    // Si no se aprueba, solo actualizamos el estado sin chequear conflictos
    if (status !== 'aprobado') {
      const updated = await prisma.leaveRequest.update({
        where: { id },
        data: {
          status,
          managerNote: managerNote ?? null,
          reviewedAt: new Date(),
          reviewedBy: (session.user as any)?.id ?? null,
        },
      });
      return res.status(200).json({ success: true, request: updated });
    }

    // Normaliza a día completo
    const dayStart = new Date(leave.startDate); dayStart.setHours(0, 0, 0, 0);
    const dayEnd   = new Date(leave.endDate);   dayEnd.setHours(23, 59, 59, 999);

    // Busca tareas solapadas
    const conflictsTasks = await prisma.task.findMany({
      where: {
        startTime: { lt: dayEnd },
        endTime:   { gt: dayStart },
        workers:   { some: { id: leave.workerId } },
      },
      select: {
        id: true, name: true, startTime: true, endTime: true,
        taskType: { select: { name: true } },
      },
      orderBy: { startTime: 'asc' },
    });

    if (conflictsTasks.length > 0 && !force) {
      return res.status(409).json({
        success: false,
        error: 'Existen tareas que se solapan con la ausencia. Confirma si deseas aprobar y desasignar.',
        conflicts: [{
          workerId: leave.workerId,
          workerName: leave.worker?.username || leave.workerId,
          tasks: conflictsTasks.map(t => ({
            id: t.id,
            name: t.name,
            taskTypeName: t.taskType?.name || undefined,
            startTime: t.startTime.toISOString(),
            endTime: t.endTime.toISOString(),
          })),
        }],
      });
    }

    // Transacción: desasignar (opcional) + aprobar
    const result = await prisma.$transaction(async (tx) => {
      let unassigned = 0;

      if (conflictsTasks.length > 0 && force && unassign) {
        // desconectar al worker de todas las tareas solapadas
        for (const t of conflictsTasks) {
          // Antes de desconectar, verificamos que está conectado (evita no-ops silenciosos)
          const connected = await tx.task.findFirst({
            where: { id: t.id, workers: { some: { id: leave.workerId } } },
            select: { id: true },
          });
          if (connected) {
            await tx.task.update({
              where: { id: t.id },
              data: { workers: { disconnect: { id: leave.workerId } } },
            });
            unassigned++;
          }
        }
      }

      const updated = await tx.leaveRequest.update({
        where: { id },
        data: {
          status: 'aprobado',
          managerNote: managerNote ?? null,
          reviewedAt: new Date(),
          reviewedBy: (session.user as any)?.id ?? null,
        },
      });

      return { updated, unassigned };
    });

    return res.status(200).json({
      success: true,
      request: result.updated,
      unassignedTasks: result.unassigned,
    });
  } catch (err: any) {
    console.error('ERROR /api/leave/approve:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Error interno' });
  }
}

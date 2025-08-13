import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';
import { prisma } from '@/lib/prisma';

type LeaveType = 'baja' | 'vacaciones' | 'permiso';

function fmt(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ success: false, error: 'No autorizado' });

  const role = (session.user as any)?.role ?? '';
  if (!['admin', 'supervisor'].includes(role)) {
    return res.status(403).json({ success: false, error: 'Acceso denegado' });
  }

  try {
    const { workerId, type = 'baja', startDate, endDate, reason = '', status = 'aprobado' } = req.body || {};
    if (!workerId || !startDate || !endDate) {
      return res.status(400).json({ success: false, error: 'Faltan campos: workerId, startDate, endDate' });
    }
    if (!['baja', 'vacaciones', 'permiso'].includes(type)) {
      return res.status(400).json({ success: false, error: 'Tipo inválido' });
    }
    if (!['pendiente', 'aprobado', 'rechazado'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Estado inválido' });
    }

    const s = new Date(startDate);
    const e = new Date(endDate);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) {
      return res.status(400).json({ success: false, error: 'Fechas inválidas' });
    }
    if (s > e) {
      return res.status(400).json({ success: false, error: 'La fecha de inicio no puede ser posterior a la de fin' });
    }

    const worker = await prisma.worker.findUnique({ where: { id: workerId }, select: { id: true, username: true } });
    if (!worker) return res.status(404).json({ success: false, error: 'Trabajador no encontrado' });

    // ⛔ Bloqueo de solapes: NO permitir crear si ya hay pendiente o aprobada que se solape.
    const conflicting = await prisma.leaveRequest.findFirst({
      where: {
        workerId: workerId,
        status: { in: ['pendiente', 'aprobado'] },
        startDate: { lte: e },
        endDate: { gte: s },
      },
      select: { id: true, type: true, status: true, startDate: true, endDate: true },
    });

    if (conflicting) {
      return res.status(409).json({
        success: false,
        error:
          `Conflicto: existe una ${conflicting.type} (${conflicting.status}) del ${fmt(conflicting.startDate)} ` +
          `al ${fmt(conflicting.endDate)} para ${worker.username}. Las ausencias son incompatibles entre sí.`,
        conflict: conflicting,
      });
    }

    const created = await prisma.leaveRequest.create({
      data: {
        type: type as LeaveType,
        startDate: s,
        endDate: e,
        reason,
        status, // admin/supervisor puede fijar estado
        workerId,
        supervisorId: (session.user as any)?.id ?? null,
        managerNote: `Creado por ${role}`,
        reviewedAt: status !== 'pendiente' ? new Date() : null,
        reviewedBy: status !== 'pendiente' ? ((session.user as any)?.id ?? null) : null,
      },
      select: { id: true, type: true, startDate: true, endDate: true, status: true },
    });

    return res.status(201).json({ success: true, request: created });
  } catch (e: any) {
    console.error('ERROR /api/leave/admin/create:', e);
    return res.status(500).json({ success: false, error: e?.message || 'Error interno' });
  }
}

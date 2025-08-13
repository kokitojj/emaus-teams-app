import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
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

  try {
    const { type, startDate, endDate, reason } = req.body || {};
    if (!type || !startDate || !endDate) {
      return res.status(400).json({ success: false, error: 'Faltan campos: type, startDate, endDate' });
    }
    if (!['baja', 'vacaciones', 'permiso'].includes(type)) {
      return res.status(400).json({ success: false, error: 'Tipo inválido' });
    }

    const s = new Date(startDate);
    const e = new Date(endDate);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) {
      return res.status(400).json({ success: false, error: 'Fechas inválidas' });
    }
    if (s > e) {
      return res.status(400).json({ success: false, error: 'La fecha de inicio no puede ser posterior a la de fin' });
    }

    // Resolver Worker de la sesión (id || email || username)
    const u = session.user as any;
    const me = await prisma.worker.findFirst({
      where: {
        OR: [
          u?.workerId ? { id: u.workerId } : undefined,
          u?.id ? { id: u.id } : undefined,
          u?.email ? { email: u.email } : undefined,
          u?.username ? { username: u.username } : undefined,
        ].filter(Boolean) as any[],
      },
      select: { id: true, username: true },
    });
    if (!me?.id) return res.status(404).json({ success: false, error: 'No se encontró el trabajador de la sesión' });

    // ⛔ Bloqueo de solapes/incompatibilidades al CREAR (pendiente o aprobado):
    // Si existe CUALQUIER solicitud pendiente o aprobada que se solape para ese trabajador, no permitimos crear.
    const conflicting = await prisma.leaveRequest.findFirst({
      where: {
        workerId: me.id,
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
          `Ya existe una ${conflicting.type} (${conflicting.status}) del ${fmt(conflicting.startDate)} ` +
          `al ${fmt(conflicting.endDate)} para este trabajador. Las ausencias son incompatibles entre sí.`,
        conflict: conflicting,
      });
    }

    const created = await prisma.leaveRequest.create({
      data: {
        type: type as LeaveType,
        startDate: s,
        endDate: e,
        reason: reason ?? null,
        status: 'pendiente', // siempre pendiente cuando la crea el empleado
        workerId: me.id,
      },
      select: { id: true, type: true, startDate: true, endDate: true, status: true },
    });

    return res.status(201).json({ success: true, request: created });
  } catch (e: any) {
    console.error('ERROR /api/leave/create:', e);
    return res.status(500).json({ success: false, error: e?.message || 'Error interno' });
  }
}

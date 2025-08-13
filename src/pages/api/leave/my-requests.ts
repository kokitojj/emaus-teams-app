import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ success: false, error: 'No autorizado' });
  }

  try {
    const role = (session.user as any)?.role ?? 'empleado';
    const qWorkerId = (req.query.workerId as string | undefined) || undefined;

    // Campos que podemos tener en la sesión
    const sessionUserId = (session.user as any)?.id as string | undefined;
    const sessionWorkerId = (session.user as any)?.workerId as string | undefined; // por si lo guardaste así
    const sessionEmail = (session.user as any)?.email as string | undefined;
    const sessionUsername = (session.user as any)?.username as string | undefined;

    // Si es admin/supervisor y se pasa ?workerId=..., lo usamos directamente
    let targetWorkerId: string | undefined = (role !== 'empleado') ? (qWorkerId || sessionWorkerId || sessionUserId) : undefined;

    // Resolver el Worker asociado a la sesión si aún no lo tenemos
    if (!targetWorkerId) {
      const me = await prisma.worker.findFirst({
        where: {
          OR: [
            sessionWorkerId ? { id: sessionWorkerId } : undefined,
            sessionUserId ? { id: sessionUserId } : undefined,
            sessionEmail ? { email: sessionEmail } : undefined,
            sessionUsername ? { username: sessionUsername } : undefined,
          ].filter(Boolean) as any[],
        },
        select: { id: true },
      });
      targetWorkerId = me?.id;
    }

    if (!targetWorkerId) {
      return res.status(404).json({ success: false, error: 'No se encontró el trabajador de la sesión' });
    }

    const requests = await prisma.leaveRequest.findMany({
      where: { workerId: targetWorkerId },
      orderBy: [{ startDate: 'desc' }],
      select: {
        id: true,
        type: true,
        startDate: true,
        endDate: true,
        reason: true,
        status: true,
        managerNote: true,
        reviewedAt: true,
      },
    });

    return res.status(200).json({ success: true, count: requests.length, requests });
  } catch (e: any) {
    console.error('ERROR /api/leave/my-requests:', e);
    return res.status(500).json({ success: false, error: e?.message || 'Error interno' });
  }
}

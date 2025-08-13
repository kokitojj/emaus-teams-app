import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ success: false, error: 'No autorizado' });

  const role = (session.user as any)?.role ?? 'empleado';

  // Aceptar id por query o por body (flexible para frontends)
  const id = (req.query?.id as string) || (req.body?.id as string);
  if (!id) return res.status(400).json({ success: false, error: 'Falta el id de la solicitud' });

  try {
    const target = await prisma.leaveRequest.findUnique({
      where: { id },
      select: { id: true, workerId: true, status: true },
    });
    if (!target) return res.status(404).json({ success: false, error: 'Solicitud no encontrada' });

    // Resolver worker del usuario actual por si es empleado
    const sessionUserId = (session.user as any)?.id as string | undefined;
    const sessionEmail = (session.user as any)?.email as string | undefined;
    const sessionUsername = (session.user as any)?.username as string | undefined;

    let meWorkerId: string | undefined = undefined;
    try {
      const me = await prisma.worker.findFirst({
        where: {
          OR: [
            sessionUserId ? { id: sessionUserId } : undefined,
            sessionEmail ? { email: sessionEmail } : undefined,
            sessionUsername ? { username: sessionUsername } : undefined,
          ].filter(Boolean) as any[],
        },
        select: { id: true },
      });
      meWorkerId = me?.id;
    } catch { /* noop */ }

    // Reglas de borrado:
    // - admin o supervisor: puede borrar cualquier solicitud
    // - empleado: sólo puede borrar sus propias solicitudes Y sólo si están 'pendiente'
    if (role === 'empleado') {
      if (!meWorkerId || target.workerId !== meWorkerId) {
        return res.status(403).json({ success: false, error: 'No puedes borrar solicitudes de otros usuarios' });
      }
      if (target.status !== 'pendiente') {
        return res.status(409).json({
          success: false,
          error: 'Sólo puedes borrar solicitudes en estado pendiente',
        });
      }
    }

    await prisma.leaveRequest.delete({ where: { id: target.id } });
    return res.status(200).json({ success: true });
  } catch (e: any) {
    console.error('ERROR /api/leave/delete:', e);
    return res.status(500).json({ success: false, error: e?.message || 'Error interno' });
  }
}

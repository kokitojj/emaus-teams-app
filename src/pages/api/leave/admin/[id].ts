import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';
import { prisma } from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query as { id: string };

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ success: false, error: 'No autorizado' });

  const role = (session.user as any)?.role ?? '';
  if (!['admin', 'supervisor'].includes(role)) {
    return res.status(403).json({ success: false, error: 'Acceso denegado' });
  }

  try {
    if (req.method === 'DELETE') {
      const exists = await prisma.leaveRequest.findUnique({ where: { id } });
      if (!exists) return res.status(404).json({ success: false, error: 'Solicitud no encontrada' });

      await prisma.leaveRequest.delete({ where: { id } });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (e: any) {
    console.error('ERROR /api/leave/admin/[id]:', e);
    return res.status(500).json({ success: false, error: e?.message || 'Error interno' });
  }
}

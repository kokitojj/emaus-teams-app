// src/utils/auth.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession, Session } from 'next-auth';
import { authOptions } from '@/pages/api/auth/[...nextauth]';

type Role = 'admin' | 'supervisor' | 'empleado';

// Helper function para verificar la sesión y el rol
export async function authenticateAndAuthorize(
  req: NextApiRequest,
  res: NextApiResponse,
  requiredRole?: Role[]
): Promise<Session | null> {
  const session = await getServerSession(req, res, authOptions);

  if (!session || !session.user || !session.user.role) {
    res.status(401).json({ message: 'No autenticado.' });
    return null;
  }

  // Si se requiere un rol y el rol del usuario no está permitido, denegamos el acceso
  if (requiredRole && !requiredRole.includes(session.user.role as Role)) {
    res.status(403).json({ message: 'No autorizado.' });
    return null;
  }

  return session;
}
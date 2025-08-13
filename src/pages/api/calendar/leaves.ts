import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '@/lib/prisma';

type LeaveType = 'baja' | 'vacaciones' | 'permiso';
type LeaveStatus = 'pendiente' | 'aprobado' | 'rechazado';

function toDateSafe(v?: string): Date | null {
  if (!v) return null;
  // Si es timestamp numérico
  if (/^\d+$/.test(v)) {
    const d = new Date(Number(v));
    return isNaN(d.getTime()) ? null : d;
  }
  // Si viene como ISO o con hora, nos quedamos con la parte de fecha
  const onlyDate = v.slice(0, 10); // YYYY-MM-DD si viene en ISO
  const d = new Date(onlyDate);
  if (!isNaN(d.getTime())) return d;

  // Último intento: parseo directo
  const d2 = new Date(v);
  return isNaN(d2.getTime()) ? null : d2;
}

function monthWindow(month?: string) {
  const now = new Date();
  let y = now.getFullYear();
  let m = now.getMonth(); // 0-11
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    y = Number(month.slice(0, 4));
    m = Number(month.slice(5, 7)) - 1;
  }
  const start = new Date(y, m, 1, 0, 0, 0, 0);
  const end = new Date(y, m + 1, 0, 23, 59, 59, 999); // fin del mes
  return { start, end };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ success: false, error: 'No autorizado' });

  try {
    const {
      start: qsStart,
      end: qsEnd,
      month,       // opcional: YYYY-MM
      type,
      status,
      workerId,
    } = req.query as Record<string, string | undefined>;

    // Determinar ventana [start, end]
    let startDate: Date | null = toDateSafe(qsStart);
    let endDate: Date | null = toDateSafe(qsEnd);

    if (!startDate || !endDate) {
      const mw = monthWindow(month);
      startDate = startDate ?? mw.start;
      endDate = endDate ?? mw.end;
    }

    // Normalizamos a límites de día
    startDate!.setHours(0, 0, 0, 0);
    endDate!.setHours(23, 59, 59, 999);

    if (startDate! > endDate!) {
      return res.status(400).json({ success: false, error: 'start debe ser anterior o igual a end' });
    }

    // Solapamiento con el rango del calendario:
    const where: any = {
      startDate: { lte: endDate },
      endDate:   { gte: startDate },
      status: (status as LeaveStatus) || 'aprobado',
      ...(type ? { type: type as LeaveType } : {}),
      ...(workerId ? { workerId } : {}),
    };

    const rows = await prisma.leaveRequest.findMany({
      where,
      orderBy: { startDate: 'asc' },
      include: {
        worker: { select: { id: true, username: true, email: true } },
      },
    });

    const colorByType: Record<string, string> = {
      baja: '#ef4444',
      vacaciones: '#10b981',
      permiso: '#6366f1',
    };

    const events = rows.map(r => ({
      id: r.id,
      title: `${r.type === 'baja' ? 'Baja' : r.type === 'vacaciones' ? 'Vacaciones' : 'Permiso'} · ${r.worker?.username ?? r.workerId}`,
      start: r.startDate,
      // muchas libs tratan end como exclusivo -> +1ms al final del día para mostrar inclusive
      end: new Date(r.endDate.getTime() + 1),
      allDay: true,
      backgroundColor: colorByType[r.type] ?? '#6b7280',
      borderColor: colorByType[r.type] ?? '#6b7280',
      extendedProps: {
        type: r.type,
        status: r.status,
        reason: r.reason,
        worker: r.worker,
        supervisorId: r.supervisorId,
        reviewedAt: r.reviewedAt,
      },
    }));

    return res.status(200).json({ success: true, events, range: { start: startDate, end: endDate } });
  } catch (e: any) {
    console.error('ERROR /api/calendar/leaves:', e);
    return res.status(500).json({ success: false, error: e?.message || 'Error interno' });
  }
}


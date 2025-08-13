import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '@/lib/prisma';

function toICSDate(d: Date) {
  // Formato básico UTC sin TZ info: YYYYMMDD
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).send('No autorizado');

  try {
    const {
      start,
      end,
      type,        // 'baja' | 'vacaciones' | 'permiso' | (omitido = todos)
      status,      // por defecto 'aprobado'
      workerId,
    } = req.query as Record<string, string | undefined>;

    const startDate = start ? new Date(start) : new Date(new Date().getFullYear(), 0, 1);
    const endDate   = end ? new Date(end)   : new Date(new Date().getFullYear(), 11, 31);

    const where: any = {
      startDate: { lte: endDate },
      endDate:   { gte: startDate },
      status: status || 'aprobado',
      ...(type ? { type } : {}),
      ...(workerId ? { workerId } : {}),
    };

    const rows = await prisma.leaveRequest.findMany({
      where,
      orderBy: { startDate: 'asc' },
      include: { worker: { select: { id: true, username: true, email: true } } },
    });

    const lines: string[] = [];
    lines.push('BEGIN:VCALENDAR');
    lines.push('VERSION:2.0');
    lines.push('PRODID:-//Emaus Teams App//Leaves//ES');

    for (const r of rows) {
      // Evento de día completo: DTSTART/DTEND como fechas (DTEND exclusivo => +1 día)
      const dtStart = toICSDate(new Date(Date.UTC(r.startDate.getFullYear(), r.startDate.getMonth(), r.startDate.getDate())));
      const endPlus = new Date(r.endDate);
      endPlus.setDate(endPlus.getDate() + 1);
      const dtEnd = toICSDate(new Date(Date.UTC(endPlus.getFullYear(), endPlus.getMonth(), endPlus.getDate())));

      const uid = `${r.id}@emaus-teams-app`;
      const summary = `${r.type === 'baja' ? 'Baja' : r.type === 'vacaciones' ? 'Vacaciones' : 'Permiso'} · ${r.worker?.username ?? r.workerId}`;
      const description = [
        `Tipo: ${r.type}`,
        `Estado: ${r.status}`,
        r.reason ? `Motivo: ${r.reason}` : '',
        r.worker?.email ? `Email: ${r.worker.email}` : '',
      ].filter(Boolean).join('\\n');

      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${uid}`);
      lines.push(`DTSTAMP:${toICSDate(new Date())}T000000Z`);
      lines.push(`DTSTART;VALUE=DATE:${dtStart}`);
      lines.push(`DTEND;VALUE=DATE:${dtEnd}`);
      lines.push(`SUMMARY:${summary}`);
      lines.push(`DESCRIPTION:${description}`);
      lines.push('END:VEVENT');
    }

    lines.push('END:VCALENDAR');

    const ics = lines.join('\r\n');

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="leaves.ics"');
    return res.status(200).send(ics);
  } catch (e: any) {
    console.error('ERROR /api/calendar/leaves.ics:', e);
    return res.status(500).send('Error interno');
  }
}

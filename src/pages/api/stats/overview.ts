// src/pages/api/stats/overview.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '@/lib/prisma';

function todayWindowEuropeMadrid() {
  const now = new Date();
  const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
  const endOfDay   = new Date(now); endOfDay.setHours(23, 59, 59, 999);
  return { now, startOfDay, endOfDay };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ success: false, error: 'No autorizado' });

  try {
    const { now, startOfDay, endOfDay } = todayWindowEuropeMadrid();

    // Activos HOY por tipo (aprobados + solapan hoy)
    const [bajasActivas, vacasActivas, permisosActivos] = await Promise.all([
      prisma.leaveRequest.findMany({
        where: { type: 'baja', status: 'aprobado', startDate: { lte: endOfDay }, endDate: { gte: startOfDay } },
        select: { workerId: true },
      }),
      prisma.leaveRequest.findMany({
        where: { type: 'vacaciones', status: 'aprobado', startDate: { lte: endOfDay }, endDate: { gte: startOfDay } },
        select: { workerId: true },
      }),
      prisma.leaveRequest.findMany({
        where: { type: 'permiso', status: 'aprobado', startDate: { lte: endOfDay }, endDate: { gte: startOfDay } },
        select: { workerId: true },
      }),
    ]);

    // Conjunto de todos los trabajadores ausentes hoy (cualquier tipo)
    const absentTodaySet = new Set<string>([
      ...bajasActivas.map(x => x.workerId),
      ...vacasActivas.map(x => x.workerId),
      ...permisosActivos.map(x => x.workerId),
    ]);

    const bajasActivasHoy = new Set(bajasActivas.map(x => x.workerId)).size;
    const vacacionesActivasHoy = new Set(vacasActivas.map(x => x.workerId)).size;
    const permisosActivosHoy = new Set(permisosActivos.map(x => x.workerId)).size;

    const totalWorkers = await prisma.worker.count();
    const activos = Math.max(totalWorkers - absentTodaySet.size, 0); // ✅ descuenta baja + vacaciones + permiso

    // Totales de BAJAS por estado (histórico)
    const [pendientes, aprobadas, rechazadas, totalBajas] = await Promise.all([
      prisma.leaveRequest.count({ where: { type: 'baja', status: 'pendiente' } }),
      prisma.leaveRequest.count({ where: { type: 'baja', status: 'aprobado' } }),
      prisma.leaveRequest.count({ where: { type: 'baja', status: 'rechazado' } }),
      prisma.leaveRequest.count({ where: { type: 'baja' } }),
    ]);

    return res.status(200).json({
      success: true,
      date: now.toISOString(),
      workers: {
        total: totalWorkers,
        activos,                 // ✅ ya descuenta bajas + vacaciones + permisos activos hoy
        ausentesHoy: absentTodaySet.size,
        detalleAusentesHoy: {
          bajas: bajasActivasHoy,
          vacaciones: vacacionesActivasHoy,
          permisos: permisosActivosHoy,
        },
      },
      bajas: {
        total: totalBajas,
        pendientes,
        aprobadas,
        rechazadas,
        activasHoy: bajasActivasHoy, // por compatibilidad con lo que tenías
      },
    });
  } catch (e: any) {
    console.error('ERROR /api/stats/overview:', e);
    return res.status(500).json({ success: false, error: e?.message || 'Error interno' });
  }
}

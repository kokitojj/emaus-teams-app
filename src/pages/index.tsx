// src/pages/index.tsx
import Head from 'next/head';
import { useSession } from 'next-auth/react';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import WeeklyCalendar from '@/components/dashboard/WeeklyCalendar';
import DashboardBajasCard from '@/components/DashboardBajasCard';

type Overview = {
  success: boolean;
  date: string;
  workers: {
    total: number;
    activos: number;
    ausentesHoy: number;
    detalleAusentesHoy: { bajas: number; vacaciones: number; permisos: number };
  };
  bajas: { total: number; pendientes: number; aprobadas: number; rechazadas: number; activasHoy: number };
};

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-gray-600">{title}</h3>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function StatSkeleton() {
  return (
    <div className="h-20 bg-white rounded-2xl shadow p-4">
      <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
      <div className="mt-3 h-6 w-16 bg-gray-200 rounded animate-pulse" />
    </div>
  );
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const loadingSession = status === 'loading';
  const role = (session?.user as any)?.role ?? 'empleado';
  const userId = (session?.user as any)?.id as string | undefined;

  // ¿El usuario puede ver estadísticas?
  const canSeeStats = useMemo(() => ['admin', 'supervisor'].includes(role), [role]);

  // Estado de stats
  const [stats, setStats] = useState<Overview | null>(null);
  const [loadingStats, setLoadingStats] = useState<boolean>(false);
  const [errStats, setErrStats] = useState<string>('');

  useEffect(() => {
    if (!canSeeStats) return; // empleados no cargan stats
    let alive = true;
    (async () => {
      try {
        setLoadingStats(true);
        setErrStats('');
        const r = await fetch('/api/stats/overview', { cache: 'no-store' });
        const j = (await r.json()) as Overview | any;
        if (!r.ok || !j?.success) throw new Error(j?.error || 'No se pudieron cargar las estadísticas');
        if (alive) setStats(j as Overview);
      } catch (e: any) {
        if (alive) setErrStats(e?.message || 'Error cargando estadísticas');
      } finally {
        if (alive) setLoadingStats(false);
      }
    })();
    return () => { alive = false; };
  }, [canSeeStats]);

  return (
    <>
      <Head>
        <title>Dashboard · Emaus Teams App</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"/>
      </Head>

      <div className="px-3 sm:px-4 md:px-6 py-4 md:py-6 space-y-4 md:space-y-6">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold leading-tight">Dashboard</h1>
            <p className="text-xs sm:text-sm text-gray-500">Resumen e itinerario semanal</p>
          </div>
          {canSeeStats && (
            <div className="flex items-center gap-2">
              <Link
                href="/admin/leave"
                className="inline-flex items-center rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
              >
                Gestionar ausencias
              </Link>
              <Link
                href="/tasks/new"
                className="inline-flex items-center rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 text-sm"
              >
                + Nueva tarea
              </Link>
            </div>
          )}
        </header>

        {/* ====== Estadísticas (solo admin/supervisor) ====== */}
        {loadingSession ? null : canSeeStats ? (
          <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {loadingStats ? (
              <>
                <StatSkeleton /><StatSkeleton /><StatSkeleton />
                <div className="bg-white rounded-2xl shadow p-4 sm:p-5"><StatSkeleton /></div>
              </>
            ) : errStats ? (
              <div className="col-span-2 sm:col-span-3 lg:col-span-4 bg-white rounded-2xl shadow p-4 text-sm text-red-600">
                {errStats}
              </div>
            ) : stats ? (
              <>
                <Card title="Trabajadores activos">
                  <p className="text-2xl sm:text-3xl font-semibold">{stats.workers.activos}</p>
                  <p className="text-xs text-gray-500">De {stats.workers.total} totales</p>
                </Card>

                <Card title="Ausentes hoy">
                  <p className="text-2xl sm:text-3xl font-semibold">{stats.workers.ausentesHoy}</p>
                  <p className="text-xs text-gray-500">
                    Bajas {stats.workers.detalleAusentesHoy.bajas} · Vac {stats.workers.detalleAusentesHoy.vacaciones} · Perm {stats.workers.detalleAusentesHoy.permisos}
                  </p>
                </Card>

                <Card title="Bajas pendientes">
                  <p className="text-2xl sm:text-3xl font-semibold">{stats.bajas.pendientes}</p>
                  <p className="text-xs text-gray-500">A la espera de revisión</p>
                </Card>

                {/* Tarjeta modular existente */}
                <DashboardBajasCard />
              </>
            ) : null}
          </section>
        ) : null}

        {/* ====== Calendario ====== */}
        <section className="bg-transparent">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm sm:text-base font-semibold text-gray-700">
              {canSeeStats ? 'Calendario semanal' : 'Mi calendario'}
            </h2>
            {canSeeStats && (
              <a
                href="/api/calendar/leaves.ics"
                className="text-xs sm:text-sm text-blue-600 underline"
                target="_blank"
                rel="noreferrer"
                title="Suscribirse (ICS) a las ausencias aprobadas"
              >
                Exportar ICS
              </a>
            )}
          </div>

          <WeeklyCalendar
            // Empleado: bloquear al propio usuario y esconder los selects (el componente ya respeta lockToWorker)
            defaultWorkerId={canSeeStats ? '' : (userId ?? '')}
            lockToWorker={!canSeeStats}
          />
        </section>
      </div>
    </>
  );
}

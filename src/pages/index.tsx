import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useSession } from 'next-auth/react';
import DashboardBajasCard from '@/components/DashboardBajasCard';
import Calendar from '@/components/dashboard/WeeklyCalendar';

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
    <div className="bg-white rounded-2xl shadow p-4">
      <h3 className="text-sm font-medium text-gray-600">{title}</h3>
      <div className="mt-2">{children}</div>
    </div>
  );
}
function SkeletonLine() { return <div className="h-8 w-24 bg-gray-200 rounded animate-pulse" />; }
function ErrorText({ msg }: { msg: string }) { return <p className="text-red-600">{msg}</p>; }

export default function Dashboard() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role ?? 'empleado';
  const userId = (session?.user as any)?.id ?? ''; // ajusta si tu sesión usa otro campo

  const [stats, setStats] = useState<Overview | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [errStats, setErrStats] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setLoadingStats(true);
        const r = await fetch('/api/stats/overview');
        const j: Overview = await r.json();
        if (!r.ok || !j.success) throw new Error((j as any)?.error || 'No se pudieron cargar las estadísticas');
        setStats(j);
      } catch (e: any) {
        setErrStats(e.message || 'Error');
      } finally {
        setLoadingStats(false);
      }
    })();
  }, []);

  const lockToWorker = role === 'empleado';

  return (
    <>
      <Head><title>Dashboard · Emaus Teams App</title></Head>

      <div className="p-6 space-y-6">
        <header>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-gray-500">Resumen de personal y ausencias</p>
        </header>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card title="Trabajadores (activos)">
            {loadingStats ? <SkeletonLine /> : errStats ? <ErrorText msg={errStats} /> : stats ? (
              <>
                <p className="text-3xl font-semibold">{stats.workers.activos}</p>
                <p className="text-xs text-gray-500">De {stats.workers.total} totales</p>
              </>
            ) : null}
          </Card>

          <Card title="Ausentes hoy">
            {loadingStats ? <SkeletonLine /> : errStats ? <ErrorText msg={errStats} /> : stats ? (
              <>
                <p className="text-3xl font-semibold">{stats.workers.ausentesHoy}</p>
                <p className="text-xs text-gray-500">
                  Bajas {stats.workers.detalleAusentesHoy.bajas} · Vac {stats.workers.detalleAusentesHoy.vacaciones} · Perm {stats.workers.detalleAusentesHoy.permisos}
                </p>
              </>
            ) : null}
          </Card>

          <Card title="Bajas pendientes">
            {loadingStats ? <SkeletonLine /> : errStats ? <ErrorText msg={errStats} /> : stats ? (
              <>
                <p className="text-3xl font-semibold">{stats.bajas.pendientes}</p>
                <p className="text-xs text-gray-500">Por revisar</p>
              </>
            ) : null}
          </Card>

          <DashboardBajasCard />
        </section>

        {/* Calendario (WeeklyCalendar se autogestiona) */}
        <section className="bg-white rounded-2xl shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Calendario</h3>
            <a href="/api/calendar/leaves.ics" className="text-blue-600 underline" target="_blank" rel="noreferrer">
              Exportar ICS
            </a>
          </div>

          <Calendar
            defaultWorkerId={String(userId)}
            lockToWorker={lockToWorker}
          />
        </section>
      </div>
    </>
  );
}

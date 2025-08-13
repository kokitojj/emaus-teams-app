import { useEffect, useState } from 'react';

type Overview = {
  success: boolean;
  workers: {
    total: number;
    activos: number;
    detalleAusentesHoy: { bajas: number; vacaciones: number; permisos: number };
  };
};

export default function DashboardBajasCard() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/stats/overview');
        const json: Overview = await res.json();
        if (!res.ok || !json.success) throw new Error((json as any)?.error || 'No se pudo cargar');
        setData(json);
      } catch (e: any) {
        setErr(e.message || 'Error');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <Card title="Bajas activas hoy"><p className="text-gray-500">Cargando…</p></Card>;
  }

  if (err || !data) {
    return <Card title="Bajas activas hoy"><p className="text-red-600">{err || 'Sin datos'}</p></Card>;
  }

  return (
    <Card title="Bajas activas hoy">
      <p className="text-3xl font-semibold">{data.workers.detalleAusentesHoy.bajas}</p>
      <p className="text-xs text-gray-500">Descontadas de los activos</p>
    </Card>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <h3 className="text-sm font-medium text-gray-600">{title}</h3>
      <div className="mt-2">{children}</div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';

type LeaveStatus = 'pendiente' | 'aprobado' | 'rechazado';
type LeaveType = 'baja' | 'vacaciones' | 'permiso';

type LeaveRequest = {
  id: string;
  type: LeaveType | string;
  startDate: string | Date;
  endDate: string | Date;
  reason?: string | null;
  status: LeaveStatus | string;
  managerNote?: string | null;
  reviewedAt?: string | null;
};

function coerceArray<T = any>(payload: any, keys: string[] = ['requests', 'data', 'items', 'rows']): T[] {
  if (Array.isArray(payload)) return payload as T[];
  for (const k of keys) {
    if (payload && Array.isArray(payload[k])) return payload[k] as T[];
  }
  if (payload && Array.isArray(payload.result)) return payload.result as T[];
  return [];
}

function fmtRange(a: string | Date, b: string | Date) {
  const s = new Date(a);
  const e = new Date(b);
  const fmt = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: '2-digit', month: '2-digit' });
  return `${fmt.format(s)} – ${fmt.format(e)}`;
}

export default function MyRequestsPage() {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      setErr('');
      const res = await fetch('/api/leave/my-requests', { cache: 'no-store' });
      const json = await res.json();

      if (!res.ok || !json?.success) {
        throw new Error(json?.error || 'No se pudieron cargar tus solicitudes');
      }

      const list = coerceArray<LeaveRequest>(json);
      const normalized = list.map((r) => ({
        ...r,
        startDate: typeof r.startDate === 'string' ? r.startDate : new Date(r.startDate).toISOString(),
        endDate: typeof r.endDate === 'string' ? r.endDate : new Date(r.endDate).toISOString(),
      }));

      setRequests(normalized);
    } catch (e: any) {
      setErr(e?.message || 'No se pudieron cargar tus solicitudes');
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <>
      <Head><title>Mis Solicitudes · Emaus Teams App</title></Head>

      <div className="p-6 space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Mis Solicitudes</h1>
            <p className="text-sm text-gray-500">Bajas, vacaciones y permisos</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={load}
              className="px-3 py-2 rounded-lg border hover:bg-gray-50"
              title="Volver a cargar"
            >
              Reintentar
            </button>
            <Link
              href="/leave/new"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow transition-colors"
            >
              + Nueva solicitud
            </Link>
          </div>
        </header>

        <div className="bg-white rounded-2xl shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fechas</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Motivo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nota del supervisor</th>
              </tr>
            </thead>

            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-6 text-sm text-gray-500">Cargando…</td></tr>
              ) : err ? (
                <tr><td colSpan={5} className="px-6 py-6 text-sm text-red-600">{err}</td></tr>
              ) : (requests && requests.length > 0) ? (
                requests.map((req) => (
                  <tr key={req.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 capitalize">
                      {req.type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {fmtRange(req.startDate, req.endDate)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {req.reason || '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span
                        className={
                          'px-2 py-1 rounded text-white text-xs ' +
                          (req.status === 'aprobado'
                            ? 'bg-green-600'
                            : req.status === 'rechazado'
                            ? 'bg-red-600'
                            : 'bg-yellow-600')
                        }
                      >
                        {req.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {req.managerNote || '—'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-sm text-gray-600">
                    No tienes solicitudes todavía.<br />
                    <Link href="/leave/new" className="mt-3 inline-flex bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg">
                      Crear solicitud
                    </Link>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

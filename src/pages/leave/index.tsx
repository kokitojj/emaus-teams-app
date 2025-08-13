import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { LeaveRequest } from '../../types';

// Convierte la respuesta en array sin importar el formato
function coerceArray<T = any>(payload: any, keys: string[] = ['requests', 'data', 'items', 'rows', 'result']): T[] {
  if (Array.isArray(payload)) return payload as T[];
  for (const k of keys) {
    if (payload && Array.isArray(payload[k])) return payload[k] as T[];
  }
  return [];
}

export default function LeaveRequestsPage() {
  const { data: session, status } = useSession();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [err, setErr] = useState('');

  const fetchRequests = async () => {
    try {
      setIsLoading(true);
      setErr('');
      const res = await fetch('/api/leave', { cache: 'no-store' });
      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(json?.error || 'Error al obtener las solicitudes.');
      // <-- Aquí la clave: forzamos array
      const list = coerceArray<LeaveRequest>(json);
      setRequests(list);
    } catch (e: any) {
      console.error('Ocurrió un error inesperado al obtener solicitudes.', e);
      setErr(e?.message || 'No se pudieron cargar las solicitudes');
      setRequests([]); // evita .map sobre undefined
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated' || session?.user?.role === 'empleado') {
      setIsLoading(false);
      return;
    }
    fetchRequests();
  }, [status, session]);

  const handleDelete = async (id: string) => {
  if (!confirm('¿Eliminar la solicitud seleccionada? Esta acción es irreversible.')) return;
  try {
    const res = await fetch(`/api/leave?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    const j = await res.json().catch(() => ({} as any));
    if (!res.ok || !j.success) throw new Error(j?.error || `HTTP ${res.status}`);
    await fetchRequests(); // recarga la tabla
  } catch (e: any) {
    alert(`Error eliminando: ${e?.message || 'desconocido'}`);
  }
};

  const handleStatusChange = async (
    id: string,
    newStatus: 'aprobado' | 'rechazado'
  ) => {
    const isConfirmed = window.confirm(
      `¿Estás seguro de que quieres ${newStatus} esta solicitud?`
    );
    if (!isConfirmed) return;

    try {
      const res = await fetch('/api/leave/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      });

      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || !data?.success) {
        const msg = data?.error || `HTTP ${res.status}`;
        throw new Error(msg);
      }

      await fetchRequests();
      alert('Solicitud actualizada correctamente');
    } catch (e: any) {
      console.error('Error al actualizar la solicitud:', e);
      alert(`Error: ${e?.message || 'desconocido'}`);
    }
  };

  if (status === 'unauthenticated' || session?.user?.role === 'empleado') {
    return (
      <p className="p-8 text-center text-xl text-red-500">Acceso denegado.</p>
    );
  }

  if (isLoading) return <p className="p-8 text-center">Cargando solicitudes...</p>;

  return (
    <>
      <Head>
        <title>Gestionar Solicitudes | Emaus Teams App</title>
      </Head>

      <div className="min-h-screen bg-gray-100 p-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">
          Solicitudes de Bajas, Permisos y Vacaciones
        </h1>

        <div className="bg-white rounded-lg shadow-md p-6">
          {err && (
            <div className="mb-4 text-sm text-red-600">
              {err}{' '}
              <button
                onClick={fetchRequests}
                className="underline text-red-700"
              >
                Reintentar
              </button>
            </div>
          )}

          {requests.length === 0 ? (
            <p className="text-gray-500 italic text-center">
              No hay solicitudes para gestionar.
            </p>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Usuario
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fechas
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="relative px-6 py-3">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {requests.map((req) => (
                  <tr key={req.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {/* fallback por si el API no incluye worker en el select */}
                      {req.worker?.username ?? '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                      {req.type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(req.startDate).toLocaleDateString('es-ES')} -{' '}
                      {new Date(req.endDate).toLocaleDateString('es-ES')}
                    </td>
                    <td
                      className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                        req.status === 'aprobado'
                          ? 'text-green-600'
                          : req.status === 'rechazado'
                          ? 'text-red-600'
                          : 'text-yellow-600'
                      }`}
                    >
                      {req.status}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {req.status === 'pendiente' && (
                        <>
                          <button
                            onClick={() => handleStatusChange(req.id, 'aprobado')}
                            className="text-green-600 hover:text-green-900 mr-4"
                          >
                            Aprobar
                          </button>
                          <button
                            onClick={() => handleStatusChange(req.id, 'rechazado')}
                            className="text-red-600 hover:text-red-900"
                          >
                            Rechazar
                          </button>
                          <button onClick={() => handleDelete(req.id)}
                                  className="text-gray-700 bg-red-100 hover:bg-red-200 px-2 py-1 rounded">
                            Eliminar
                          </button>

                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

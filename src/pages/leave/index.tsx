// src/pages/leave/index.tsx
import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { LeaveRequest } from '../../types';

export default function LeaveRequestsPage() {
  const { data: session, status } = useSession();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = async () => {
    try {
      const res = await fetch('/api/leave');
      if (!res.ok) throw new Error('Error al obtener las solicitudes.');
      const requestsData: LeaveRequest[] = await res.json();
      setRequests(requestsData);
    } catch (error) { // Corrección: quitamos el ': any'
      setError('Ocurrió un error inesperado al obtener solicitudes.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated' || (session?.user?.role === 'empleado')) {
      setIsLoading(false);
      return;
    }
    fetchRequests();
  }, [status, session]);

  const handleStatusChange = async (id: string, newStatus: 'aprobado' | 'rechazado') => {
    const isConfirmed = window.confirm(`¿Estás seguro de que quieres ${newStatus} esta solicitud?`);
    if (!isConfirmed) return;

    try {
      const res = await fetch('/api/leave/approve', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      });

      if (res.ok) {
        await fetchRequests();
      } else {
        const errorData = await res.json();
        alert(`Error: ${errorData.message}`);
      }
    } catch (error) {
      alert('No se pudo conectar con el servidor.');
    }
  };

  if (status === 'unauthenticated' || (session?.user?.role === 'empleado')) {
    return <p className="p-8 text-center text-xl text-red-500">Acceso denegado.</p>;
  }

  if (isLoading) return <p className="p-8 text-center">Cargando solicitudes...</p>;

  return (
    <>
      <Head>
        <title>Gestionar Solicitudes | Emaus Teams App</title>
      </Head>
      
      <div className="min-h-screen bg-gray-100 p-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Solicitudes de Permisos y Vacaciones</h1>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          {requests.length === 0 ? (
            <p className="text-gray-500 italic text-center">No hay solicitudes para gestionar.</p>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usuario</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fechas</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                  <th scope="col" className="relative px-6 py-3">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {requests.map((req) => (
                  <tr key={req.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{req.worker.username}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">{req.type}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(req.startDate).toDateString()} - {new Date(req.endDate).toDateString()}</td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${req.status === 'aprobado' ? 'text-green-600' : req.status === 'rechazado' ? 'text-red-600' : 'text-yellow-600'}`}>
                      {req.status}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {req.status === 'pendiente' && (
                        <>
                          <button onClick={() => handleStatusChange(req.id, 'aprobado')} className="text-green-600 hover:text-green-900 mr-4">Aprobar</button>
                          <button onClick={() => handleStatusChange(req.id, 'rechazado')} className="text-red-600 hover:text-red-900">Rechazar</button>
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
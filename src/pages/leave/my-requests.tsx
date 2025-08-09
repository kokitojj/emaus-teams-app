// src/pages/leave/my-requests.tsx

import Head from 'next/head';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { LeaveRequest } from '../../types';

export default function MyRequestsPage() {
  const { data: session, status } = useSession();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') {
      setIsLoading(false);
      return;
    }
    const fetchRequests = async () => {
      try {
        const res = await fetch('/api/leave');
        if (!res.ok) throw new Error('Error al obtener las solicitudes.');
        const requestsData: LeaveRequest[] = await res.json();
        setRequests(requestsData);
      } catch (err: any) {
        setError(err.message || 'Ocurrió un error inesperado.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchRequests();
  }, [status]);

  if (status === 'unauthenticated') return <p className="p-8 text-center text-xl text-red-500">Acceso denegado.</p>;
  if (isLoading) return <p className="p-8 text-center">Cargando solicitudes...</p>;
  
  return (
    <>
      <Head>
        <title>Mis Solicitudes | Emaus Teams App</title>
      </Head>
      
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Mis Solicitudes</h1>
          <Link href="/leave/submit">
            <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors">
              Enviar Nueva Solicitud
            </button>
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          {requests.length === 0 ? (
            <p className="text-gray-500 italic text-center">No has enviado ninguna solicitud.</p>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fechas</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Razón</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {requests.map((req) => (
                  <tr key={req.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 capitalize">{req.type}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(req.startDate).toDateString()} - {new Date(req.endDate).toDateString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{req.reason}</td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${req.status === 'aprobado' ? 'text-green-600' : req.status === 'rechazado' ? 'text-red-600' : 'text-yellow-600'}`}>
                      {req.status}
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
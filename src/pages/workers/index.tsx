// src/pages/workers/index.tsx

import Head from 'next/head';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Worker } from '../../types';

export default function WorkersPage() {
  const { data: session, status } = useSession();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkers = async () => {
    try {
      const res = await fetch('/api/workers');
      if (!res.ok) {
        throw new Error('Error al obtener la lista de trabajadores.');
      }
      const workersData: Worker[] = await res.json();
      setWorkers(workersData);
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error inesperado.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') {
      setIsLoading(false);
      return;
    }
    fetchWorkers();
  }, [status]);

  const handleDelete = async (id: string) => {
    const isConfirmed = window.confirm('¿Estás seguro de que quieres eliminar este trabajador?');
    if (!isConfirmed) return;

    try {
      const res = await fetch('/api/deleteWorker', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (res.ok) {
        await fetchWorkers();
      } else {
        const errorData = await res.json();
        alert(`Error al eliminar: ${errorData.message}`);
      }
    } catch (error) {
      alert('No se pudo conectar con el servidor para eliminar el trabajador.');
    }
  };

  if (status === 'unauthenticated' || session?.user?.role !== 'admin') {
    return <p className="p-8 text-center text-xl text-red-500">Acceso denegado.</p>;
  }

  const isAdmin = session?.user?.role === 'admin';

  return (
    <>
      <Head>
        <title>Gestión de Trabajadores | Emaus Teams App</title>
      </Head>
      
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Trabajadores</h1>
          {isAdmin && (
            <Link href="/workers/add">
              <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors">
                Añadir Trabajador
              </button>
            </Link>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          {isLoading ? (
            <p className="text-gray-500 italic text-center">Cargando...</p>
          ) : workers.length === 0 ? (
            <p className="text-gray-500 italic text-center">No hay trabajadores registrados.</p>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usuario</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rol</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                  <th scope="col" className="relative px-6 py-3">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {workers.map((worker) => (
                  <tr key={worker.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{worker.username}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{worker.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">{worker.role}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">{worker.status}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {isAdmin && (
                        <>
                          <Link href={`/workers/${worker.id}`} className="text-indigo-600 hover:text-indigo-900 mr-4">Editar
                          </Link>
                          <button 
                            onClick={() => handleDelete(worker.id)} 
                            className="text-red-600 hover:text-red-900"
                          >
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
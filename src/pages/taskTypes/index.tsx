// src/pages/taskTypes/index.tsx

import Head from 'next/head';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { TaskType } from '../../types';

export default function TaskTypesPage() {
  const { data: session, status } = useSession();
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTaskTypes = async () => {
    try {
      const res = await fetch('/api/taskTypes');
      if (!res.ok) {
        throw new Error('Error al obtener los tipos de tareas.');
      }
      const taskTypesData: TaskType[] = await res.json();
      setTaskTypes(taskTypesData);
    } catch (e) {
      console.error('Ocurrió un error inesperado al obtener los tipos de tareas.', e);
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
    fetchTaskTypes();
  }, [status]);

  const handleDelete = async (id: string) => {
    const isConfirmed = window.confirm('¿Estás seguro de que quieres eliminar este tipo de tarea?');
    if (!isConfirmed) return;

    try {
      const res = await fetch('/api/taskTypes/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (res.ok) {
        await fetchTaskTypes();
      } else {
        const errorData = await res.json();
        alert(`Error al eliminar: ${errorData.message}`);
      }
    } catch (e) {
      console.error('No se pudo conectar con el servidor para eliminar el tipo de tarea.', e);
      alert('No se pudo conectar con el servidor para eliminar el tipo de tarea.');
    }
  };

  if (status === 'unauthenticated' || (session?.user?.role !== 'admin' && session?.user?.role !== 'supervisor')) {
    return <p className="p-8 text-center text-xl text-red-500">Acceso denegado.</p>;
  }

  const isAdminOrSupervisor = session?.user?.role === 'admin' || session?.user?.role === 'supervisor';

  return (
    <>
      <Head>
        <title>Tipos de Tareas | Emaus Teams App</title>
      </Head>
      
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Tipos de Tareas</h1>
          {isAdminOrSupervisor && (
            <Link href="/taskTypes/add">
              <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors">
                Añadir Tipo de Tarea
              </button>
            </Link>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          {isLoading ? (
            <p className="text-gray-500 italic text-center">Cargando...</p>
          ) : taskTypes.length === 0 ? (
            <p className="text-gray-500 italic text-center">No hay tipos de tareas registrados.</p>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trabajadores Calificados</th>
                  <th scope="col" className="relative px-6 py-3">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {taskTypes.map((taskType) => (
                  <tr key={taskType.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{taskType.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{taskType.qualifiedWorkers.length} trabajadores</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {isAdminOrSupervisor && (
                        <>
                          <Link href={`/taskTypes/${taskType.id}`} className="text-indigo-600 hover:text-indigo-900 mr-4">
                            Editar
                          </Link>
                          <button 
                            onClick={() => handleDelete(taskType.id)} 
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
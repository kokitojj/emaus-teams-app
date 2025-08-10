// src/pages/tasks/index.tsx

import Head from 'next/head';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Task } from '../../types';

export default function TasksPage() {
  const { data: session, status } = useSession();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/tasks');
      if (!res.ok) {
        throw new Error('Error al obtener las tareas.');
      }
      const tasksData: Task[] = await res.json();
      setTasks(tasksData);
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
    fetchTasks();
  }, [status]);

  const handleDelete = async (id: string) => {
    const isConfirmed = window.confirm('¿Estás seguro de que quieres eliminar esta tarea?');
    if (!isConfirmed) return;

    try {
      const res = await fetch('/api/tasks/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (res.ok) {
        await fetchTasks();
      } else {
        const errorData = await res.json();
        alert(`Error al eliminar: ${errorData.message}`);
      }
    } catch (error) {
      alert('No se pudo conectar con el servidor para eliminar la tarea.');
    }
  };

  const handleComplete = async (task: Task) => {
    try {
      const res = await fetch('/api/tasks/edit', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...task, isCompleted: !task.isCompleted }),
      });

      if (res.ok) {
        await fetchTasks();
      } else {
        const errorData = await res.json();
        alert(`Error al actualizar: ${errorData.message}`);
      }
    } catch (error) {
      alert('No se pudo conectar con el servidor para actualizar la tarea.');
    }
  };

  if (status === 'unauthenticated' || (session?.user?.role !== 'admin' && session?.user?.role !== 'supervisor')) {
    return <p className="p-8 text-center text-xl text-red-500">Acceso denegado.</p>;
  }

  const isAdminOrSupervisor = session?.user?.role === 'admin' || session?.user?.role === 'supervisor';

  return (
    <>
      <Head>
        <title>Tareas | Emaus Teams App</title>
      </Head>
      
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Tareas</h1>
          {isAdminOrSupervisor && (
            <Link href="/tasks/add">
              <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors">
                Añadir Tarea
              </button>
            </Link>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          {isLoading ? (
            <p className="text-gray-500 italic text-center">Cargando...</p>
          ) : tasks.length === 0 ? (
            <p className="text-gray-500 italic text-center">No hay tareas registradas.</p>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Asignada a</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Horario</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Observaciones</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completada</th>
                  <th scope="col" className="relative px-6 py-3">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tasks.map((task) => (
                  <tr key={task.id} className={task.isCompleted ? 'bg-green-50' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{task.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {task.workers.map(w => w.username).join(', ')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{task.taskType.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(task.startTime).toLocaleString()} - {new Date(task.endTime).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs overflow-hidden text-ellipsis">{task.observations || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <input
                        type="checkbox"
                        checked={task.isCompleted}
                        onChange={() => handleComplete(task)}
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {isAdminOrSupervisor && (
                        <>
                          <Link href={`/tasks/${task.id}`} className="text-indigo-600 hover:text-indigo-900 mr-4">Editar
                          </Link>
                          <button 
                            onClick={() => handleDelete(task.id)} 
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
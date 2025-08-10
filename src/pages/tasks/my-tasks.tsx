// src/pages/my-tasks.tsx

import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Task } from '../../types';

export default function MyTasksPage() {
  const { status } = useSession();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/tasks');
      if (!res.ok) {
        throw new Error('Error al obtener las tareas.');
      }
      const tasksData: Task[] = await res.json();
      setTasks(tasksData);
    } catch (e) {
      console.error('Ocurrió un error inesperado al obtener las tareas.', e);
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
    } catch (e) {
      console.error('No se pudo conectar con el servidor para actualizar la tarea.', e);
      alert('No se pudo conectar con el servidor para actualizar la tarea.');
    }
  };

  if (status === 'loading') return <p>Cargando...</p>;
  if (status === 'unauthenticated') return <p className="p-8 text-center text-xl text-red-500">Acceso denegado.</p>;
  
  // No hay un check de rol aquí porque la API ya filtra las tareas por el ID del usuario
  
  return (
    <>
      <Head>
        <title>Mis Tareas | Emaus Teams App</title>
      </Head>
      
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Mis Tareas</h1>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          {isLoading ? (
            <p className="text-gray-500 italic text-center">Cargando...</p>
          ) : tasks.length === 0 ? (
            <p className="text-gray-500 italic text-center">No hay tareas asignadas.</p>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completada</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tasks.map((task) => (
                  <tr key={task.id} className={task.isCompleted ? 'bg-green-50' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{task.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{task.taskType.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <input
                        type="checkbox"
                        checked={task.isCompleted}
                        onChange={() => handleComplete(task)}
                      />
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
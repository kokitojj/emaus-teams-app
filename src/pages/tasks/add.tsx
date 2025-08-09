// src/pages/tasks/add.tsx

import Head from 'next/head';
import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { Worker, TaskType } from '../../types';

export default function AddTaskPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [name, setName] = useState('');
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [assignedWorkerId, setAssignedWorkerId] = useState('');
  const [taskTypeId, setTaskTypeId] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (status === 'loading' || status === 'unauthenticated') {
      setIsLoading(false);
      return;
    }
    const fetchData = async () => {
      try {
        const [workersRes, taskTypesRes] = await Promise.all([
          fetch('/api/workers'),
          fetch('/api/taskTypes'),
        ]);

        const workersData: Worker[] = await workersRes.json();
        const taskTypesData: TaskType[] = await taskTypesRes.json();

        setWorkers(workersData);
        setTaskTypes(taskTypesData);

        // Seleccionamos la primera opción por defecto si existen
        if (workersData.length > 0) setAssignedWorkerId(workersData[0].id);
        if (taskTypesData.length > 0) setTaskTypeId(taskTypesData[0].id);

      } catch (err) {
        setMessage('Error al cargar datos para el formulario.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [status]);

  if (status === 'unauthenticated' || (session?.user?.role !== 'admin' && session?.user?.role !== 'supervisor')) {
    return <p className="p-8 text-center text-xl text-red-500">Acceso denegado.</p>;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);

    const taskData = { name, assignedWorkerId, taskTypeId };

    try {
      const res = await fetch('/api/tasks/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(taskData),
      });

      if (res.ok) {
        setMessage('Tarea añadida con éxito.');
        router.push('/tasks');
      } else {
        const errorData = await res.json();
        setMessage(errorData.message || 'Ocurrió un error inesperado.');
      }
    } catch (error) {
      setMessage('No se pudo conectar con el servidor.');
    }
  };

  return (
    <>
      <Head>
        <title>Añadir Tarea | Emaus Teams App</title>
      </Head>
      
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-md p-8 w-full max-w-lg">
          <h1 className="text-2xl font-bold mb-6 text-gray-800 text-center">Añadir Nueva Tarea</h1>
          
          {message && (
            <div className={`p-4 mb-4 rounded-lg ${message.startsWith('Error') || message.startsWith('No') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
              <p>{message}</p>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="name" className="block text-gray-700 text-sm font-bold mb-2">Nombre de la Tarea</label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight"
                required
              />
            </div>

            <div className="mb-4">
              <label htmlFor="assignedWorker" className="block text-gray-700 text-sm font-bold mb-2">Asignar a Trabajador</label>
              <select
                id="assignedWorker"
                value={assignedWorkerId}
                onChange={(e) => setAssignedWorkerId(e.target.value)}
                className="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight"
                required
              >
                {isLoading ? (
                  <option>Cargando...</option>
                ) : (
                  workers.map(worker => (
                    <option key={worker.id} value={worker.id}>{worker.username}</option>
                  ))
                )}
              </select>
            </div>

            <div className="mb-6">
              <label htmlFor="taskType" className="block text-gray-700 text-sm font-bold mb-2">Tipo de Tarea</label>
              <select
                id="taskType"
                value={taskTypeId}
                onChange={(e) => setTaskTypeId(e.target.value)}
                className="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight"
                required
              >
                {isLoading ? (
                  <option>Cargando...</option>
                ) : (
                  taskTypes.map(type => (
                    <option key={type.id} value={type.id}>{type.name}</option>
                  ))
                )}
              </select>
            </div>
            
            <div className="flex items-center justify-center">
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors"
              >
                Añadir Tarea
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
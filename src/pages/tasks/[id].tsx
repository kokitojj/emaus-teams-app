// src/pages/tasks/[id].tsx

import Head from 'next/head';
import { useRouter } from 'next/router';
import { useState, useEffect, FormEvent } from 'react';
import { useSession } from 'next-auth/react';
import { Task, Worker, TaskType } from '../../types';

export default function EditTaskPage() {
  const router = useRouter();
  const { id } = router.query;
  const { data: session, status } = useSession();
  
  const [task, setTask] = useState<Task | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'loading' || !id) return;
    if (status === 'unauthenticated') {
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const [taskRes, workersRes, taskTypesRes] = await Promise.all([
          fetch(`/api/tasks/${id}`),
          fetch('/api/workers'),
          fetch('/api/taskTypes'),
        ]);

        if (!taskRes.ok) throw new Error('Error al obtener la tarea.');
        if (!workersRes.ok) throw new Error('Error al obtener los trabajadores.');
        if (!taskTypesRes.ok) throw new Error('Error al obtener los tipos de tareas.');

        const taskData: Task = await taskRes.json();
        const workersData: Worker[] = await workersRes.json();
        const taskTypesData: TaskType[] = await taskTypesRes.json();

        setTask(taskData);
        setWorkers(workersData);
        setTaskTypes(taskTypesData);
      } catch (err: any) {
        setMessage(err.message || 'Ocurrió un error inesperado.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [id, status]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (!task) return;

    try {
      const res = await fetch('/api/tasks/edit', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: task.id,
          name: task.name,
          assignedWorkerId: task.assignedWorkerId,
          taskTypeId: task.taskTypeId,
          isCompleted: task.isCompleted,
        }),
      });

      if (res.ok) {
        setMessage('Tarea actualizada con éxito.');
        router.push('/tasks');
      } else {
        const errorData = await res.json();
        setMessage(`Error: ${errorData.message}`);
      }
    } catch (err) {
      setMessage('No se pudo conectar con el servidor.');
    }
  };

  if (status === 'unauthenticated' || (session?.user?.role !== 'admin' && session?.user?.role !== 'supervisor')) {
    return <p className="p-8 text-center text-xl text-red-500">Acceso denegado.</p>;
  }

  if (isLoading || !task) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-xl font-semibold text-gray-700">Cargando...</p>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Editar Tarea | Emaus Teams App</title>
      </Head>
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-md p-8 w-full max-w-lg">
          <h1 className="text-2xl font-bold mb-6 text-gray-800 text-center">Editar Tarea: {task.name}</h1>
          {message && (
            <div className={`p-4 mb-4 rounded-lg ${message.startsWith('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
              <p>{message}</p>
            </div>
          )}
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="name" className="block text-gray-700 text-sm font-bold mb-2">Nombre</label>
              <input type="text" id="name" value={task.name} onChange={(e) => setTask(prev => prev ? { ...prev, name: e.target.value } : null)} className="shadow border rounded w-full py-2 px-3 text-gray-700" required />
            </div>
            
            <div className="mb-4">
              <label htmlFor="assignedWorker" className="block text-gray-700 text-sm font-bold mb-2">Asignar a Trabajador</label>
              <select
                id="assignedWorker"
                value={task.assignedWorkerId}
                onChange={(e) => setTask(prev => prev ? { ...prev, assignedWorkerId: e.target.value } : null)}
                className="shadow border rounded w-full py-2 px-3 text-gray-700"
                required
              >
                {workers.map(worker => (
                  <option key={worker.id} value={worker.id}>{worker.username}</option>
                ))}
              </select>
            </div>
            
            <div className="mb-4">
              <label htmlFor="taskType" className="block text-gray-700 text-sm font-bold mb-2">Tipo de Tarea</label>
              <select
                id="taskType"
                value={task.taskTypeId}
                onChange={(e) => setTask(prev => prev ? { ...prev, taskTypeId: e.target.value } : null)}
                className="shadow border rounded w-full py-2 px-3 text-gray-700"
                required
              >
                {taskTypes.map(type => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
            </div>

            <div className="mb-6 flex items-center">
              <input
                type="checkbox"
                id="isCompleted"
                checked={task.isCompleted}
                onChange={(e) => setTask(prev => prev ? { ...prev, isCompleted: e.target.checked } : null)}
                className="mr-2"
              />
              <label htmlFor="isCompleted" className="text-gray-700 text-sm font-bold">Marcar como completada</label>
            </div>

            <div className="flex items-center justify-between">
              <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">
                Guardar Cambios
              </button>
              <button type="button" onClick={() => router.push('/tasks')} className="text-gray-500 hover:text-gray-700 font-bold py-2 px-4 rounded-lg">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
// src/pages/taskTypes/[id].tsx

import Head from 'next/head';
import { useRouter } from 'next/router';
import { useState, useEffect, FormEvent } from 'react';
import { useSession } from 'next-auth/react';
import { TaskType, Worker } from '../../types';

export default function EditTaskTypePage() {
  const router = useRouter();
  const { id } = router.query;
  const { data: session, status } = useSession();
  
  const [taskType, setTaskType] = useState<TaskType | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);

  useEffect(() => {
    if (status === 'loading' || !id) return;
    if (status === 'unauthenticated' || (session?.user?.role !== 'admin' && session?.user?.role !== 'supervisor')) {
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const [taskTypeRes, workersRes] = await Promise.all([
          fetch(`/api/taskTypes/${id}`),
          fetch('/api/workers'),
        ]);

        if (!taskTypeRes.ok) throw new Error('Error al obtener el tipo de tarea.');
        if (!workersRes.ok) throw new Error('Error al obtener la lista de trabajadores.');

        const taskTypeData: TaskType = await taskTypeRes.json();
        const workersData: Worker[] = await workersRes.json();

        setTaskType(taskTypeData);
        setWorkers(workersData);
        setSelectedWorkerIds(taskTypeData.qualifiedWorkers.map(w => w.id));
      } catch (error) {
        setMessage('Ocurrió un error inesperado al obtener datos.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [id, status, session]);

  const handleWorkerToggle = (workerId: string) => {
    setSelectedWorkerIds(prev =>
      prev.includes(workerId) ? prev.filter(wId => wId !== workerId) : [...prev, workerId]
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (!taskType) return;

    try {
      const res = await fetch('/api/taskTypes/edit', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: taskType.id,
          name: taskType.name,
          qualifiedWorkerIds: selectedWorkerIds,
        }),
      });

      if (res.ok) {
        setMessage('Tipo de tarea actualizado con éxito.');
        router.push('/taskTypes');
      } else {
        const errorData = await res.json();
        setMessage(`Error: ${errorData.message}`);
      }
    } catch (error) {
      setMessage('No se pudo conectar con el servidor.');
    }
  };

  if (status === 'unauthenticated' || (session?.user?.role !== 'admin' && session?.user?.role !== 'supervisor')) {
    return <p className="p-8 text-center text-xl text-red-500">Acceso denegado.</p>;
  }

  if (isLoading || !taskType) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-xl font-semibold text-gray-700">Cargando...</p>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Editar Tipo de Tarea | Emaus Teams App</title>
      </Head>
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-md p-8 w-full max-w-lg">
          <h1 className="text-2xl font-bold mb-6 text-gray-800 text-center">Editar Tipo de Tarea: {taskType.name}</h1>
          {message && (
            <div className={`p-4 mb-4 rounded-lg ${message.startsWith('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
              <p>{message}</p>
            </div>
          )}
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="name" className="block text-gray-700 text-sm font-bold mb-2">Nombre</label>
              <input type="text" id="name" value={taskType.name} onChange={(e) => setTaskType(prev => prev ? { ...prev, name: e.target.value } : null)} className="shadow border rounded w-full py-2 px-3 text-gray-700" required />
            </div>
            <div className="mb-6">
              <label className="block text-gray-700 text-sm font-bold mb-2">Trabajadores Calificados</label>
              <div className="h-40 overflow-y-auto border rounded p-2 bg-gray-50">
                {workers.length === 0 ? (
                  <p>No hay trabajadores para asignar.</p>
                ) : (
                  workers.map(worker => (
                    <div key={worker.id} className="flex items-center mb-1">
                      <input
                        type="checkbox"
                        id={worker.id}
                        checked={selectedWorkerIds.includes(worker.id)}
                        onChange={() => handleWorkerToggle(worker.id)}
                        className="mr-2"
                      />
                      <label htmlFor={worker.id} className="text-gray-700">{worker.username} ({worker.role})</label>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">
                Guardar Cambios
              </button>
              <button type="button" onClick={() => router.push('/taskTypes')} className="text-gray-500 hover:text-gray-700 font-bold py-2 px-4 rounded-lg">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
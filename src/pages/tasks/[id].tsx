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
  const [allWorkers, setAllWorkers] = useState<Worker[]>([]);
  const [filteredWorkers, setFilteredWorkers] = useState<Worker[]>([]);
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
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
        setAllWorkers(workersData);
        setTaskTypes(taskTypesData);
        setSelectedWorkerIds(taskData.workers.map(w => w.id));
      } catch (e) {
        console.error('Ocurrió un error inesperado al obtener datos.', e);
        setMessage('Ocurrió un error inesperado al obtener datos.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [id, status, session]);
  
  useEffect(() => {
    if (task && allWorkers.length > 0 && taskTypes.length > 0) {
      const selectedTaskType = taskTypes.find(type => type.id === task.taskTypeId);
      if (selectedTaskType) {
        const qualifiedWorkerIds = selectedTaskType.qualifiedWorkers.map(w => w.id);
        const filtered = allWorkers.filter(worker => qualifiedWorkerIds.includes(worker.id));
        setFilteredWorkers(filtered);
      }
    }
  }, [task, allWorkers, taskTypes]);

  const handleWorkerToggle = (workerId: string) => {
    setSelectedWorkerIds(prev =>
      prev.includes(workerId) ? prev.filter(wId => wId !== workerId) : [...prev, workerId]
    );
  };

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
          isCompleted: task.isCompleted,
          startTime: task.startTime,
          endTime: task.endTime,
          observations: task.observations,
          taskTypeId: task.taskTypeId,
          workerIds: selectedWorkerIds,
        }),
      });

      if (res.ok) {
        setMessage('Tarea actualizada con éxito.');
        router.push('/tasks');
      } else {
        const errorData = await res.json();
        setMessage(`Error: ${errorData.message}`);
      }
    } catch (e) {
      console.error('No se pudo conectar con el servidor.', e);
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
              <label htmlFor="startTime" className="block text-gray-700 text-sm font-bold mb-2">Hora de Inicio</label>
              <input type="datetime-local" id="startTime" value={new Date(task.startTime).toISOString().substring(0, 16)} onChange={(e) => setTask(prev => prev ? { ...prev, startTime: new Date(e.target.value) } : null)} className="shadow border rounded w-full py-2 px-3 text-gray-700" required />
            </div>

            <div className="mb-4">
              <label htmlFor="endTime" className="block text-gray-700 text-sm font-bold mb-2">Hora de Fin</label>
              <input type="datetime-local" id="endTime" value={new Date(task.endTime).toISOString().substring(0, 16)} onChange={(e) => setTask(prev => prev ? { ...prev, endTime: new Date(e.target.value) } : null)} className="shadow border rounded w-full py-2 px-3 text-gray-700" required />
            </div>
            
            <div className="mb-4">
              <label htmlFor="observations" className="block text-gray-700 text-sm font-bold mb-2">Observaciones</label>
              <textarea id="observations" value={task.observations || ''} onChange={(e) => setTask(prev => prev ? { ...prev, observations: e.target.value } : null)} className="shadow border rounded w-full py-2 px-3 text-gray-700" rows={3}></textarea>
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

            <div className="mb-6">
              <label className="block text-gray-700 text-sm font-bold mb-2">Asignar Trabajadores</label>
              <div className="h-40 overflow-y-auto border rounded p-2 bg-gray-50">
                {filteredWorkers.length === 0 ? (
                  <p>No hay trabajadores calificados para este tipo de tarea.</p>
                ) : (
                  filteredWorkers.map(worker => (
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
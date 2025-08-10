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
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [observations, setObservations] = useState('');
  const [allWorkers, setAllWorkers] = useState<Worker[]>([]); // Almacenamos todos los trabajadores
  const [filteredWorkers, setFilteredWorkers] = useState<Worker[]>([]); // Almacenamos los trabajadores filtrados
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [selectedTaskTypeId, setSelectedTaskTypeId] = useState('');
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Obtener la lista de trabajadores y tipos de tareas
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

        setAllWorkers(workersData);
        setTaskTypes(taskTypesData);

        if (taskTypesData.length > 0) {
          setSelectedTaskTypeId(taskTypesData[0].id);
        }

      } catch (err) {
        setMessage('Error al cargar datos para el formulario.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [status]);

  // Nuevo: Efecto para filtrar trabajadores cuando cambia el tipo de tarea
  useEffect(() => {
    if (selectedTaskTypeId && allWorkers.length > 0 && taskTypes.length > 0) {
      const selectedTaskType = taskTypes.find(type => type.id === selectedTaskTypeId);
      if (selectedTaskType) {
        const qualifiedWorkerIds = selectedTaskType.qualifiedWorkers.map(w => w.id);
        const filtered = allWorkers.filter(worker => qualifiedWorkerIds.includes(worker.id));
        setFilteredWorkers(filtered);
        setSelectedWorkerIds([]); // Reiniciamos la selección
      }
    }
  }, [selectedTaskTypeId, allWorkers, taskTypes]);

  if (status === 'unauthenticated' || (session?.user?.role !== 'admin' && session?.user?.role !== 'supervisor')) {
    return <p className="p-8 text-center text-xl text-red-500">Acceso denegado. Por favor, inicia sesión con un rol autorizado.</p>;
  }

  const handleWorkerToggle = (workerId: string) => {
    setSelectedWorkerIds(prev =>
      prev.includes(workerId) ? prev.filter(id => id !== workerId) : [...prev, workerId]
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);

    const taskData = {
      name,
      startTime,
      endTime,
      observations,
      taskTypeId: selectedTaskTypeId,
      workerIds: selectedWorkerIds,
    };

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
              <label htmlFor="startTime" className="block text-gray-700 text-sm font-bold mb-2">Hora de Inicio</label>
              <input
                type="datetime-local"
                id="startTime"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight"
                required
              />
            </div>

            <div className="mb-4">
              <label htmlFor="endTime" className="block text-gray-700 text-sm font-bold mb-2">Hora de Fin</label>
              <input
                type="datetime-local"
                id="endTime"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight"
                required
              />
            </div>
            
            <div className="mb-4">
              <label htmlFor="observations" className="block text-gray-700 text-sm font-bold mb-2">Observaciones</label>
              <textarea
                id="observations"
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight"
                rows={3}
              />
            </div>

            <div className="mb-4">
              <label htmlFor="taskType" className="block text-gray-700 text-sm font-bold mb-2">Tipo de Tarea</label>
              <select
                id="taskType"
                value={selectedTaskTypeId}
                onChange={(e) => setSelectedTaskTypeId(e.target.value)}
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
            
            <div className="mb-6">
              <label className="block text-gray-700 text-sm font-bold mb-2">Asignar Trabajadores</label>
              <div className="h-40 overflow-y-auto border rounded p-2 bg-gray-50">
                {isLoading ? (
                  <p>Cargando trabajadores...</p>
                ) : filteredWorkers.length === 0 ? (
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
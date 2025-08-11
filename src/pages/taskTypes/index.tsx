// src/pages/taskTypes/index.tsx
import Head from 'next/head';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { TaskType as BaseTaskType } from '../../types';

type TaskType = BaseTaskType & {
  color?: string | null;
  qualifiedWorkers?: any[];
};

export default function TaskTypesPage() {
  const { data: session, status } = useSession();
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isAdminOrSupervisor =
    (session?.user?.role === 'admin' || session?.user?.role === 'supervisor');

  const fetchTaskTypes = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/taskTypes', { cache: 'no-store' });
      if (!res.ok) {
        const txt = await res.text();
        if (res.status === 401 || res.status === 403) {
          throw new Error('No tienes permisos para ver los tipos de tareas.');
        }
        throw new Error(`Error al obtener los tipos de tareas: ${txt}`);
      }
      const taskTypesData: TaskType[] = await res.json();
      setTaskTypes(Array.isArray(taskTypesData) ? taskTypesData : []);
    } catch (e: any) {
      console.error('Ocurrió un error al obtener los tipos de tareas.', e);
      setErrorMsg(e?.message ?? 'Error inesperado al obtener los tipos de tareas.');
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
        const errorData = await res.json().catch(() => ({}));
        alert(`Error al eliminar: ${errorData.message ?? 'Error desconocido.'}`);
      }
    } catch (e) {
      console.error('No se pudo conectar con el servidor para eliminar el tipo de tarea.', e);
      alert('No se pudo conectar con el servidor para eliminar el tipo de tarea.');
    }
  };

  const handleColorChange = async (id: string, color: string | null) => {
    if (!isAdminOrSupervisor) return;
    try {
      const res = await fetch(`/api/taskTypes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ color }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`No se pudo actualizar el color: ${txt}`);
      }
      const updated: TaskType = await res.json();
      setTaskTypes(prev => prev.map(t => (t.id === id ? { ...t, color: updated.color } : t)));
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? 'No se pudo actualizar el color.');
    }
  };

  if (status === 'unauthenticated' || (!isAdminOrSupervisor && session?.user?.role !== 'empleado')) {
    return <p className="p-8 text-center text-xl text-red-500">Acceso denegado.</p>;
  }
console.log('API /taskTypes session:', session?.user?.id, session?.user?.role);

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
          ) : errorMsg ? (
            <div className="text-center">
              <p className="text-red-600 font-medium mb-2">{errorMsg}</p>
              <button
                onClick={fetchTaskTypes}
                className="px-4 py-2 rounded-lg border shadow-sm hover:bg-gray-50"
              >
                Reintentar
              </button>
            </div>
          ) : taskTypes.length === 0 ? (
            <p className="text-gray-500 italic text-center">No hay tipos de tareas registrados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Color</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trabajadores Calificados</th>
                    <th className="relative px-6 py-3">
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {taskTypes.map((taskType) => {
                    const color = taskType.color ?? '';
                    const qualified = taskType.qualifiedWorkers?.length ?? 0;
                    return (
                      <tr key={taskType.id} className="align-middle">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="flex items-center gap-3">
                            <span
                              className="inline-block h-5 w-5 rounded-full border"
                              style={{ background: color || '#ffffff', borderColor: color || '#d1d5db' }}
                              title={color || 'Sin color definido'}
                            />
                            <span className="text-xs text-gray-600">
                              {color || <em className="text-gray-400">sin color</em>}
                            </span>
                            {isAdminOrSupervisor && (
                              <>
                                <input
                                  type="color"
                                  value={color || '#cccccc'}
                                  onChange={(e) => handleColorChange(taskType.id, e.target.value)}
                                  className="h-8 w-12 cursor-pointer"
                                  title="Cambiar color"
                                />
                                {color && (
                                  <button
                                    onClick={() => handleColorChange(taskType.id, null)}
                                    className="text-xs text-gray-600 hover:text-gray-900 underline"
                                    title="Quitar color"
                                  >
                                    Quitar
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {taskType.name}
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {qualified} {qualified === 1 ? 'trabajador' : 'trabajadores'}
                        </td>

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
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// src/pages/index.tsx
import Head from 'next/head';
import Link from 'next/link';
import { Fragment, useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Worker, Task, LeaveRequest } from '../types';

export default function Home() {
  const { data: session, status } = useSession();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') {
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const [workersRes, tasksRes, leaveRes] = await Promise.all([
          fetch('/api/workers'),
          fetch('/api/tasks'),
          fetch('/api/leave'),
        ]);

        const workersData: Worker[] = await workersRes.json();
        const tasksData: Task[] = await tasksRes.json();
        const leaveData: LeaveRequest[] = await leaveRes.json();
        
        if (Array.isArray(workersData)) setWorkers(workersData);
        if (Array.isArray(tasksData)) setTasks(tasksData);
        if (Array.isArray(leaveData)) setLeaveRequests(leaveData);

      } catch (error) {
        setError('Ocurrió un error inesperado al obtener datos.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [status]);

  if (status === 'loading') {
    return <p>Cargando...</p>;
  }

  const role = session?.user?.role as string;
  const activeWorkers = workers.filter(w => w.status === 'activo').length;
  const onVacation = workers.filter(w => w.status === 'vacaciones').length;
  const onLeave = workers.filter(w => w.status === 'permiso').length;
  const pendingRequestsCount = Array.isArray(leaveRequests) ? leaveRequests.filter(req => req.status === 'pendiente').length : 0;
  const pendingTasksCount = Array.isArray(tasks) ? tasks.filter(t => !t.isCompleted).length : 0;

  const tasksLink = role === 'empleado' ? '/tasks/my-tasks' : '/tasks';
  
  return (
    <Fragment>
      <Head>
        <title>Dashboard | Emaus Teams App</title>
      </Head>

      <div className="min-h-screen bg-gray-100 p-8">
        <h1 className="text-3xl font-bold mb-8 text-gray-800">Dashboard</h1>
        {status === 'unauthenticated' ? (
          <p className="text-center text-xl text-red-500">Por favor, inicia sesión para acceder al dashboard.</p>
        ) : (
          <>
            {/* Resumen de trabajadores */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-lg font-semibold text-gray-600">Total de Activos</h2>
                <p className="text-4xl font-bold text-green-600 mt-2">{activeWorkers}</p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-lg font-semibold text-gray-600">De Vacaciones</h2>
                <p className="text-4xl font-bold text-yellow-500 mt-2">{onVacation}</p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-lg font-semibold text-gray-600">Con Permiso</h2>
                <p className="text-4xl font-bold text-red-500 mt-2">{onLeave}</p>
              </div>
            </div>

            {/* Sección de Solicitudes y Tareas Pendientes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {(role === 'supervisor' || role === 'admin') && (
                <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-yellow-500">
                  <h2 className="text-lg font-semibold text-gray-600">Solicitudes Pendientes</h2>
                  <p className="text-4xl font-bold text-yellow-500 mt-2">{pendingRequestsCount}</p>
                  <Link href="/leave">
                    <a className="text-sm font-medium text-yellow-600 hover:text-yellow-800 mt-2 inline-block">Gestionar Solicitudes &rarr;</a>
                  </Link>
                </div>
              )}
              <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
                <h2 className="text-lg font-semibold text-gray-600">Tareas Pendientes</h2>
                <p className="text-4xl font-bold text-blue-500 mt-2">{pendingTasksCount}</p>
                <Link href={tasksLink}>
                  <a className="text-sm font-medium text-blue-600 hover:text-blue-800 mt-2 inline-block">Ver Tareas &rarr;</a>
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </Fragment>
  );
}
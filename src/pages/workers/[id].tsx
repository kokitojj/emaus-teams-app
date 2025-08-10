// src/pages/workers/[id].tsx

import Head from 'next/head';
import { useRouter } from 'next/router';
import { useState, useEffect, FormEvent } from 'react';
import { useSession } from 'next-auth/react';
import { Worker } from '../../types';

export default function EditWorkerPage() {
  const router = useRouter();
  const { id } = router.query;
  const { data: session, status } = useSession();

  const [worker, setWorker] = useState<Worker | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'loading' || !id) return;
    if (status === 'unauthenticated' || session?.user?.role !== 'admin') {
      setIsLoading(false);
      return;
    }

    const fetchWorker = async () => {
      try {
        const res = await fetch(`/api/workers/${id}`);
        if (!res.ok) throw new Error('Error al obtener los datos del usuario.');
        const workerData: Worker = await res.json();
        setWorker(workerData);
      } catch (e) {
        console.error('Ocurrió un error inesperado al obtener los datos del usuario.', e);
        setMessage('Ocurrió un error inesperado al obtener los datos del usuario.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchWorker();
  }, [id, status, session]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!worker) return;

    try {
      const updatedData = {
        id: worker.id,
        username: worker.username,
        email: worker.email,
        phoneNumber: worker.phoneNumber,
        role: worker.role,
        status: worker.status,
        password: newPassword, // Envia la nueva contraseña si se ha escrito
      };

      const res = await fetch('/api/editWorker', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData),
      });

      if (res.ok) {
        setMessage('Usuario actualizado con éxito.');
        router.push('/workers');
      } else {
        const errorData = await res.json();
        setMessage(`Error: ${errorData.message}`);
      }
    } catch (e) {
      console.error('No se pudo conectar con el servidor.', e);
      setMessage('No se pudo conectar con el servidor.');
    }
  };

  if (status === 'unauthenticated' || session?.user?.role !== 'admin') {
    return <p className="p-8 text-center text-xl text-red-500">Acceso denegado.</p>;
  }

  if (isLoading || !worker) {
    return <p className="p-8 text-center">Cargando...</p>;
  }

  return (
    <>
      <Head>
        <title>Editar Usuario | Emaus Teams App</title>
      </Head>
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-md p-8 w-full max-w-md">
          <h1 className="text-2xl font-bold mb-6 text-gray-800 text-center">Editar Usuario: {worker.username}</h1>

          {message && (
            <div className={`p-4 mb-4 rounded-lg ${message.startsWith('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
              <p>{message}</p>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="username" className="block text-gray-700 text-sm font-bold mb-2">Nombre de Usuario</label>
              <input type="text" id="username" value={worker.username} onChange={(e) => setWorker(prev => prev ? { ...prev, username: e.target.value } : null)} className="shadow border rounded w-full py-2 px-3 text-gray-700" required />
            </div>
            <div className="mb-4">
              <label htmlFor="password" className="block text-gray-700 text-sm font-bold mb-2">Nueva Contraseña (opcional)</label>
              <input type="password" id="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="shadow border rounded w-full py-2 px-3 text-gray-700" placeholder="Deja vacío para no cambiar" />
            </div>
            <div className="mb-4">
              <label htmlFor="email" className="block text-gray-700 text-sm font-bold mb-2">Correo Electrónico (Opcional)</label>
              <input type="email" id="email" value={worker.email || ''} onChange={(e) => setWorker(prev => prev ? { ...prev, email: e.target.value } : null)} className="shadow border rounded w-full py-2 px-3 text-gray-700" />
            </div>
            <div className="mb-4">
              <label htmlFor="phoneNumber" className="block text-gray-700 text-sm font-bold mb-2">Teléfono (Opcional)</label>
              <input type="tel" id="phoneNumber" value={worker.phoneNumber || ''} onChange={(e) => setWorker(prev => prev ? { ...prev, phoneNumber: e.target.value } : null)} className="shadow border rounded w-full py-2 px-3 text-gray-700" />
            </div>
            <div className="mb-4">
              <label htmlFor="role" className="block text-gray-700 text-sm font-bold mb-2">Rol</label>
              <select id="role" value={worker.role} onChange={(e) => setWorker(prev => prev ? { ...prev, role: e.target.value as 'empleado' | 'supervisor' | 'admin' } : null)} className="shadow border rounded w-full py-2 px-3 text-gray-700" required>
                <option value="empleado">Empleado</option>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <div className="mb-6">
              <label htmlFor="status" className="block text-gray-700 text-sm font-bold mb-2">Estado</label>
              <select id="status" value={worker.status} onChange={(e) => setWorker(prev => prev ? { ...prev, status: e.target.value as 'activo' | 'vacaciones' | 'permiso' } : null)} className="shadow border rounded w-full py-2 px-3 text-gray-700" required>
                <option value="activo">Activo</option>
                <option value="vacaciones">De Vacaciones</option>
                <option value="permiso">Con Permiso</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">
                Guardar Cambios
              </button>
              <button type="button" onClick={() => router.push('/workers')} className="text-gray-500 hover:text-gray-700 font-bold py-2 px-4 rounded-lg">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
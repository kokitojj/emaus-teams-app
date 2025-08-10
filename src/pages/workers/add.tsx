// src/pages/workers/add.tsx

import Head from 'next/head';
import { useState } from 'react';
import { useSession } from 'next-auth/react';

export default function AddWorkerPage() {
  const { data: session, status } = useSession();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [role, setRole] = useState('empleado');
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage(null);

    const workerData = { username, password, email, phoneNumber, role };

    try {
      const res = await fetch('/api/addWorker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workerData),
      });

      if (res.ok) {
        setMessage(`Usuario "${username}" añadido con éxito.`);
        setUsername('');
        setPassword('');
        setEmail('');
        setPhoneNumber('');
        setRole('empleado');
      } else {
        const errorData = await res.json();
        setMessage(errorData.message || 'Ocurrió un error inesperado.');
      }
    } catch (e) {
      console.error('No se pudo conectar con el servidor.', e);
      setMessage('No se pudo conectar con el servidor.');
    }
  };

  if (status === 'loading') {
    return <p>Cargando...</p>;
  }

  if (!session || session.user?.role !== 'admin') {
    return <p className="p-8 text-center text-xl text-red-500">Acceso denegado.</p>;
  }

  return (
    <>
      <Head>
        <title>Añadir Usuario | Emaus Teams App</title>
      </Head>
      
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-md p-8 w-full max-w-md">
          <h1 className="text-2xl font-bold mb-6 text-gray-800 text-center">Añadir Nuevo Usuario</h1>
          
          {message && (
            <div className={`p-4 mb-4 rounded-lg ${message.startsWith('Error') || message.startsWith('No') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
              <p>{message}</p>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="username" className="block text-gray-700 text-sm font-bold mb-2">Nombre de Usuario</label>
              <input type="text" id="username" value={username} onChange={(e) => setUsername(e.target.value)} className="shadow border rounded w-full py-2 px-3 text-gray-700" required />
            </div>
            <div className="mb-4">
              <label htmlFor="password" className="block text-gray-700 text-sm font-bold mb-2">Contraseña</label>
              <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} className="shadow border rounded w-full py-2 px-3 text-gray-700" required />
            </div>
            <div className="mb-4">
              <label htmlFor="email" className="block text-gray-700 text-sm font-bold mb-2">Correo Electrónico (Opcional)</label>
              <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} className="shadow border rounded w-full py-2 px-3 text-gray-700" />
            </div>
            <div className="mb-4">
              <label htmlFor="phoneNumber" className="block text-gray-700 text-sm font-bold mb-2">Teléfono (Opcional)</label>
              <input type="tel" id="phoneNumber" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="shadow border rounded w-full py-2 px-3 text-gray-700" />
            </div>
            <div className="mb-6">
              <label htmlFor="role" className="block text-gray-700 text-sm font-bold mb-2">Rol</label>
              <select id="role" value={role} onChange={(e) => setRole(e.target.value)} className="shadow border rounded w-full py-2 px-3 text-gray-700" required>
                <option value="empleado">Empleado</option>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <div className="flex items-center justify-center">
              <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors">
                Añadir Usuario
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
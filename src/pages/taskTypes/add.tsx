// src/pages/taskTypes/add.tsx

import Head from 'next/head';
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';

export default function AddTaskTypePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [name, setName] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  if (status === 'unauthenticated' || (session?.user?.role !== 'admin' && session?.user?.role !== 'supervisor')) {
    return <p className="p-8 text-center text-xl text-red-500">Acceso denegado.</p>;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);

    try {
      const res = await fetch('/api/taskTypes/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      });

      if (res.ok) {
        setMessage('Tipo de tarea añadido con éxito.');
        setName('');
        router.push('/taskTypes');
      } else {
        const errorData = await res.json();
        setMessage(errorData.message || 'Ocurrió un error inesperado.');
      }
    } catch (e) {
      console.error('No se pudo conectar con el servidor.', e);
      setMessage('No se pudo conectar con el servidor.');
    }
  };

  return (
    <>
      <Head>
        <title>Añadir Tipo de Tarea | Emaus Teams App</title>
      </Head>
      
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-md p-8 w-full max-w-md">
          <h1 className="text-2xl font-bold mb-6 text-gray-800 text-center">Añadir Tipo de Tarea</h1>
          
          {message && (
            <div className={`p-4 mb-4 rounded-lg ${message.startsWith('Error') || message.startsWith('No') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
              <p>{message}</p>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="name" className="block text-gray-700 text-sm font-bold mb-2">Nombre</label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight"
                required
              />
            </div>
            
            <div className="flex items-center justify-center">
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors"
              >
                Añadir Tipo de Tarea
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
// src/pages/leave/submit.tsx

import Head from 'next/head';
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';

export default function SubmitLeaveRequestPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [type, setType] = useState('vacaciones');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);

    const requestData = {
      type,
      startDate,
      endDate,
      reason,
    };

    try {
      const res = await fetch('/api/leave/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });

      if (res.ok) {
        setMessage('Solicitud enviada con éxito.');
        router.push('/leave/my-requests');
      } else {
        const errorData = await res.json();
        setMessage(`Error: ${errorData.message}`);
      }
    } catch (error) {
      setMessage('No se pudo conectar con el servidor.');
    }
  };

  if (status === 'loading') return <p>Cargando...</p>;
  if (status === 'unauthenticated') return <p className="p-8 text-center text-xl text-red-500">Acceso denegado.</p>;

  return (
    <>
      <Head>
        <title>Enviar Solicitud | Emaus Teams App</title>
      </Head>
      
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-md p-8 w-full max-w-md">
          <h1 className="text-2xl font-bold mb-6 text-gray-800 text-center">Enviar Solicitud</h1>
          
          {message && (
            <div className={`p-4 mb-4 rounded-lg ${message.startsWith('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
              <p>{message}</p>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="type" className="block text-gray-700 text-sm font-bold mb-2">Tipo de Solicitud</label>
              <select id="type" value={type} onChange={(e) => setType(e.target.value)} className="shadow border rounded w-full py-2 px-3 text-gray-700" required>
                <option value="vacaciones">Vacaciones</option>
                <option value="permiso">Permiso</option>
              </select>
            </div>
            <div className="mb-4">
              <label htmlFor="startDate" className="block text-gray-700 text-sm font-bold mb-2">Fecha de Inicio</label>
              <input type="date" id="startDate" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="shadow border rounded w-full py-2 px-3 text-gray-700" required />
            </div>
            <div className="mb-4">
              <label htmlFor="endDate" className="block text-gray-700 text-sm font-bold mb-2">Fecha de Fin</label>
              <input type="date" id="endDate" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="shadow border rounded w-full py-2 px-3 text-gray-700" required />
            </div>
            <div className="mb-6">
              <label htmlFor="reason" className="block text-gray-700 text-sm font-bold mb-2">Razón</label>
              <textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} className="shadow border rounded w-full py-2 px-3 text-gray-700" rows={3}></textarea>
            </div>
            <div className="flex items-center justify-center">
              <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors">
                Enviar Solicitud
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
import { useState, useMemo } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

type LeaveType = 'baja' | 'vacaciones' | 'permiso';
type LeaveStatus = 'pendiente' | 'aprobado' | 'rechazado';

type Leave = {
  id: string;
  type: LeaveType | string;
  status: LeaveStatus | string;
  startDate: string;
  endDate: string;
};

function fmt(d: string | Date) {
  return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function NewLeaveRequestPage() {
  const router = useRouter();
  const [type, setType] = useState<LeaveType>('vacaciones');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [reason, setReason] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [conflicts, setConflicts] = useState<Leave[]>([]);
  const canCheck = useMemo(() => !!startDate && !!endDate, [startDate, endDate]);

  const precheckConflicts = async () => {
    setConflicts([]);
    setErr('');
    if (!canCheck) return;

    try {
      // Para empleados, /api/leave filtra automáticamente por su Worker
      const q = new URLSearchParams({
        dateFrom: startDate,
        dateTo: endDate,
        format: 'array',
      });
      const r = await fetch(`/api/leave?${q.toString()}`, { cache: 'no-store' });
      const arr: Leave[] = await r.json().catch(() => []);
      if (Array.isArray(arr)) {
        // Sólo interesan pendientes o aprobadas (incompatibles)
        const overlapping = arr.filter(l => ['pendiente', 'aprobado'].includes(String(l.status)));
        setConflicts(overlapping);
      }
    } catch {
      // silencioso: no bloquea, el backend volverá a validar
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');

    if (!startDate || !endDate) {
      setErr('Debes seleccionar fechas de inicio y fin.');
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      setErr('La fecha de inicio no puede ser posterior a la de fin.');
      return;
    }

    // Pre-chequeo en cliente
    await precheckConflicts();
    if (conflicts.length > 0) {
      setErr('Ya existe(n) ausencia(s) que se solapan con el rango elegido. Revisa la lista inferior.');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/leave/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, startDate, endDate, reason }),
      });
      const j = await res.json().catch(() => ({} as any));
      if (!res.ok || !j?.success) throw new Error(j?.error || `HTTP ${res.status}`);
      router.push('/leave/my-requests');
    } catch (e: any) {
      setErr(e?.message || 'Error creando la solicitud');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head><title>Nueva Solicitud · Emaus Teams App</title></Head>
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <header>
          <h1 className="text-2xl font-bold">Nueva solicitud</h1>
          <p className="text-sm text-gray-500">Baja, vacaciones o permiso</p>
        </header>

        <form onSubmit={onSubmit} className="bg-white rounded-2xl shadow p-6 space-y-4">
          {err && <div className="text-sm text-red-600">{err}</div>}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <select value={type} onChange={(e) => setType(e.target.value as LeaveType)} className="w-full border rounded-lg px-3 py-2">
              <option value="vacaciones">Vacaciones</option>
              <option value="permiso">Permiso</option>
              <option value="baja">Baja</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Inicio</label>
              <input type="date" value={startDate}
                     onChange={(e) => setStartDate(e.target.value)}
                     onBlur={precheckConflicts}
                     className="w-full border rounded-lg px-3 py-2" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fin</label>
              <input type="date" value={endDate}
                     onChange={(e) => setEndDate(e.target.value)}
                     onBlur={precheckConflicts}
                     className="w-full border rounded-lg px-3 py-2" required />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Motivo (opcional)</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} className="w-full border rounded-lg px-3 py-2" rows={3}/>
          </div>

          {conflicts.length > 0 && (
            <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm">
              <div className="font-medium mb-1">Conflictos en estas fechas:</div>
              <ul className="list-disc ml-5">
                {conflicts.map(c => (
                  <li key={c.id}>
                    {String(c.type)} · {fmt(c.startDate)} – {fmt(c.endDate)} ({String(c.status)})
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button type="submit" disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg">
              {loading ? 'Enviando…' : 'Enviar solicitud'}
            </button>
            <button type="button" onClick={() => history.back()} className="px-4 py-2 rounded-lg border">Cancelar</button>
          </div>
        </form>
      </div>
    </>
  );
}

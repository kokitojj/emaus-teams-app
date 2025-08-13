// src/pages/tasks/create.tsx
import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';

type Worker = { id: string; username: string };
type TaskType = { id: string; name: string; color?: string | null };

type Conflict = {
  workerId: string;
  workerName?: string;
  tasks: { id: string; name: string; taskTypeName?: string; startTime: string; endTime: string }[];
  leaves: { id: string; type: string; startDate: string; endDate: string }[];
};

const WEEKDAYS = [
  { val: 1, label: 'L' },
  { val: 2, label: 'M' },
  { val: 3, label: 'X' },
  { val: 4, label: 'J' },
  { val: 5, label: 'V' },
  { val: 6, label: 'S' },
  { val: 0, label: 'D' },
] as const;

/** Convierte fecha (YYYY-MM-DD) y hora (HH:mm) a ISO asumiendo hora local del navegador. */
function toISOFromLocal(date: string, hhmm: string) {
  if (!date || !hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const [y, mo, d] = date.split('-').map(Number);
  const dt = new Date(y, (mo || 1) - 1, d || 1, h || 0, m || 0, 0, 0);
  return dt.toISOString();
}

export default function CreateTaskPage() {
  const router = useRouter();

  // catálogos
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [loadingLookups, setLoadingLookups] = useState(true);

  // form
  const [name, setName] = useState('');            // antes title
  const [taskTypeId, setTaskTypeId] = useState('');
  const [date, setDate] = useState('');            // YYYY-MM-DD
  const [start, setStart] = useState('09:00');     // HH:mm
  const [end, setEnd] = useState('10:00');         // HH:mm
  const [observations, setObservations] = useState(''); // antes description
  const [selectedWorkers, setSelectedWorkers] = useState<string[]>([]);

  // recurrencia (UI conservada, backend no la usa aún)
  const [repeat, setRepeat] = useState(false);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [intervalWeeks, setIntervalWeeks] = useState(1);
  const [until, setUntil] = useState('');
  const [count, setCount] = useState<number | ''>('');

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');
  const [conflicts, setConflicts] = useState<Conflict[]>([]);

  // cargar catálogos
  useEffect(() => {
    (async () => {
      try {
        setLoadingLookups(true);
        const [wRes, ttRes] = await Promise.all([
          fetch('/api/workers', { cache: 'no-store' }),
          fetch('/api/taskTypes', { cache: 'no-store' }),
        ]);

        const wJson = await wRes.json().catch(() => []);
        const tJson = await ttRes.json().catch(() => []);
        const wArr = Array.isArray(wJson) ? wJson : Array.isArray(wJson?.data) ? wJson.data : [];
        const tArr = Array.isArray(tJson) ? tJson : Array.isArray(tJson?.data) ? tJson.data : [];

        setWorkers(wArr.map((w: any) => ({ id: w.id, username: w.username })));
        setTaskTypes(tArr.map((t: any) => ({ id: t.id, name: t.name, color: t.color ?? null })));
      } catch {
        // noop
      } finally {
        setLoadingLookups(false);
      }
    })();
  }, []);

  const toggleWeekday = (val: number) => {
    setWeekdays(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  };

  const validTimeRange = useMemo(() => {
    if (!start || !end) return true;
    return start < end; // HH:mm comparado como string funciona
  }, [start, end]);

  const canSubmit = useMemo(() => {
    if (!name || !taskTypeId || !date || !start || !end || selectedWorkers.length === 0) return false;
    if (!validTimeRange) return false;
    if (repeat) {
      if (weekdays.length === 0) return false;
      if (intervalWeeks < 1) return false;
      if (!until && !count) return false;
    }
    return true;
  }, [name, taskTypeId, date, start, end, selectedWorkers, repeat, weekdays, intervalWeeks, until, count, validTimeRange]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setConflicts([]);

    if (!canSubmit) return;

    // Construye ISO para backend
    const startISO = toISOFromLocal(date, start);
    const endISO = toISOFromLocal(date, end);

    try {
      setSubmitting(true);

      // Payload compatible con tu backend:
      // - Opción (date,start,end)  -> ya lo incluimos
      // - Opción (start,end) ISO   -> también lo incluimos
      // - Además enviamos observations y workerIds
      const payload = {
        name,
        taskTypeId,
        date,
        start,
        end,
        // variante ISO directa (por si el backend la prefiere)
        startTime: startISO,
        endTime: endISO,
        observations: observations || null,
        workerIds: selectedWorkers,
      };

      const res = await fetch('/api/tasks/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({} as any));

      if (!res.ok || !j?.success) {
        if (res.status === 409 && Array.isArray(j?.conflicts)) {
          setConflicts(j.conflicts as Conflict[]);
          setErr('Conflictos de agenda detectados. Revisa el detalle abajo.');
        } else {
          setErr(j?.error || j?.message || `HTTP ${res.status}`);
        }
        return;
      }

      // éxito → volver a /tasks
      router.push('/tasks');
    } catch (e: any) {
      setErr(e?.message || 'Error al crear la tarea');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Head><title>Nueva tarea · Emaus Teams App</title></Head>

      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Añadir tarea</h1>
          <Link href="/tasks" className="text-blue-600 hover:underline">Volver a Tareas</Link>
        </div>

        <form onSubmit={onSubmit} className="bg-white rounded-2xl shadow p-6 space-y-5">
          {err && <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{err}</div>}

          {/* Básicos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
                placeholder="Ej. Recogidas con la furgoneta"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de tarea</label>
              <select
                value={taskTypeId}
                onChange={e => setTaskTypeId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
                required
              >
                <option value="">Seleccionar…</option>
                {taskTypes.map(tt => (
                  <option key={tt.id} value={tt.id}>{tt.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Fecha y horas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Inicio</label>
              <input
                type="time"
                value={start}
                onChange={e => setStart(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fin</label>
              <input
                type="time"
                value={end}
                onChange={e => setEnd(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
                required
              />
              {!validTimeRange && <p className="text-xs text-red-600 mt-1">El fin debe ser posterior al inicio.</p>}
            </div>
          </div>

          {/* Trabajadores */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Trabajadores</label>
            {loadingLookups ? (
              <div className="text-sm text-gray-500">Cargando…</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {workers.map(w => {
                  const checked = selectedWorkers.includes(w.id);
                  return (
                    <label key={w.id} className="flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setSelectedWorkers(prev => checked ? prev.filter(id => id !== w.id) : [...prev, w.id])
                        }
                      />
                      <span>{w.username}</span>
                    </label>
                  );
                })}
              </div>
            )}
            {selectedWorkers.length === 0 && <p className="text-xs text-amber-600 mt-1">Selecciona al menos un trabajador.</p>}
          </div>

          {/* Observaciones */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
            <textarea
              value={observations}
              onChange={e => setObservations(e.target.value)}
              rows={3}
              className="w-full border rounded-lg px-3 py-2"
              placeholder="Opcional"
            />
          </div>

          {/* Repetición (UI) */}
          <div className="border-t pt-4">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input type="checkbox" checked={repeat} onChange={e => setRepeat(e.target.checked)} />
              Repetir esta tarea
            </label>

            {repeat && (
              <div className="mt-3 space-y-3">
                <div>
                  <div className="text-xs text-gray-500 mb-1">Días de la semana</div>
                  <div className="flex flex-wrap gap-2">
                    {WEEKDAYS.map(d => (
                      <button
                        key={d.val}
                        type="button"
                        onClick={() => toggleWeekday(d.val)}
                        className={
                          'px-3 py-1 rounded-full border ' +
                          (weekdays.includes(d.val)
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-700')
                        }
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                  {weekdays.length === 0 && <p className="text-xs text-amber-600 mt-1">Selecciona al menos un día.</p>}
                </div>

                <div className="flex flex-wrap items-end gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cada</label>
                    <input
                      type="number"
                      min={1}
                      value={intervalWeeks}
                      onChange={e => setIntervalWeeks(Math.max(1, Number(e.target.value || 1)))}
                      className="w-24 border rounded-lg px-3 py-2"
                    />
                    <span className="ml-2 text-sm text-gray-600">semana(s)</span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hasta (fecha)</label>
                    <input
                      type="date"
                      value={until}
                      onChange={e => setUntil(e.target.value)}
                      className="border rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">o Nº de repeticiones</label>
                    <input
                      type="number"
                      min={1}
                      value={count}
                      onChange={e => setCount(e.target.value ? Math.max(1, Number(e.target.value)) : '')}
                      className="w-28 border rounded-lg px-3 py-2"
                    />
                  </div>
                </div>

                {!until && !count && <p className="text-xs text-amber-600">Indica una fecha límite o un nº de repeticiones.</p>}
              </div>
            )}
          </div>

          {/* Conflictos */}
          {conflicts.length > 0 && (
            <div className="rounded-lg border border-red-300 bg-red-50 p-3">
              <div className="font-medium text-red-700 mb-2">Conflictos detectados</div>
              <div className="space-y-3 text-sm">
                {conflicts.map(c => (
                  <div key={c.workerId} className="bg-white rounded border p-2">
                    <div className="font-medium">{c.workerName || c.workerId}</div>
                    {c.tasks.length > 0 && (
                      <div className="mt-1">
                        <div className="text-gray-600">Tareas:</div>
                        <ul className="list-disc ml-5">
                          {c.tasks.map(t => (
                            <li key={t.id}>{t.name}{t.taskTypeName ? ` · ${t.taskTypeName}` : ''} — {t.startTime} → {t.endTime}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {c.leaves.length > 0 && (
                      <div className="mt-1">
                        <div className="text-gray-600">Ausencias aprobadas:</div>
                        <ul className="list-disc ml-5">
                          {c.leaves.map(l => (
                            <li key={l.id}>{l.type} — {l.startDate} → {l.endDate}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Acciones */}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={!canSubmit || submitting}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg"
            >
              {submitting ? 'Guardando…' : 'Crear tarea'}
            </button>
            <Link href="/tasks" className="px-4 py-2 rounded-lg border">Cancelar</Link>
          </div>
        </form>
      </div>
    </>
  );
}

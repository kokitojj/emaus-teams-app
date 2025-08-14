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
type OccConflict = { ymd: string; start: string; end: string; conflicts: Conflict[] };

const WEEKDAYS = [
  { val: 1, label: 'L' },
  { val: 2, label: 'M' },
  { val: 3, label: 'X' },
  { val: 4, label: 'J' },
  { val: 5, label: 'V' },
  { val: 6, label: 'S' },
  { val: 0, label: 'D' },
] as const;

export default function NewTaskPage() {
  const router = useRouter();

  const [workers, setWorkers] = useState<Worker[]>([]);
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [loadingLookups, setLoadingLookups] = useState(true);

  const [title, setTitle] = useState('');
  const [taskTypeId, setTaskTypeId] = useState('');
  const [date, setDate] = useState(''); // YYYY-MM-DD
  const [start, setStart] = useState('09:00'); // HH:mm
  const [end, setEnd] = useState('10:00'); // HH:mm
  const [description, setDescription] = useState('');
  const [selectedWorkers, setSelectedWorkers] = useState<string[]>([]);
  const [assignAllQualified, setAssignAllQualified] = useState(false);

  const [repeat, setRepeat] = useState(false);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [intervalWeeks, setIntervalWeeks] = useState(1);
  const [until, setUntil] = useState(''); // YYYY-MM-DD
  const [count, setCount] = useState<number | ''>('');

  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');
  const [occConflicts, setOccConflicts] = useState<OccConflict[]>([]);

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
    return start < end;
  }, [start, end]);

  const canSubmit = useMemo(() => {
    if (!title || !taskTypeId || !date || !start || !end) return false;
    if (!validTimeRange) return false;
    if (!assignAllQualified && selectedWorkers.length === 0) return false;
    if (repeat) {
      if (weekdays.length === 0) return false;
      if (intervalWeeks < 1) return false;
      if (!until && !count) return false;
    }
    return true;
  }, [title, taskTypeId, date, start, end, selectedWorkers, repeat, weekdays, intervalWeeks, until, count, validTimeRange, assignAllQualified]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setOccConflicts([]);
    if (!canSubmit) return;

    try {
      setSubmitting(true);
      const payload: any = {
        title,
        taskTypeId,
        date,
        start,
        end,
        description,
        workerIds: selectedWorkers,
        assignAllQualified,
      };
      if (repeat) {
        payload.repeat = true;
        payload.weekdays = weekdays;
        payload.intervalWeeks = intervalWeeks;
        if (until) payload.until = until;
        if (count) payload.count = count;
      }

      const res = await fetch('/api/tasks/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({} as any));

      if (!res.ok) {
        if (res.status === 409 && Array.isArray(j?.conflictsByOccurrence)) {
          setOccConflicts(j.conflictsByOccurrence as OccConflict[]);
          setErr('Conflictos de agenda detectados en una o más ocurrencias. Revisa el detalle abajo.');
        } else {
          setErr(j?.message || j?.error || `HTTP ${res.status}`);
        }
        return;
      }

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
          {err && <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 whitespace-pre-wrap">{err}</div>}

          {/* Básicos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
              <input value={title} onChange={e => setTitle(e.target.value)} className="w-full border rounded-lg px-3 py-2" placeholder="Ej. Recogidas con la furgoneta" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de tarea</label>
              <select value={taskTypeId} onChange={e => setTaskTypeId(e.target.value)} className="w-full border rounded-lg px-3 py-2" required>
                <option value="">Seleccionar…</option>
                {taskTypes.map(tt => (
                  <option key={tt.id} value={tt.id}>{tt.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Asignación */}
          <div className="border rounded-xl p-3">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input type="checkbox" checked={assignAllQualified} onChange={e => setAssignAllQualified(e.target.checked)} />
              Asignar automáticamente a todos los trabajadores cualificados para este tipo
            </label>
            {!assignAllQualified && (
              <>
                <div className="mt-2 text-xs text-gray-500">O selecciona manualmente:</div>
                {loadingLookups ? (
                  <div className="text-sm text-gray-500">Cargando…</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 mt-2">
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
                {selectedWorkers.length === 0 && <p className="text-xs text-amber-600 mt-1">Selecciona al menos un trabajador o activa la opción de cualificados.</p>}
              </>
            )}
          </div>

          {/* Fecha y horas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full border rounded-lg px-3 py-2" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Inicio</label>
              <input type="time" value={start} onChange={e => setStart(e.target.value)} className="w-full border rounded-lg px-3 py-2" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fin</label>
              <input type="time" value={end} onChange={e => setEnd(e.target.value)} className="w-full border rounded-lg px-3 py-2" required />
              {!validTimeRange && <p className="text-xs text-red-600 mt-1">El fin debe ser posterior al inicio.</p>}
            </div>
          </div>

          {/* Observaciones */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="w-full border rounded-lg px-3 py-2" placeholder="Opcional" />
          </div>

          {/* Repetición */}
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
                    <input type="number" min={1} value={intervalWeeks}
                           onChange={e => setIntervalWeeks(Math.max(1, Number(e.target.value || 1)))}
                           className="w-24 border rounded-lg px-3 py-2" />
                    <span className="ml-2 text-sm text-gray-600">semana(s)</span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hasta (fecha)</label>
                    <input type="date" value={until} onChange={e => setUntil(e.target.value)} className="border rounded-lg px-3 py-2" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">o Nº de repeticiones</label>
                    <input type="number" min={1}
                           value={count}
                           onChange={e => setCount(e.target.value ? Math.max(1, Number(e.target.value)) : '')}
                           className="w-28 border rounded-lg px-3 py-2" />
                  </div>
                </div>

                {!until && !count && <p className="text-xs text-amber-600">Indica una fecha límite o un nº de repeticiones.</p>}
              </div>
            )}
          </div>

          {/* Conflictos por ocurrencia */}
          {occConflicts.length > 0 && (
            <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
              <div className="font-medium mb-2">Conflictos detectados en las siguientes fechas:</div>
              <ul className="list-disc ml-5 space-y-1">
                {occConflicts.map((c) => (
                  <li key={c.ymd}>
                    <span className="font-semibold">{c.ymd}</span> — {c.conflicts.length} trabajador(es) en conflicto
                  </li>
                ))}
              </ul>
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

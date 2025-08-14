import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import ConflictsModal, { ConflictBundle } from '@/components/leaves/ConflictsModal';

type Worker = { id: string; username: string };
type TaskType = { id: string; name: string; color?: string | null };

type LoadedTask = {
  id: string;
  title: string;
  description?: string | null;
  date: string;            // YYYY-MM-DD
  startTimeHHmm: string;   // HH:mm
  endTimeHHmm: string;     // HH:mm
  taskTypeId: string;
  taskTypeName?: string | null;
  taskTypeColor?: string | null;
  workerIds: string[];
  workers: { id: string; username: string }[];
};

function toTimeStringSafe(v?: string) {
  if (!v) return '';
  const [h, m] = v.split(':');
  const hh = String(h ?? '00').padStart(2, '0');
  const mm = String(m ?? '00').padStart(2, '0');
  return `${hh}:${mm}`;
}

export default function EditTaskPage() {
  const router = useRouter();
  const { id } = router.query as { id?: string };

  const [workers, setWorkers] = useState<Worker[]>([]);
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [loadingLookups, setLoadingLookups] = useState(true);

  const [loadingTask, setLoadingTask] = useState(true);
  const [loadErr, setLoadErr] = useState('');

  const [title, setTitle] = useState('');
  const [taskTypeId, setTaskTypeId] = useState('');
  const [date, setDate] = useState('');          // YYYY-MM-DD
  const [start, setStart] = useState('09:00');   // HH:mm
  const [end, setEnd] = useState('10:00');       // HH:mm
  const [description, setDescription] = useState('');
  const [selectedWorkers, setSelectedWorkers] = useState<string[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');
  const [okMsg, setOkMsg] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [modalConflicts, setModalConflicts] = useState<ConflictBundle[]>([]);
  const [pendingForce, setPendingForce] = useState<{ payload: any; action: 'approve_unassign' | 'save_pending'; } | null>(null);

  const validTimeRange = useMemo(() => {
    if (!start || !end) return false;
    return start < end;
  }, [start, end]);

  const canSubmit = useMemo(() => {
    if (!title || !taskTypeId || !date || !start || !end || selectedWorkers.length === 0) return false;
    if (!validTimeRange) return false;
    return !submitting;
  }, [title, taskTypeId, date, start, end, selectedWorkers, submitting, validTimeRange]);

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

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        setLoadingTask(true);
        setLoadErr('');
        const res = await fetch(`/api/tasks/${id}`, { cache: 'no-store' });
        const j = await res.json();
        if (!res.ok || !j?.success) throw new Error(j?.message || j?.error || `HTTP ${res.status}`);
        const t: LoadedTask = j.task;

        setTitle(t.title || '');
        setTaskTypeId(t.taskTypeId || '');
        setDate(t.date || '');
        setStart(toTimeStringSafe(t.startTimeHHmm) || '09:00');
        setEnd(toTimeStringSafe(t.endTimeHHmm) || '10:00');
        setDescription(t.description || '');
        setSelectedWorkers(Array.isArray(t.workerIds) ? t.workerIds : []);
      } catch (e: any) {
        setLoadErr(e?.message || 'No se pudo cargar la tarea');
      } finally {
        setLoadingTask(false);
      }
    })();
  }, [id]);

  const toggleWorker = (wid: string) => {
    setSelectedWorkers(prev => prev.includes(wid) ? prev.filter(x => x !== wid) : [...prev, wid]);
  };

  async function submitPatch(force = false) {
    if (!id) return;
    const payload: any = {
      title,
      taskTypeId,
      date,
      start,
      end,
      description,
      workerIds: selectedWorkers,
    };
    if (force) payload.force = true;

    const res = await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setErr('');
    setOkMsg('');
    setSubmitting(true);

    try {
      let res = await submitPatch(false);

      if (res && res.status === 409) {
        const j = await res.json();
        setModalConflicts(j?.conflicts || []);
        setPendingForce({ payload: {}, action: 'save_pending' });
        setModalOpen(true);
        setSubmitting(false);
        return;
      }

      const j2 = await res?.json().catch(() => ({} as any));
      if (!res?.ok || !j2?.success) {
        setErr(j2?.message || j2?.error || `HTTP ${res?.status}`);
        setSubmitting(false);
        return;
      }

      setOkMsg('Tarea actualizada correctamente');
      setTimeout(() => router.push('/tasks'), 400);
    } catch (e: any) {
      setErr(e?.message || 'Error al guardar');
    } finally {
      if (!modalOpen) setSubmitting(false);
    }
  }

  async function handleModalAction(action: 'approve_unassign' | 'save_pending' | 'cancel') {
    if (action !== 'save_pending') {
      setModalOpen(false);
      setPendingForce(null);
      return;
    }
    try {
      setSubmitting(true);
      const res = await submitPatch(true);
      const j2 = await res?.json().catch(() => ({} as any));
      if (!res?.ok || !j2?.success) {
        setErr(j2?.message || j2?.error || `HTTP ${res?.status}`);
        setSubmitting(false);
        setModalOpen(false);
        setPendingForce(null);
        return;
      }
      setOkMsg('Tarea actualizada correctamente (forzada)');
      setModalOpen(false);
      setPendingForce(null);
      setTimeout(() => router.push('/tasks'), 400);
    } catch (e: any) {
      setErr(e?.message || 'Error al guardar');
      setSubmitting(false);
      setModalOpen(false);
      setPendingForce(null);
    }
  }

  return (
    <>
      <Head><title>Editar tarea · Emaus Teams App</title></Head>

      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Editar tarea</h1>
          <Link href="/tasks" className="text-blue-600 hover:underline">Volver a Tareas</Link>
        </div>

        {loadingTask ? (
          <div className="bg-white rounded-2xl shadow p-6">Cargando…</div>
        ) : loadErr ? (
          <div className="bg-white rounded-2xl shadow p-6 text-red-600">{loadErr}</div>
        ) : (
          <form onSubmit={onSubmit} className="bg-white rounded-2xl shadow p-6 space-y-5">
            {err && <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{err}</div>}
            {okMsg && <div className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-700">{okMsg}</div>}

            {/* Básicos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
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
                  onChange={e => setStart(toTimeStringSafe(e.target.value))}
                  className="w-full border rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fin</label>
                <input
                  type="time"
                  value={end}
                  onChange={e => setEnd(toTimeStringSafe(e.target.value))}
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
                          onChange={() => toggleWorker(w.id)}
                        />
                        <span>{w.username}</span>
                      </label>
                    );
                  })}
                </div>
              )}
              {selectedWorkers.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">Selecciona al menos un trabajador.</p>
              )}
            </div>

            {/* Observaciones */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                className="w-full border rounded-lg px-3 py-2"
                placeholder="Opcional"
              />
            </div>

            {/* Repetición (solo informativo por ahora) */}
            <div className="border-t pt-4 opacity-60 pointer-events-none">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input type="checkbox" checked={false} readOnly />
                Repetir esta tarea
              </label>
              <p className="text-xs text-gray-500 mt-2">
                Esta pantalla edita una única tarea. Podemos habilitar edición de series completas si lo necesitas.
              </p>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <div className="text-xs text-gray-500 mb-1">Días de la semana</div>
                  <div className="flex flex-wrap gap-2">
                    {['L','M','X','J','V','S','D'].map((d,i) => (
                      <span key={i} className="px-3 py-1 rounded-full border bg-white text-gray-400">{d}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Cada</div>
                  <input className="w-24 border rounded-lg px-3 py-2" value={1} readOnly />
                  <span className="ml-2 text-sm text-gray-600">semana(s)</span>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Hasta</div>
                  <input className="border rounded-lg px-3 py-2" value="" readOnly />
                </div>
              </div>
            </div>

            {/* Acciones */}
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={!canSubmit}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg"
              >
                {submitting ? 'Guardando…' : 'Guardar cambios'}
              </button>
              <Link href="/tasks" className="px-4 py-2 rounded-lg border">Cancelar</Link>
            </div>
          </form>
        )}
      </div>

      {/* Modal de conflictos (forzar guardado) */}
      <ConflictsModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        mode="create"
        conflicts={modalConflicts}
        onAction={handleModalAction}
      />
    </>
  );
}

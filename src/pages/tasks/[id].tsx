// src/pages/tasks/[id].tsx
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';

type Worker = { id: string; username: string };
type TaskType = {
  id: string;
  name: string;
  color?: string | null;
  qualifiedWorkers?: { id: string; username: string }[];
};
type TaskDTO = {
  id: string;
  title: string;
  description?: string | null;
  start: string; // ISO
  end: string;   // ISO
  taskTypeId: string | null;
  isCompleted?: boolean;
  workers?: Worker[];
  workerIds?: string[];
};

// ---- helpers de fecha/hora (LOCAL <-> ISO) ----
function toInputLocal(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const MM = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  return `${yyyy}-${MM}-${dd}T${hh}:${mm}`;
}
function fromInputLocalToISO(inputValue: string) {
  return new Date(inputValue).toISOString();
}

// ---- API helper ----
async function fetchTaskTypeDetail(id: string): Promise<TaskType | null> {
  try {
    const res = await fetch(`/api/taskTypes/${id}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as TaskType;
  } catch {
    return null;
  }
}

export default function EditTaskPage() {
  const router = useRouter();
  const { id } = router.query as { id?: string };
  const { status } = useSession();

  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState<TaskDTO | null>(null);
  const [allWorkers, setAllWorkers] = useState<Worker[]>([]);
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [qualifiedIds, setQualifiedIds] = useState<Set<string>>(new Set());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Carga inicial: tarea + workers + tipos
  useEffect(() => {
    if (!id || status === 'loading') return;
    if (status === 'unauthenticated') {
      setLoading(false);
      setErrorMsg('No autenticado.');
      return;
    }

    (async () => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const [taskRes, workersRes, typesRes] = await Promise.all([
          fetch(`/api/tasks/${id}`, { cache: 'no-store' }),
          fetch('/api/workers', { cache: 'no-store' }),
          fetch('/api/taskTypes', { cache: 'no-store' }),
        ]);
        if (!taskRes.ok) throw new Error('No se pudo cargar la tarea.');
        if (!workersRes.ok) throw new Error('No se pudieron cargar los trabajadores.');
        if (!typesRes.ok) throw new Error('No se pudieron cargar los tipos.');

        const t = (await taskRes.json()) as TaskDTO;
        const w = (await workersRes.json()) as Worker[];
        const tt = (await typesRes.json()) as TaskType[];

        setTask(t);
        setAllWorkers(Array.isArray(w) ? w : []);
        setTaskTypes(Array.isArray(tt) ? tt : []);

        // Selección inicial de trabajadores
        const initialIds = (t.workerIds && Array.isArray(t.workerIds))
          ? t.workerIds
          : (t.workers?.map(x => x.id) ?? []);
        setSelectedWorkerIds(initialIds);
      } catch (e: any) {
        setErrorMsg(e?.message ?? 'Error cargando datos.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, status]);

  // Calcular IDs calificados (no filtramos: solo etiquetamos)
  useEffect(() => {
    (async () => {
      if (!task?.taskTypeId) {
        setQualifiedIds(new Set());
        return;
      }
      const fromList = taskTypes.find(t => t.id === task.taskTypeId);
      const detail = fromList?.qualifiedWorkers ? fromList : await fetchTaskTypeDetail(task.taskTypeId);
      const ids = new Set((detail?.qualifiedWorkers ?? []).map(w => w.id));
      setQualifiedIds(ids);
    })();
  }, [task?.taskTypeId, taskTypes]);

  const canSave = useMemo(
    () => !!task && !!task.title && !!task.taskTypeId && selectedWorkerIds.length > 0,
    [task, selectedWorkerIds]
  );

  const onChangeTaskType = (newTypeId: string) => {
    setTask(prev => (prev ? { ...prev, taskTypeId: newTypeId } : prev));
    // mantenemos la selección actual: solo etiquetamos calificados, no ocultamos
  };

  const onChangeWorkers = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const ids = Array.from(e.target.selectedOptions).map(o => o.value);
    setSelectedWorkerIds(ids);
  };

  const setField = (field: keyof TaskDTO, value: any) => {
    setTask(prev => (prev ? { ...prev, [field]: value } : prev));
  };

  const save = async () => {
    if (!id || !task) return;
    try {
      const payload = {
        title: task.title,
        description: task.description ?? null,
        start: task.start,
        end: task.end,
        taskTypeId: task.taskTypeId,
        isCompleted: !!task.isCompleted,
        workerIds: selectedWorkerIds,
      };
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`No se pudo guardar: ${txt}`);
      }
      await router.push('/tasks');
    } catch (e: any) {
      setErrorMsg(e?.message ?? 'Error guardando la tarea.');
    }
  };

  if (status === 'loading' || loading) return <p className="p-8 text-center">Cargando…</p>;
  if (!task) return <p className="p-8 text-center text-red-600">{errorMsg || 'No se encontró la tarea.'}</p>;

  return (
    <>
      <Head><title>Editar Tarea | Emaus Teams App</title></Head>
      <div className="min-h-screen bg-gray-100 p-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Editar Tarea</h1>

        <div className="bg-white rounded-lg shadow-md p-6 space-y-4 max-w-3xl">
          {errorMsg && (
            <div className="p-3 rounded border border-red-200 bg-red-50 text-sm text-red-700">{errorMsg}</div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-600">Título</span>
              <input
                className="border rounded px-3 py-2"
                value={task.title || ''}
                onChange={e => setField('title', e.target.value)}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-600">Tipo de tarea</span>
              <select
                className="border rounded px-3 py-2"
                value={task.taskTypeId ?? ''}
                onChange={e => onChangeTaskType(e.target.value)}
              >
                {taskTypes.map(tt => (
                  <option key={tt.id} value={tt.id}>
                    {tt.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 md:col-span-2">
              <span className="text-sm text-gray-600">Trabajadores (puedes elegir varios)</span>
              <select
                className="border rounded px-3 py-2 min-h-[160px]"
                multiple
                value={selectedWorkerIds}
                onChange={onChangeWorkers}
              >
                {allWorkers.map(w => {
                  const isQualified = qualifiedIds.has(w.id);
                  return (
                    <option key={w.id} value={w.id}>
                      {w.username}{isQualified ? '' : ' (no calificado)'}
                    </option>
                  );
                })}
              </select>
              <span className="text-xs text-gray-500">
                Los “no calificados” se muestran para referencia; puedes seleccionarlos si lo necesitas.
              </span>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-600">Inicio</span>
              <input
                type="datetime-local"
                className="border rounded px-3 py-2"
                value={toInputLocal(task.start)}
                onChange={e => setField('start', fromInputLocalToISO(e.target.value))}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm text-gray-600">Fin</span>
              <input
                type="datetime-local"
                className="border rounded px-3 py-2"
                value={toInputLocal(task.end)}
                onChange={e => setField('end', fromInputLocalToISO(e.target.value))}
              />
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="h-5 w-5"
                checked={!!task.isCompleted}
                onChange={e => setField('isCompleted', e.target.checked)}
              />
              <span className="text-sm text-gray-600">Completada</span>
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-sm text-gray-600">Descripción</span>
            <textarea
              className="border rounded px-3 py-2 min-h-[96px]"
              value={task.description ?? ''}
              onChange={e => setField('description', e.target.value)}
            />
          </label>

          <div className="flex gap-3 pt-2">
            <button
              onClick={save}
              disabled={!canSave}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-60"
            >
              Guardar
            </button>
            <button
              onClick={() => router.push('/tasks')}
              className="px-4 py-2 rounded-lg border"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

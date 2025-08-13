// src/pages/admin/leaves/new.tsx
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import ConflictsModal, { ConflictBundle } from '@/components/leaves/ConflictsModal';

type LeaveType = 'baja' | 'vacaciones' | 'permiso';
type LeaveStatus = 'pendiente' | 'aprobado' | 'rechazado';

type Worker = { id: string; username: string };

type PostPayload = {
  workerId: string;
  type: LeaveType;
  startDate: string;         // YYYY-MM-DD
  endDate: string;           // YYYY-MM-DD
  reason?: string | null;
  status?: LeaveStatus;      // default pend.
  force?: boolean;           // reintentos
  unassign?: boolean;        // si aprobada+force => desasignar
};

function fmtDateISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function NewLeavePage() {
  const router = useRouter();

  // Catálogo
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loadingWorkers, setLoadingWorkers] = useState(true);

  // Form
  const [workerId, setWorkerId] = useState('');
  const [type, setType] = useState<LeaveType>('baja');
  const today = useMemo(() => fmtDateISO(new Date()), []);
  const [startDate, setStartDate] = useState<string>(today);
  const [endDate, setEndDate] = useState<string>(today);
  const [status, setStatus] = useState<LeaveStatus>('pendiente'); // por defecto pendiente
  const [reason, setReason] = useState<string>('');

  // UI
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');
  const [okMsg, setOkMsg] = useState('');

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalConflicts, setModalConflicts] = useState<ConflictBundle[]>([]);
  const [pendingPayload, setPendingPayload] = useState<PostPayload | null>(null);

  // Cargar trabajadores
  useEffect(() => {
    (async () => {
      try {
        setLoadingWorkers(true);
        const res = await fetch('/api/workers', { cache: 'no-store' });
        const j = await res.json().catch(() => []);
        const arr = Array.isArray(j) ? j : Array.isArray(j?.data) ? j.data : [];
        setWorkers(arr.map((w: any) => ({ id: w.id, username: w.username })));
      } catch {
        setWorkers([]);
      } finally {
        setLoadingWorkers(false);
      }
    })();
  }, []);

  const canSubmit =
    workerId && type && startDate && endDate && new Date(endDate) >= new Date(startDate) && !submitting;

  async function postLeave(payload: PostPayload) {
    const res = await fetch('/api/leave', {
      method: 'POST',
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

    const basePayload: PostPayload = {
      workerId,
      type,
      startDate,
      endDate,
      reason: reason || undefined,
      status, // puede ser 'pendiente' o 'aprobado' según selecciones
    };

    try {
      // 1º intento normal
      let res = await postLeave(basePayload);

      if (res.status === 409) {
        const j = await res.json();
        setModalConflicts(j?.conflicts || []);
        setPendingPayload(basePayload);
        setModalOpen(true);
        setSubmitting(false);
        return; // espera a la acción del modal
      }

      const j2 = await res.json().catch(() => ({} as any));
      if (!res.ok || !j2?.success) {
        setErr(j2?.error || `HTTP ${res.status}`);
        setSubmitting(false);
        return;
      }

      setOkMsg(
        j2.unassignedTasks != null
          ? `Guardado correctamente. Tareas desasignadas: ${j2.unassignedTasks}`
          : 'Guardado correctamente.'
      );

      setTimeout(() => router.push('/admin/leave'), 400);
    } catch (e: any) {
      setErr(e?.message || 'Error al crear la ausencia');
      setSubmitting(false);
    }
  }

  // Acción del modal
  async function handleModalAction(action: 'approve_unassign' | 'save_pending' | 'cancel') {
    if (!pendingPayload) {
      setModalOpen(false);
      return;
    }
    if (action === 'cancel') {
      setModalOpen(false);
      return;
    }

    setSubmitting(true);
    try {
      let res: Response;
      if (action === 'save_pending') {
        // Guardar como PENDIENTE igualmente (no desasigna)
        res = await postLeave({ ...pendingPayload, status: 'pendiente', force: true });
      } else {
        // Aprobar y DESASIGNAR (transacción)
        res = await postLeave({ ...pendingPayload, status: 'aprobado', force: true, unassign: true });
      }

      const j2 = await res.json().catch(() => ({} as any));
      if (!res.ok || !j2?.success) {
        setErr(j2?.error || `HTTP ${res.status}`);
        setSubmitting(false);
        setModalOpen(false);
        return;
      }

      setOkMsg(
        j2.unassignedTasks != null
          ? `Guardado correctamente. Tareas desasignadas: ${j2.unassignedTasks}`
          : 'Guardado correctamente.'
      );
      setModalOpen(false);
      setTimeout(() => router.push('/admin/leave'), 400);
    } catch (e: any) {
      setErr(e?.message || 'Error al crear la ausencia');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Head>
        <title>Nueva ausencia · Emaus Teams App</title>
      </Head>

      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Crear ausencia</h1>
          <Link href="/admin/leave" className="text-blue-600 hover:underline">
            Volver
          </Link>
        </div>

        <form onSubmit={onSubmit} className="bg-white rounded-2xl shadow p-6 space-y-5">
          {err && <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{err}</div>}
          {okMsg && <div className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-700">{okMsg}</div>}

          {/* Trabajador */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Trabajador</label>
            {loadingWorkers ? (
              <div className="text-sm text-gray-500">Cargando…</div>
            ) : (
              <select
                value={workerId}
                onChange={(e) => setWorkerId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
                required
              >
                <option value="">Seleccionar…</option>
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.username}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Tipo y Estado */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as LeaveType)}
                className="w-full border rounded-lg px-3 py-2"
                required
              >
                <option value="baja">Baja</option>
                <option value="vacaciones">Vacaciones</option>
                <option value="permiso">Permiso</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as LeaveStatus)}
                className="w-full border rounded-lg px-3 py-2"
                required
              >
                <option value="pendiente">Pendiente</option>
                <option value="aprobado">Aprobado</option>
                <option value="rechazado">Rechazado</option>
              </select>
            </div>
          </div>

          {/* Fechas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
                required
              />
              {new Date(endDate) < new Date(startDate) && (
                <p className="text-xs text-red-600 mt-1">La fecha fin debe ser posterior o igual a la de inicio.</p>
              )}
            </div>
          </div>

          {/* Motivo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Motivo (opcional)</label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
              placeholder="Añade detalles si lo ves útil"
            />
          </div>

          {/* Acciones */}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={!canSubmit}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg"
            >
              {submitting ? 'Guardando…' : 'Guardar'}
            </button>
            <Link href="/admin/leave" className="px-4 py-2 rounded-lg border">
              Cancelar
            </Link>
          </div>

          {/* Ayuda */}
          <div className="text-xs text-gray-500 border-t pt-4">
            <p>
              Si existen tareas que se solapan con el rango seleccionado, se abrirá un diálogo para que elijas si deseas
              <strong> aprobar y desasignar</strong> o <strong>guardar como pendiente</strong>.
            </p>
          </div>
        </form>
      </div>

      {/* Modal de conflictos */}
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

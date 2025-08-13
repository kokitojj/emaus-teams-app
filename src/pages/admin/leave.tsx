// src/pages/admin/leave.tsx
import Head from 'next/head';
import { useEffect, useMemo, useState } from 'react';
import ConflictsModal, { ConflictBundle } from '@/components/leaves/ConflictsModal';

type LeaveStatus = 'pendiente' | 'aprobado' | 'rechazado';
type LeaveType = 'baja' | 'vacaciones' | 'permiso';

type Worker = { id: string; username: string; email?: string | null };
type LeaveRequest = {
  id: string;
  type: LeaveType | string;
  startDate: string | Date;
  endDate: string | Date;
  reason?: string | null;
  status: LeaveStatus | string;
  reviewedAt?: string | null;
  worker: Worker;
};

type ApiResp = {
  success?: boolean;
  data?: LeaveRequest[];
  requests?: LeaveRequest[];
  pagination?: { page: number; pageSize: number; total: number; totalPages: number };
  error?: string;
};

const coerceArray = (j: any): LeaveRequest[] =>
  Array.isArray(j) ? j : Array.isArray(j?.data) ? j.data : Array.isArray(j?.requests) ? j.requests : [];

const fmtShort = (d: string | Date) =>
  new Date(d).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: undefined });

/** Construye un texto legible con la lista de conflictos (para fallbacks si quisieras alert) */
function buildConflictText(conflicts: any[]): string {
  try {
    const parts: string[] = [];
    for (const c of conflicts || []) {
      const header = `Trabajador: ${c.workerName || c.workerId}`;
      const tasks =
        Array.isArray(c.tasks) && c.tasks.length
          ? '\nTareas:\n' +
            c.tasks
              .map(
                (t: any) =>
                  `• ${t.name}${t.taskTypeName ? ' · ' + t.taskTypeName : ''} — ${new Date(t.startTime).toLocaleString(
                    'es-ES',
                    { dateStyle: 'short', timeStyle: 'short' }
                  )} → ${new Date(t.endTime).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}`
              )
              .join('\n')
          : '\nTareas: (ninguna)';
      parts.push(`${header}${tasks}`);
    }
    return parts.join('\n\n');
  } catch {
    return '';
  }
}

export default function AdminLeavePage() {
  // filtros
  const [type, setType] = useState<string>('');       // '' = todos
  const [status, setStatus] = useState<string>('');   // '' = todos
  const [dateFrom, setDateFrom] = useState<string>(''); // yyyy-mm-dd
  const [dateTo, setDateTo] = useState<string>('');
  const [sortBy, setSortBy] = useState<'startDate' | 'endDate' | 'status' | 'type' | 'reviewedAt'>('startDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // paginación
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // datos
  const [rows, setRows] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [pagination, setPagination] = useState<ApiResp['pagination']>({
    page: 1, pageSize, total: 0, totalPages: 1,
  });

  // modal aprobar
  const [modalOpen, setModalOpen] = useState(false);
  const [modalConflicts, setModalConflicts] = useState<ConflictBundle[]>([]);
  const [pendingApproveId, setPendingApproveId] = useState<string | null>(null);

  const qs = useMemo(() => {
    const u = new URLSearchParams();
    if (type) u.set('type', type);
    if (status) u.set('status', status);
    if (dateFrom) u.set('dateFrom', dateFrom);
    if (dateTo) u.set('dateTo', dateTo);
    u.set('sortBy', sortBy);
    u.set('sortOrder', sortOrder);
    u.set('page', String(page));
    u.set('pageSize', String(pageSize));
    return u.toString();
  }, [type, status, dateFrom, dateTo, sortBy, sortOrder, page, pageSize]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      setErr('');
      const res = await fetch(`/api/leave?${qs}`, { cache: 'no-store' });
      const j: ApiResp = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(j?.error || `HTTP ${res.status}`);
      const list = coerceArray(j);
      setRows(list);
      setPagination(j.pagination ?? { page, pageSize, total: list.length, totalPages: 1 });
    } catch (e: any) {
      setErr(e?.message || 'No se pudieron cargar las solicitudes');
      setRows([]);
      setPagination({ page: 1, pageSize, total: 0, totalPages: 1 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRequests(); }, [qs]);

  const resetFilters = () => {
    setType('');
    setStatus('');
    setDateFrom('');
    setDateTo('');
    setSortBy('startDate');
    setSortOrder('desc');
    setPage(1);
  };

  /** Aprobar / Rechazar con modal en caso de conflictos */
  const handleStatusChange = async (id: string, newStatus: 'aprobado' | 'rechazado') => {
    const verb = newStatus === 'aprobado' ? 'aprobar' : 'rechazar';
    if (!confirm(`¿Estás seguro de ${verb} esta solicitud?`)) return;

    try {
      // Primer intento (normal)
      let res = await fetch('/api/leave/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      });

      if (res.status === 409) {
        const j = await res.json().catch(() => ({} as any));
        setModalConflicts(j?.conflicts || []);
        setPendingApproveId(id);
        setModalOpen(true);
        return; // espera acción del modal
      }

      const j2 = await res.json().catch(() => ({} as any));
      if (!res.ok || !j2?.success) throw new Error(j2?.error || `HTTP ${res.status}`);

      await fetchRequests();
      alert(
        j2.unassignedTasks != null
          ? `Solicitud actualizada. Tareas desasignadas: ${j2.unassignedTasks}`
          : 'Solicitud actualizada correctamente'
      );
    } catch (e: any) {
      alert(`Error: ${e?.message || 'desconocido'}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar la solicitud seleccionada? Esta acción es irreversible.')) return;
    try {
      const res = await fetch(`/api/leave?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const j = await res.json().catch(() => ({} as any));
      if (!res.ok || !j?.success) throw new Error(j?.error || `HTTP ${res.status}`);
      await fetchRequests();
    } catch (e: any) {
      alert(`Error eliminando: ${e?.message || 'desconocido'}`);
    }
  };

  // Acción del modal al aprobar
  async function handleApproveModalAction(action: 'approve_unassign' | 'save_pending' | 'cancel') {
    if (action !== 'approve_unassign' || !pendingApproveId) {
      setModalOpen(false);
      setPendingApproveId(null);
      return;
    }
    try {
      const res = await fetch('/api/leave/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: pendingApproveId, status: 'aprobado', force: true, unassign: true }),
      });
      const j2 = await res.json().catch(() => ({} as any));
      if (!res.ok || !j2?.success) throw new Error(j2?.error || `HTTP ${res.status}`);
      await fetchRequests();
      alert(
        j2.unassignedTasks != null
          ? `Solicitud aprobada. Tareas desasignadas: ${j2.unassignedTasks}`
          : 'Solicitud aprobada correctamente'
      );
    } catch (e: any) {
      alert(`Error: ${e?.message || 'desconocido'}`);
    } finally {
      setModalOpen(false);
      setPendingApproveId(null);
    }
  }

  return (
    <>
      <Head><title>Administración · Solicitudes</title></Head>

      <div className="p-6 space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Solicitudes</h1>
            <p className="text-sm text-gray-500">Bajas, permisos y vacaciones</p>
          </div>
          <a href="/admin/leaves/new" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
            + Crear
          </a>
        </header>

        {/* Filtros */}
        <section className="bg-white rounded-2xl shadow p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div>
              <label className="block text-xs text-gray-500">Tipo</label>
              <select value={type} onChange={e => { setType(e.target.value); setPage(1); }} className="w-full border rounded px-3 py-2">
                <option value="">(Todos)</option>
                <option value="baja">Baja</option>
                <option value="vacaciones">Vacaciones</option>
                <option value="permiso">Permiso</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500">Estado</label>
              <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className="w-full border rounded px-3 py-2">
                <option value="">(Todos)</option>
                <option value="pendiente">Pendiente</option>
                <option value="aprobado">Aprobado</option>
                <option value="rechazado">Rechazado</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500">Desde</label>
              <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-xs text-gray-500">Hasta</label>
              <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} className="w-full border rounded px-3 py-2" />
            </div>
            <div className="flex items-end gap-2">
              <button onClick={resetFilters} className="border rounded px-3 py-2 w-full">Reset</button>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <label className="text-xs text-gray-500">Ordenar por</label>
            <select value={sortBy} onChange={e => { setSortBy(e.target.value as any); setPage(1); }} className="border rounded px-2 py-1">
              <option value="startDate">Inicio</option>
              <option value="endDate">Fin</option>
              <option value="status">Estado</option>
              <option value="type">Tipo</option>
              <option value="reviewedAt">Revisado</option>
            </select>
            <select value={sortOrder} onChange={e => { setSortOrder(e.target.value as any); setPage(1); }} className="border rounded px-2 py-1">
              <option value="asc">Asc</option>
              <option value="desc">Desc</option>
            </select>
          </div>
        </section>

        {/* Tabla */}
        <section className="bg-white rounded-2xl shadow overflow-hidden">
          {loading ? (
            <div className="p-6 text-sm text-gray-500">Cargando…</div>
          ) : err ? (
            <div className="p-6 text-sm text-red-600">{err}</div>
          ) : rows.length === 0 ? (
            <div className="p-6 text-sm text-gray-500 text-center">No hay solicitudes.</div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trabajador</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Inicio</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fin</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revisado</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rows.map((req) => (
                  <tr key={req.id}>
                    <td className="px-6 py-3 text-sm">{req.worker?.username ?? '—'}</td>
                    <td className="px-6 py-3 text-sm capitalize">{req.type}</td>
                    <td className="px-6 py-3 text-sm">{fmtShort(req.startDate)}</td>
                    <td className="px-6 py-3 text-sm">{fmtShort(req.endDate)}</td>
                    <td className="px-6 py-3 text-sm">
                      <span className={
                        'px-2 py-1 rounded text-white text-xs ' +
                        (req.status === 'aprobado'
                          ? 'bg-green-600'
                          : req.status === 'rechazado'
                          ? 'bg-red-600'
                          : 'bg-yellow-600')
                      }>
                        {req.status}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm">{req.reviewedAt ? fmtShort(req.reviewedAt) : '—'}</td>
                    <td className="px-6 py-3 text-right text-sm">
                      {req.status === 'pendiente' && (
                        <>
                          <button
                            onClick={() => handleStatusChange(req.id, 'aprobado')}
                            className="text-green-700 hover:text-green-900 mr-4"
                          >
                            Aprobar
                          </button>
                          <button
                            onClick={() => handleStatusChange(req.id, 'rechazado')}
                            className="text-yellow-700 hover:text-yellow-900 mr-4"
                          >
                            Rechazar
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleDelete(req.id)}
                        className="text-white bg-red-600 hover:bg-red-700 px-3 py-1 rounded"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Paginación */}
        <section className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Página {pagination?.page ?? page} de {pagination?.totalPages ?? 1} · {pagination?.total ?? rows.length} resultados
          </div>
          <div className="flex items-center gap-2">
            <button
              className="border rounded px-3 py-1 disabled:opacity-50"
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={(pagination?.page ?? page) <= 1}
            >
              Anterior
            </button>
            <button
              className="border rounded px-3 py-1 disabled:opacity-50"
              onClick={() => setPage((p) => Math.min(p + 1, pagination?.totalPages ?? 1))}
              disabled={(pagination?.page ?? page) >= (pagination?.totalPages ?? 1)}
            >
              Siguiente
            </button>
          </div>
        </section>
      </div>

      {/* Modal de conflictos para aprobar */}
      <ConflictsModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        mode="approve"
        conflicts={modalConflicts}
        onAction={handleApproveModalAction}
      />
    </>
  );
}

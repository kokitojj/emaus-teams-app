import Modal from '@/components/ui/Modal';

export type ConflictTask = {
  id: string;
  name: string;
  taskTypeName?: string;
  startTime: string; // ISO
  endTime: string;   // ISO
};

export type ConflictLeave = {
  id: string;
  type: string;
  startDate: string; // ISO
  endDate: string;   // ISO
};

export type ConflictBundle = {
  workerId: string;
  workerName?: string;
  tasks: ConflictTask[];
  leaves?: ConflictLeave[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  /** 'approve' si estabas aprobando una ausencia; 'create' si creas/editar tarea -> usamos 'create' */
  mode: 'approve' | 'create';
  conflicts: ConflictBundle[];
  onAction: (action: 'approve_unassign' | 'save_pending' | 'cancel') => void;
};

export default function ConflictsModal({ open, onClose, mode, conflicts, onAction }: Props) {
  const c = conflicts?.[0];

  return (
    <Modal
      open={open}
      onClose={() => { onAction('cancel'); onClose(); }}
      title="Conflictos con agenda"
      size="xl"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => { onAction('cancel'); onClose(); }}
            className="px-4 py-2 rounded-lg border hover:bg-gray-100"
          >
            Cancelar
          </button>

          {mode === 'create' && (
            <button
              onClick={() => { onAction('save_pending'); onClose(); }}
              className="px-4 py-2 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
              title="Guardar igualmente (forzar)"
            >
              Guardar igualmente
            </button>
          )}

          {mode === 'approve' && (
            <button
              onClick={() => { onAction('approve_unassign'); onClose(); }}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
              title="Aprobar y desasignar al trabajador de las tareas en conflicto"
            >
              Aprobar y desasignar
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-gray-600">
          Se detectaron <strong>tareas y/o ausencias</strong> que se solapan con el rango indicado.
        </p>

        <div className="mt-3 rounded-xl border bg-gray-50">
          <div className="px-4 py-2 border-b text-sm font-medium">
            {c ? `Trabajador: ${c.workerName || c.workerId}` : 'Conflictos'}
          </div>

          <div className="max-h-72 overflow-auto divide-y">
            {/* Tareas */}
            <div className="px-4 py-3">
              <div className="text-xs uppercase text-gray-500 mb-1">Tareas</div>
              {c?.tasks?.length ? (
                <ul className="space-y-1 text-sm">
                  {c.tasks.map(t => (
                    <li key={t.id}>
                      <div className="font-medium">{t.name}{t.taskTypeName ? ` · ${t.taskTypeName}` : ''}</div>
                      <div className="text-gray-600">
                        {new Date(t.startTime).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })} →{' '}
                        {new Date(t.endTime).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-gray-500">No hay tareas en conflicto.</div>
              )}
            </div>

            {/* Leaves */}
            <div className="px-4 py-3">
              <div className="text-xs uppercase text-gray-500 mb-1">Ausencias</div>
              {c?.leaves?.length ? (
                <ul className="space-y-1 text-sm">
                  {c.leaves.map(l => (
                    <li key={l.id}>
                      <div className="font-medium capitalize">{l.type}</div>
                      <div className="text-gray-600">
                        {new Date(l.startDate).toLocaleDateString('es-ES')} → {new Date(l.endDate).toLocaleDateString('es-ES')}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-gray-500">No hay ausencias en conflicto.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// =============================================
// app/api/calendar/events/[id]/route.ts — reprogramar / reasignar (PATCH)
// =============================================

// file: app/api/calendar/events/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    const body = await req.json();
    const { start, end, workerId } = body as {
      start?: string;
      end?: string;
      workerId?: string | null;
    };

    // Validaciones mínimas
    const data: any = {};
    if (start) data.startTime = new Date(start);
    if (end) data.endTime = new Date(end);

    // Si llega workerId, reasignamos la relación M-N (simplificamos: dejamos solo ese worker)
    if (typeof workerId !== 'undefined') {
      data.workers = workerId
        ? { set: [{ id: workerId }] }
        : { set: [] };
    }

    const updated = await prisma.task.update({
      where: { id },
      data,
      include: { taskType: true, workers: { select: { id: true, username: true } } },
    });

    return NextResponse.json({
      event: {
        id: updated.id,
        title: updated.name,
        start: updated.startTime,
        end: updated.endTime,
        resourceId: updated.workers?.[0]?.id ?? undefined,
        taskTypeName: updated.taskType?.name,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';

type WorkerLite = { id: string; username: string };

export async function GET() {
  await requireRole(['admin', 'supervisor']);

  const workers = await prisma.worker.findMany({
    select: { id: true, username: true },
    orderBy: { username: 'asc' },
  });

  const resources = workers.map((w: WorkerLite) => ({
    resourceId: w.id,
    resourceTitle: w.username,
  }));

  return NextResponse.json({ resources });
}

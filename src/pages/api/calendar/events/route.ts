import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const workerId = searchParams.get('workerId') || undefined;

  try {
    const events = await prisma.event.findMany({
      where: {
        ...(from && to ? { start: { gte: new Date(from) }, end: { lte: new Date(to) } } : {}),
        ...(workerId ? { workerId } : {}),
      },
      orderBy: { start: 'asc' },
      select: { id: true, title: true, start: true, end: true, workerId: true },
    });
    console.log('USANDO APP ROUTER')
    // ⬇️ DEVOLVER ARRAY DIRECTO
    return NextResponse.json(events, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

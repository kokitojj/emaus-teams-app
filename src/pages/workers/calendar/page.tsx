
// =====================================================
// Páginas protegidas (App Router)
// =====================================================
// file: app/(protected)/worker/calendar/page.tsx
import WorkerCalendar from '@/components/calendar/WorkerCalendar';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function Page() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const workerId = (session.user as any).workerId as string | undefined;
  if (!workerId) redirect('/');
  return (
    <main className="max-w-7xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Mi calendario</h1>
      <WorkerCalendar workerId={workerId} />
    </main>
  );
}
// file: app/(protected)/admin/calendar/page.tsx
import AdminCalendar from '@/components/calendar/AdminCalendar';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function Page() {
  const session = await auth();
  const role = (session?.user as any)?.role ?? 'empleado';
  if (!['admin', 'supervisor'].includes(role)) redirect('/');
  return (
    <main className="max-w-7xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Calendario general</h1>
      <AdminCalendar />
    </main>
  );
}
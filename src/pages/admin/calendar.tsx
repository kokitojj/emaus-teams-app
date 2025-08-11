import dynamic from 'next/dynamic';

const AdminCalendar = dynamic(() => import('../../components/calendar/AdminCalendar'), { ssr: false });

export default function AdminCalendarPage() {
  return (
    <main className="max-w-7xl mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-4">Calendario general</h1>
      <AdminCalendar />
    </main>
  );
}

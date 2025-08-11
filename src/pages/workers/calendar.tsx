import dynamic from 'next/dynamic';
import type { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../api/auth/[...nextauth]';

const WorkerCalendar = dynamic(() => import('../../components/calendar/WorkerCalendar'), { ssr: false });

export default function WorkerCalendarPage({ workerId }: { workerId: string }) {
  return (
    <main className="max-w-7xl mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-4">Mi calendario</h1>
      <WorkerCalendar workerId={workerId} />
    </main>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user) return { redirect: { destination: '/login', permanent: false } };
  const workerId = (session.user as any).workerId as string | undefined;
  if (!workerId) return { redirect: { destination: '/', permanent: false } };
  return { props: { workerId } };
};

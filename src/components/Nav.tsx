// src/components/Nav.tsx

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';

export default function Nav() {
  const { data: session, status } = useSession();
  const loading = status === 'loading';
  const role = session?.user?.role as string;

  return (
    <nav className="bg-gray-800 p-4 text-white shadow-md">
      <div className="container mx-auto flex justify-between items-center">
        <Link href="/">
          <p className="text-xl font-bold hover:text-gray-300 transition-colors cursor-pointer">Emaus Teams App</p>
        </Link>
        <div className="flex items-center space-x-4">
          {loading ? (
            <p className="text-gray-400">Cargando...</p>
          ) : session ? (
            <>
              <span className="text-gray-300">Hola, {session.user?.username || session.user?.email || 'Usuario'}</span>
              
              {/* Enlaces para todos los usuarios autenticados */}
              {/* <Link href="/">
                <p className="hover:text-gray-300 transition-colors cursor-pointer">Dashboard</p>
              </Link> */}

              {/* Enlaces condicionales por rol */}
              {role === 'empleado' && (
                <>
                  <Link href="/tasks/my-tasks">
                    <p className="hover:text-gray-300 transition-colors cursor-pointer">Mis Tareas</p>
                  </Link>
                  <Link href="/leave/my-requests">
                    <p className="hover:text-gray-300 transition-colors cursor-pointer">Mis Solicitudes</p>
                  </Link>
                </>
              )}
              {(role === 'supervisor' || role === 'admin') && (
                <>
                  <Link href="/workers">
                    <p className="hover:text-gray-300 transition-colors cursor-pointer">Trabajadores</p>
                  </Link>
                  <Link href="/tasks">
                    <p className="hover:text-gray-300 transition-colors cursor-pointer">Tareas</p>
                  </Link>
                  <Link href="/taskTypes">
                    <p className="hover:text-gray-300 transition-colors cursor-pointer">Tipos de Tareas</p>
                  </Link>
                  <Link href="/leave">
                    <p className="hover:text-gray-300 transition-colors cursor-pointer">Gestionar Solicitudes</p>
                  </Link>
                </>
              )}

              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-1 px-3 rounded-lg transition-colors"
              >
                Cerrar Sesión
              </button>
            </>
          ) : (
            <>
              <Link href="/login">
                <p className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1 px-3 rounded-lg transition-colors cursor-pointer">
                  Iniciar Sesión
                </p>
              </Link>
              <Link href="/register">
                <p className="hover:text-gray-300 transition-colors cursor-pointer">Registrarse</p>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
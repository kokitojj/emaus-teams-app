// src/components/Nav.tsx
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useSession, signOut } from 'next-auth/react';
import { useEffect, useMemo, useState } from 'react';

type NavItem = { href: string; label: string };

function ActiveLink({ href, label, onClick }: { href: string; label: string; onClick?: () => void }) {
  const router = useRouter();
  const isActive = router.pathname === href;
  return (
    <Link
      href={href}
      onClick={onClick}
      className={
        'px-3 py-2 rounded-lg text-sm font-medium transition-colors ' +
        (isActive ? 'bg-white/10 text-white' : 'text-gray-200 hover:text-white hover:bg-white/10')
      }
    >
      {label}
    </Link>
  );
}

function UserBadge({ name, email }: { name?: string | null; email?: string | null }) {
  const initials = useMemo(() => {
    const base = name || email || 'U';
    return base
      .split(/[.\s@_-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(s => s[0]?.toUpperCase())
      .join('');
  }, [name, email]);
  return (
    <div className="h-8 w-8 rounded-full bg-white/20 text-white flex items-center justify-center text-xs font-semibold">
      {initials || 'U'}
    </div>
  );
}

export default function Nav() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const loading = status === 'loading';

  const role = (session?.user as any)?.role as string | undefined;
  const username = (session?.user as any)?.username as string | undefined;
  const email = (session?.user as any)?.email as string | undefined;

  // Cierra el menú móvil al navegar
  useEffect(() => {
    const handle = () => setOpen(false);
    router.events.on('routeChangeStart', handle);
    return () => router.events.off('routeChangeStart', handle);
  }, [router.events]);

  // Mapas de enlaces por rol
  const commonAuthed: NavItem[] = [];
  const employeeOnly: NavItem[] = [
    { href: '/tasks/my-tasks', label: 'Mis Tareas' },
    { href: '/leave/my-requests', label: 'Mis Solicitudes' },
  ];
  const managerOnly: NavItem[] = [
    { href: '/workers', label: 'Trabajadores' },
    { href: '/tasks', label: 'Tareas' },
    { href: '/taskTypes', label: 'Tipos de Tareas' },
    { href: '/admin/leave', label: 'Gestionar Solicitudes' },
  ];

  const menuAuthed = useMemo(() => {
    if (!role) return commonAuthed;
    if (role === 'empleado') return [...commonAuthed, ...employeeOnly];
    // supervisor / admin
    return [...commonAuthed, ...managerOnly];
  }, [role]);

  return (
    <nav className="sticky top-0 z-40 w-full bg-gray-800/95 backdrop-blur supports-[backdrop-filter]:bg-gray-800/80 shadow">
      <div className="mx-auto max-w-7xl px-3 sm:px-4 md:px-6">
        <div className="flex h-14 items-center justify-between">
          {/* Brand */}
          <Link
            href="/"
            className="flex items-center gap-2 text-white font-bold tracking-tight"
            aria-label="Ir al dashboard"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white text-sm">ET</span>
            <span className="hidden sm:inline">Emaus Teams App</span>
            <span className="sm:hidden">Emaus</span>
          </Link>

          {/* Desktop menu */}
          <div className="hidden md:flex items-center gap-2">
            {loading ? (
              <span className="text-gray-300 text-sm">Cargando…</span>
            ) : session ? (
              <>
                {menuAuthed.map(item => (
                  <ActiveLink key={item.href} href={item.href} label={item.label} />
                ))}
                <div className="mx-2 h-6 w-px bg-white/20" />
                <div className="flex items-center gap-2">
                  <UserBadge name={username} email={email} />
                  <span className="hidden lg:inline text-sm text-gray-200">
                    {username || email || 'Usuario'}
                    {role ? <span className="ml-2 rounded bg-white/10 px-2 py-0.5 text-[11px] uppercase tracking-wide">{role}</span> : null}
                  </span>
                  <button
                    onClick={() => signOut({ callbackUrl: '/login' })}
                    className="ml-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-3 py-2"
                  >
                    Cerrar sesión
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-3 py-2"
                >
                  Iniciar sesión
                </Link>
                <Link
                  href="/register"
                  className="rounded-lg text-gray-200 hover:text-white hover:bg-white/10 px-3 py-2 text-sm"
                >
                  Registrarse
                </Link>
              </div>
            )}
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden inline-flex items-center justify-center rounded-lg p-2 text-gray-200 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/40"
            aria-controls="mobile-menu"
            aria-expanded={open}
            onClick={() => setOpen(v => !v)}
          >
            <span className="sr-only">Abrir menú</span>
            <svg
              className={`h-6 w-6 transition-transform ${open ? 'rotate-90' : ''}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              {open ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        id="mobile-menu"
        className={`md:hidden overflow-hidden transition-[max-height,opacity] duration-300 ${
          open ? 'max-h-[420px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-3 pb-3">
          {loading ? (
            <div className="py-2 px-2 text-gray-300 text-sm">Cargando…</div>
          ) : session ? (
            <>
              <div className="flex items-center gap-2 px-2 py-2">
                <UserBadge name={username} email={email} />
                <div className="flex-1">
                  <div className="text-white text-sm">{username || email || 'Usuario'}</div>
                  {role ? <div className="text-[11px] text-white/70 uppercase">{role}</div> : null}
                </div>
              </div>
              <div className="mt-1 flex flex-col gap-1">
                {menuAuthed.map(item => (
                  <ActiveLink key={item.href} href={item.href} label={item.label} onClick={() => setOpen(false)} />
                ))}
              </div>
              <div className="mt-3 px-2">
                <button
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="w-full rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-3 py-2"
                >
                  Cerrar sesión
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-2 py-2">
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-3 py-2 text-center"
              >
                Iniciar sesión
              </Link>
              <Link
                href="/register"
                onClick={() => setOpen(false)}
                className="rounded-lg text-gray-200 hover:text-white hover:bg-white/10 px-3 py-2 text-sm text-center"
              >
                Registrarse
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

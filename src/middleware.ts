// middleware.ts
import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const role = (req.nextauth.token as any)?.role ?? 'empleado';
    const { pathname } = req.nextUrl;

    // /admin solo para admin o supervisor
    if (pathname.startsWith('/admin') && !['admin', 'supervisor'].includes(role)) {
      return NextResponse.redirect(new URL('/', req.url));
    }

    // /workers requiere sesión (withAuth ya lo exige)
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;
        const protectedPrefixes = ['/admin', '/workers'];
        const isProtected = protectedPrefixes.some((p) => pathname.startsWith(p));
        if (!isProtected) return true;     // rutas públicas
        return !!token;                    // requiere sesión
      },
    },
  }
);

export const config = {
  matcher: ['/admin/:path*', '/workers/:path*'],
};

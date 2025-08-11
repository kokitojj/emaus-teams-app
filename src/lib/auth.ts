// =====================================================
// lib/auth.ts — configuración NextAuth + helpers de sesión/roles
// =====================================================
// file: lib/auth.ts
import NextAuth, { DefaultSession, NextAuthOptions } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { compare } from 'bcrypt';
import { prisma } from '@/lib/prisma';

// Extendemos el tipo de Session para incluir role y workerId
declare module 'next-auth' {
  interface Session extends DefaultSession {
    user: DefaultSession['user'] & {
      id: string;
      role?: 'admin' | 'supervisor' | 'empleado' | string;
      workerId?: string; // id del modelo Worker
      username?: string;
    };
  }
}

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  providers: [
    // Ejemplo con Credentials (usuario/contraseña en tu modelo Worker)
    Credentials({
      name: 'credentials',
      credentials: {
        username: { label: 'Usuario', type: 'text' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(creds) {
        if (!creds?.username || !creds?.password) return null;
        const worker = await prisma.worker.findUnique({ where: { username: creds.username } });
        if (!worker) return null;
        const ok = await compare(creds.password, worker.password);
        if (!ok) return null;
        return {
          id: worker.id,
          name: worker.username,
          email: worker.email ?? undefined,
          role: (worker.role as any) ?? 'empleado',
          workerId: worker.id,
          username: worker.username,
        } as any;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Al hacer login, volcamos datos del Worker al token
      if (user) {
        token.role = (user as any).role ?? token.role ?? 'empleado';
        token.workerId = (user as any).workerId ?? token.workerId;
        token.username = (user as any).username ?? token.username;
      }
      // Refresco: garantizamos que workerId/role están presentes
      if (!token.workerId) {
        const w = await prisma.worker.findFirst({ where: { email: token.email ?? '' } });
        if (w) { token.workerId = w.id; token.role = (w.role as any) ?? token.role; token.username = w.username; }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.sub);
        (session.user as any).role = (token as any).role ?? 'empleado';
        (session.user as any).workerId = (token as any).workerId ?? null;
        (session.user as any).username = (token as any).username ?? null;
      }
      return session;
    },
  },
  pages: { signIn: '/login' },
};

export const { handlers: authHandlers, auth, signIn, signOut } = NextAuth(authOptions);

// Helpers de autorización en servidor
export async function requireAuth() {
  const session = await auth();
  if (!session?.user) throw new Error('UNAUTHENTICATED');
  return session;
}

export async function requireRole(roles: Array<'admin' | 'supervisor' | string>) {
  const session = await requireAuth();
  const role = (session.user as any).role ?? 'empleado';
  if (!roles.includes(role)) throw new Error('FORBIDDEN');
  return session;
}
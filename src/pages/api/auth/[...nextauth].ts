// pages/api/auth/[...nextauth].ts
import NextAuth, { NextAuthOptions } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { compare } from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  providers: [
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
      if (user) {
        token.role = (user as any).role ?? 'empleado';
        token.workerId = (user as any).workerId;
        token.username = (user as any).username;
      }
      // fallback por si el token viene sin workerId en refrescos
      if (!token.workerId && token.email) {
        const w = await prisma.worker.findFirst({ where: { email: token.email } });
        if (w) {
          token.workerId = w.id;
          token.role = (w.role as any) ?? token.role ?? 'empleado';
          token.username = w.username;
        }
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

export default NextAuth(authOptions);

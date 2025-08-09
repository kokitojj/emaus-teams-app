// src/lib/prisma.ts

import { PrismaClient } from '@prisma/client';

// Agregamos el cliente de Prisma al objeto `global` de Node.js en desarrollo.
// Esto evita que Next.js cree nuevas instancias en cada "hot reload".
declare global {
  var prisma: PrismaClient | undefined;
}

const prisma = global.prisma || new PrismaClient();

if (process.env.NODE_ENV === 'development') {
  global.prisma = prisma;
}

export default prisma;
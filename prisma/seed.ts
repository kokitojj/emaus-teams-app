// prisma/seed.ts

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const saltRounds = 10;

async function main() {
  console.log('Iniciando el script de seeding...');

  // Cifrar la contraseña del administrador
  const adminPassword = await bcrypt.hash('admin123', saltRounds);

  // Crear el usuario administrador
  const adminUser = await prisma.worker.upsert({
    where: { username: 'admin' },
    update: {}, // No actualizar si ya existe
    create: {
      username: 'admin',
      password: adminPassword,
      email: 'admin@emaus.com',
      role: 'admin',
      status: 'activo',
    },
  });

  console.log(`Usuario administrador creado: ${adminUser.username}`);

  // Crear un usuario de ejemplo
  const workerPassword = await bcrypt.hash('empleado123', saltRounds);
  const workerUser = await prisma.worker.upsert({
    where: { username: 'empleado' },
    update: {},
    create: {
      username: 'empleado',
      password: workerPassword,
      email: 'empleado@emaus.com',
      role: 'empleado',
      status: 'activo',
    },
  });

  console.log(`Usuario de ejemplo creado: ${workerUser.username}`);

  console.log('Seeding completado.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
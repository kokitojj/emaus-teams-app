// prisma/seed.ts

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const saltRounds = 10; // Número de rondas de cifrado para bcrypt

async function main() {
  console.log('Iniciando el script de seeding...');

  // 1. Cifrar la contraseña del usuario administrador
  const adminPassword = await bcrypt.hash('Manu@30042002', saltRounds);

  // 2. Crear o actualizar el usuario administrador
  const adminUser = await prisma.worker.upsert({
    where: { username: 'admin' },
    update: {
      password: adminPassword,
      email: 'admin@emaus.com',
      role: 'admin',
      status: 'activo',
    },
    create: {
      username: 'admin',
      password: adminPassword,
      email: 'admin@emaus.com',
      role: 'admin',
      status: 'activo',
    },
  });

  console.log(`Usuario administrador creado: ${adminUser.username}`);

  // 3. Cifrar la contraseña del usuario de ejemplo
  const workerPassword = await bcrypt.hash('empleado123', saltRounds);
  
  // 4. Crear o actualizar el usuario de ejemplo
  const workerUser = await prisma.worker.upsert({
    where: { username: 'empleado' },
    update: {
      password: workerPassword,
      email: 'empleado@emaus.com',
      role: 'empleado',
      status: 'activo',
    },
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

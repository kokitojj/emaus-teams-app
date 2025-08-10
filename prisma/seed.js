// prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
  // Admin
  const adminUsername = 'admin';
  const adminEmail = 'juanjobd@gmail.com'; // opcional
  const adminPassHash = await bcrypt.hash('30042002', 10);

  await prisma.worker.upsert({
    where: { username: adminUsername }, // unique
    update: {
      // si quieres actualizar algo cuando ya existe, ponlo aquí
      email: adminEmail,
      status: 'activo',
      role: 'admin', // es string, usa el que quieras: 'admin' / 'ADMIN'
    },
    create: {
      username: adminUsername,
      email: adminEmail,
      password: adminPassHash, // tu modelo usa "password"
      phoneNumber: null,
      role: 'admin',
      status: 'activo',
    },
  });

  // Tipos de tarea básicos (ejemplo)
  const basicTypes = ['Limpieza', 'Reparación', 'Atención'];
  for (const name of basicTypes) {
    await prisma.taskType.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  // (Opcional) Crea una tarea de ejemplo asignada al admin
  const limpieza = await prisma.taskType.findUnique({
    where: { name: 'Limpieza' },
  });
  const admin = await prisma.worker.findUnique({
    where: { username: adminUsername },
  });

  if (limpieza && admin) {
    await prisma.task.create({
      data: {
        name: 'Tarea de prueba',
        isCompleted: false,
        observations: 'Creada por el seed',
        taskTypeId: limpieza.id,
        startTime: new Date(),
        endTime: new Date(Date.now() + 60 * 60 * 1000), // +1h
        workers: { connect: [{ id: admin.id }] }, // relación M-N
      },
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

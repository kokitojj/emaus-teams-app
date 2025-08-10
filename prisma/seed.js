// prisma/seed.js (CommonJS)
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  // Ejemplo: usuario admin. Ajusta a tu esquema real.
  const adminEmail = 'juanjobd@gmail.com';
  const adminPass = await bcrypt.hash('30042002', 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: 'Admin',
      passwordHash: adminPass, // adapta el campo a tu modelo
      role: 'ADMIN', // si aplica en tu esquema
    },
  });

  // Más datos iniciales (roles, estados, etc.), siempre con upsert o checks.
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

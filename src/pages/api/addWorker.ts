// src/pages/api/addWorker.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, Prisma } from '@prisma/client';
import { authenticateAndAuthorize } from '@/utils/auth';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const saltRounds = 10;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await authenticateAndAuthorize(req, res, ['admin']);
  if (!session) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método no permitido. Solo se acepta POST.' });
  }

  const { username, password, email, role, phoneNumber } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Nombre de usuario y contraseña son obligatorios.' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const newWorker = await prisma.worker.create({
      select: {
        id: true,
        username: true,
        email: true,
        phoneNumber: true,
        role: true,
        status: true,
      },
      data: {
        username,
        email: email || null,
        password: hashedPassword,
        role: role || 'empleado',
        phoneNumber: phoneNumber || null,
      },
    });

    res.status(201).json(newWorker);
  } catch (error) {
    console.error('Error al crear trabajador:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(409).json({ message: 'El nombre de usuario o el email ya están registrados.' });
    }
    return res.status(500).json({ message: 'Error interno del servidor.' });
  } finally {
    await prisma.$disconnect();
  }
}
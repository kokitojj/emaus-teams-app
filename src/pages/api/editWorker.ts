// src/pages/api/editWorker.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, Prisma } from '@prisma/client';
import { authenticateAndAuthorize } from '@/utils/auth';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const saltRounds = 10;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await authenticateAndAuthorize(req, res, ['admin']);
  if (!session) return;

  if (req.method !== 'PUT') {
    return res.status(405).json({ message: 'Método no permitido. Solo se acepta PUT.' });
  }

  const { id, username, email, role, status, phoneNumber, password } = req.body;

  if (!id || !username) {
    return res.status(400).json({ message: 'El ID del trabajador y el nombre de usuario son obligatorios.' });
  }

  try {
    let hashedPassword = undefined;
    if (password) {
      hashedPassword = await bcrypt.hash(password, saltRounds);
    }

    const updatedWorker = await prisma.worker.update({
      where: { id: id as string },
      data: {
        username: username as string,
        email: email as string,
        password: hashedPassword,
        role: role as string,
        status: status as string,
        phoneNumber: phoneNumber as string | null,
      },
    });

    const { password: _, ...workerWithoutPassword } = updatedWorker;
    res.status(200).json(workerWithoutPassword);
  } catch (error) {
    console.error('Error al actualizar trabajador:', error);

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return res.status(404).json({ message: 'Trabajador no encontrado.' });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(409).json({ message: 'El nombre de usuario o el email ya existen.' });
    }

    return res.status(500).json({ message: 'Error interno del servidor.' });
  } finally {
    await prisma.$disconnect();
  }
}
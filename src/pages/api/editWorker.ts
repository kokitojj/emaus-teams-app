// src/pages/api/editWorker.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { authenticateAndAuthorize } from '../../utils/auth';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const saltRounds = 10;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await authenticateAndAuthorize(req, res, ['admin']);
  if (!session) return;

  if (req.method !== 'PUT') {
    return res.status(405).json({ message: 'Method Not Allowed. Only PUT is accepted.' });
  }

  const { id, username, email, role, status, phoneNumber, password } = req.body;

  if (!id || !username) {
    return res.status(400).json({ message: 'Worker ID and username are required.' });
  }

  try {
    let hashedPassword = null;
    if (password) {
      hashedPassword = await bcrypt.hash(password, saltRounds);
    }

    const updatedWorker = await prisma.worker.update({
      where: { id: id as string },
      data: {
        username: username as string,
        email: email as string,
        password: hashedPassword || undefined, // Use hashed password or keep old one
        role: role as string,
        status: status as string,
        phoneNumber: phoneNumber as string | null,
      },
    });

    // Don't return the password
    const { password: _, ...workerWithoutPassword } = updatedWorker;
    res.status(200).json(workerWithoutPassword);
  } catch (error: any) {
    console.error('Error updating worker:', error);

    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Worker not found.' });
    }
    if (error.code === 'P2002') {
      return res.status(409).json({ message: 'Username or email already exists.' });
    }

    return res.status(500).json({ message: 'Internal Server Error.' });
  } finally {
    await prisma.$disconnect();
  }
}
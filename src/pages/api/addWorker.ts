// src/pages/api/addWorker.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { authenticateAndAuthorize } from '../../utils/auth';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const saltRounds = 10;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await authenticateAndAuthorize(req, res, ['admin']);
  if (!session) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed. Only POST is accepted.' });
  }

  const { username, password, email, role, phoneNumber } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const newWorker = await prisma.worker.create({
      data: {
        username,
        email: email || null,
        password: hashedPassword,
        role: role || 'empleado',
        phoneNumber: phoneNumber || null,
      },
    });

    const { password: _, ...workerWithoutPassword } = newWorker;
    res.status(201).json(workerWithoutPassword);
  } catch (error: any) {
    console.error('Error creating worker:', error);

    if (error.code === 'P2002') {
      return res.status(409).json({ message: 'Username or email already exists.' });
    }

    return res.status(500).json({ message: 'Internal Server Error.' });
  } finally {
    await prisma.$disconnect();
  }
}
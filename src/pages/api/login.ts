// src/pages/api/login.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método no permitido. Solo se acepta POST.' });
  }

  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Nombre de usuario y contraseña son obligatorios.' });
  }

  try {
    // Buscar al usuario por nombre de usuario en la base de datos
    const user = await prisma.worker.findUnique({
      where: { username },
    });

    if (!user) {
      return res.status(401).json({ message: 'Credenciales inválidas.' });
    }

    // Comparar la contraseña proporcionada con la contraseña cifrada de la base de datos
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Credenciales inválidas.' });
    }

    // En un sistema real, aquí se crearía una sesión o un token JWT
    // Por ahora, solo devolvemos una respuesta de éxito.
    res.status(200).json({ message: 'Inicio de sesión exitoso.' });
  } catch (error) {
    console.error('Error al iniciar sesión:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  } finally {
    await prisma.$disconnect();
  }
}
// src/pages/api/workers.ts

import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../lib/prisma'; // Importa la instancia única

// Este es el handler principal del endpoint de la API.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Solo permitimos peticiones de tipo GET para este endpoint.
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método no permitido' });
  }

  try {
    // Usamos la instancia única de Prisma para buscar todos los trabajadores.
    const workers = await prisma.worker.findMany();

    // Devolvemos los datos en formato JSON con un código de estado 200 (OK).
    res.status(200).json(workers);
  } catch (error) {
    // Si hay un error, lo capturamos y devolvemos un código 500.
    console.error('Error al obtener trabajadores:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
}
import { PrismaClient } from '@prisma/client';

export default {
  seed: {
    script: 'ts-node --project prisma/tsconfig.json prisma/seed.ts',
  },
};


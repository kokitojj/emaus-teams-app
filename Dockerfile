# === Etapa 1: Construcción de la aplicación ===
FROM node:20-alpine AS builder

WORKDIR /app

# Copia los archivos de configuración para instalar las dependencias
COPY package*.json ./

# Instala todas las dependencias
RUN npm install

# Copia todo el código fuente del proyecto al contenedor
COPY . .

# Genera el cliente de Prisma
RUN npx prisma generate

# IMPORTANTE: Ejecuta las migraciones de Prisma en la base de datos
RUN npx prisma migrate deploy

# IMPORTANTE: Siembra la base de datos con los datos iniciales
RUN npx prisma db seed

# Genera la build de producción de Next.js
RUN npm run build

# === Etapa 2: Creación de la imagen final de producción ===
FROM node:20-alpine AS runner

WORKDIR /app

# Copia los archivos de Next.js de la etapa de compilación
COPY --from=builder /app/.next ./.next

# Copia los archivos de la build que se necesitan en producción
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts

# Instala solo las dependencias de producción
RUN npm install --omit=dev

# Expone el puerto que usará la aplicación
EXPOSE 3003

# Comando para iniciar la aplicación de producción
CMD ["npm", "run", "start"]
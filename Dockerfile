# === Etapa 1: Construcción de la aplicación ===
# Usamos una imagen de Node.js más completa para el proceso de construcción
FROM node:20-alpine AS builder

WORKDIR /app

# Copiamos todo el código fuente de la aplicación
COPY . .

# Copiamos los archivos de configuración para instalar dependencias
COPY package*.json ./

# Instalamos las dependencias
RUN npm install

# Generamos el cliente de Prisma
RUN npx prisma generate

# Generamos la build de producción de Next.js
# Esto optimiza el código y lo prepara para el despliegue
RUN npm run build

# === Etapa 2: Creación de la imagen final de producción ===
# Usamos una imagen Node.js más ligera para el servidor final
FROM node:20-alpine

WORKDIR /app

# Copiamos solo los archivos necesarios de la etapa de "builder"
# Esto reduce el tamaño de la imagen final considerablemente
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.js ./

# Expone el puerto por defecto
EXPOSE 3000

# El comando para iniciar el servidor de producción
CMD ["npm", "run", "start"]
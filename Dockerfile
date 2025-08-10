# === Etapa 1: Construcción de la aplicación ===
# Usa una imagen de Node.js ligera para la compilación
FROM node:20-alpine AS builder

# Establece el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copia los archivos de configuración para instalar las dependencias
COPY package*.json ./

# Instala todas las dependencias
RUN npm install

# Copia todo el código fuente del proyecto al contenedor
COPY . .

# Genera el cliente de Prisma
RUN npx prisma generate

# Genera la build de producción de Next.js
RUN npm run build

# === Etapa 2: Creación de la imagen final de producción ===
# Usa una imagen Node.js mínima para el servidor de ejecución
FROM node:20-alpine AS runner

# Establece el directorio de trabajo
WORKDIR /app

# Copia los archivos de Next.js de la etapa de compilación
COPY --from=builder /app/.next ./.next

# Copia los archivos de la build que se necesitan en producción
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.js ./next.config.js

# Instala solo las dependencias de producción
RUN npm install --omit=dev

# Expone el puerto que usará la aplicación
EXPOSE 3003

# Comando para iniciar la aplicación de producción
CMD ["npm", "run", "start"]
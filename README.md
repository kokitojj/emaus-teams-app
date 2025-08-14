# Emaus Teams App

Emaus Teams App es una aplicación web diseñada para gestionar trabajadores, tareas y solicitudes de ausencia dentro de una organización. Proporciona control de acceso basado en roles, distinguiendo entre empleados y gerentes, cada uno con su propio conjunto de permisos y funcionalidades.

## Características

- **Gestión de Usuarios:** Añadir, editar y gestionar la información de los trabajadores.
- **Control de Acceso Basado en Roles:** Interfaces y funcionalidades separadas para empleados y gerentes.
- **Gestión de Tareas:** Crear, asignar y seguir el estado de las tareas. Incluye una vista de calendario para la programación.
- **Sistema de Solicitud de Ausencias:** Los empleados pueden solicitar ausencias y los gerentes pueden aprobar o denegar las solicitudes.
- **Tipos de Tareas:** Definir diferentes tipos de tareas y asignar trabajadores cualificados a cada tipo.
- **Integración con Calendario:** Ver tareas y solicitudes de ausencia en un calendario.
- **Autenticación:** Inicio de sesión y gestión de sesiones seguros usando NextAuth.js.

## Tecnologías Utilizadas

- **Framework:** [Next.js](https://nextjs.org/)
- **ORM de Base de Datos:** [Prisma](https://www.prisma.io/)
- **Base de Datos:** [PostgreSQL](https://www.postgresql.org/)
- **Autenticación:** [NextAuth.js](https://next-auth.js.org/)
- **Estilos:** [Tailwind CSS](https://tailwindcss.com/)
- **Lenguaje:** [TypeScript](https://www.typescriptlang.org/)
- **Calendario:** [React Big Calendar](https://jquense.github.io/react-big-calendar/)

## Puesta en Marcha

Para obtener una copia local y ponerla en funcionamiento, sigue estos sencillos pasos.

### Prerrequisitos

- Node.js (v20.x o superior)
- npm
- Una instancia de base de datos PostgreSQL en funcionamiento

### Instalación

1. **Clona el repositorio:**
   ```sh
   git clone <url-de-tu-repositorio>
   cd emaus-teams-app
   ```

2. **Instala los paquetes NPM:**
   ```sh
   npm install
   ```

3. **Configura las variables de entorno:**
   Crea un archivo `.env` en la raíz del proyecto y añade las siguientes variables de entorno. Reemplaza el marcador de posición con tu cadena de conexión a la base de datos real.

   ```env
   DATABASE_URL="postgresql://USUARIO:CONTRASEÑA@HOST:PUERTO/BASEDEDATOS?schema=public"
   NEXTAUTH_URL="http://localhost:3003"
   NEXTAUTH_SECRET="tu-secreto-aqui"
   ```

4. **Aplica las migraciones de la base de datos:**
   ```sh
   npx prisma migrate dev
   ```

5. **Puebla la base de datos (opcional):**
   Si quieres poblar la base de datos con datos iniciales, ejecuta el script de seed.
   ```sh
   npm run prisma:seed
   ```

### Ejecutar la Aplicación

- **Modo de Desarrollo:**
  Para ejecutar la aplicación en modo de desarrollo con recarga en caliente, usa:
  ```sh
  npm run dev
  ```
  Abre [http://localhost:3003](http://localhost:3003) para verla en el navegador.

- **Modo de Producción:**
  Para compilar y ejecutar la aplicación en modo de producción, usa:
  ```sh
  npm run build
  npm run start
  ```

## Base de Datos

Este proyecto utiliza **Prisma** como ORM para interactuar con la base de datos **PostgreSQL**. El esquema de la base de datos se define en `prisma/schema.prisma` e incluye los siguientes modelos:

- `Worker`: Almacena la información del usuario, incluyendo su rol (`empleado`, `supervisor`, `admin`).
- `TaskType`: Define diferentes categorías de tareas.
- `Task`: Representa tareas individuales, que pueden ser recurrentes.
- `LeaveRequest`: Gestiona las solicitudes de ausencia de los trabajadores.

Para generar el Cliente de Prisma después de cualquier cambio en el esquema, ejecuta:
```sh
npm run prisma:generate
```

## Scripts Disponibles

En el archivo `package.json`, puedes encontrar los siguientes scripts:

- `dev`: Inicia el servidor de desarrollo.
- `build`: Crea una compilación de producción de la aplicación.
- `start`: Inicia el servidor de producción.
- `lint`: Analiza el código base utilizando la configuración de ESLint incorporada de Next.js.
- `prisma:generate`: Genera el Cliente de Prisma basado en tu esquema.
- `prisma:seed`: Ejecuta el script de seed de la base de datos ubicado en `prisma/seed.js`.

// src/types/index.ts

import { DefaultSession } from "next-auth";

/**
 * Define la estructura de un Trabajador en la aplicación.
 */
export interface Worker {
  id: string; // Identificador único del trabajador.
  username: string; // Nombre de usuario del trabajador.
  email: string; // Correo electrónico del trabajador, usado para login y notificaciones.
  phoneNumber: string | null; // Add this line
  role: 'supervisor' | 'empleado' | 'admin'; // Rol del trabajador, con un tipo literal para ser específico.
  status: 'activo' | 'vacaciones' | 'permiso'; // Estado actual del trabajador.
}

/**
 * Define la estructura de un Turno de trabajo.
 */
export interface Shift {
  id: string; // Identificador único del turno.
  name: string; // Nombre del turno (ej. "Turno de mañana", "Turno de noche").
  startTime: Date; // Hora de inicio del turno.
  endTime: Date; // Hora de finalización del turno.
  workers: Worker[]; // Lista de trabajadores asignados a este turno.
  tasks: Task[]; // Lista de tareas asociadas a este turno.
}

/**
 * Define la estructura de un Tipo de Tarea.
 */
export interface TaskType {
  id: string;
  name: string;
  qualifiedWorkers: Worker[];
}

/**
 * Define la estructura de una Tarea.
 */
export interface Task {
  id: string; // Identificador único de la tarea.
  name: string; // Nombre de la tarea (ej. "Revisar inventario", "Atender clientes").
  isCompleted: boolean; // Estado de la tarea, si ha sido completada o no.
  observations: string | null;
  taskTypeId: string;
  startTime: Date;
  endTime: Date;
  workers: Worker[];
  taskType: TaskType;
}

/**
 * Define la estructura de una Solicitud de vacaciones o permiso.
 */
export interface LeaveRequest {
  id: string; // Identificador único de la solicitud.
  workerId: string; // ID del trabajador que realiza la solicitud.
  type: 'vacaciones' | 'permiso'; // Tipo de solicitud.
  startDate: Date; // Fecha de inicio del periodo solicitado.
  endDate: Date; // Fecha de finalización del periodo solicitado.
  reason: string; // Razón de la solicitud.
  status: 'pendiente' | 'aprobado' | 'rechazado'; // Estado de la solicitud.
  supervisorId: string | null; // ID del supervisor que aprueba o rechaza (o null si está pendiente).
  worker: Worker;
}

// Extender el módulo next-auth para incluir propiedades personalizadas
declare module "next-auth" {
  /**
   * The shape of the user object returned in the OAuth providers' `profile` callback,
   * available here as `user`.
   */
  interface User {
    id: string;
    username: string;
    role: string;
  }

  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    user: {
      id: string;
      username: string;
      role: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  /** Returned by the `jwt` callback and `getToken`, when using JWT sessions */
  interface JWT {
    id: string;
    username: string;
    role: string;
  }
}
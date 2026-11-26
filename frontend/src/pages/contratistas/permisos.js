import { useAuth } from "../../auth/contexto";
import { ADMIN, VENTAS, tieneRol } from "../../auth/roles";

/** Roles que pueden crear, editar y borrar contratistas y obras (igual que roles_escritura del API). */
export const ROLES_ESCRITURA = [VENTAS];

/** true si el usuario actual puede escribir. Ocultar botones no es seguridad: el backend responde 403. */
export function usePuedeEscribir() {
  const { rol } = useAuth();
  return tieneRol(rol, ROLES_ESCRITURA);
}

/** Solo el Administrador desbloquea; Ventas puede pedir el desbloqueo. */
export function useAccionesBloqueo() {
  const { rol } = useAuth();
  return { puedeDesbloquear: rol === ADMIN, puedeSolicitar: rol === VENTAS };
}

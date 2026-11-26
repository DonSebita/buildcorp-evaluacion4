import { ADMIN, BODEGUERO, tieneRol } from "../../auth/roles";

/** Estados del activo (apps/activos/models.py · Activo.Estado). */
export const ESTADOS = [
  { valor: "DISPONIBLE", texto: "Disponible" },
  { valor: "EN_USO", texto: "En uso" },
  { valor: "MANTENIMIENTO", texto: "Mantenimiento" },
  { valor: "DADO_DE_BAJA", texto: "Dado de baja" },
];

export const textoEstado = (valor) => ESTADOS.find((e) => e.valor === valor)?.texto || valor || "—";

/** Crear y editar: Bodeguero y Administrador (el backend responde 403 igual a los demás). */
export const puedeEscribir = (rol) => tieneRol(rol, [BODEGUERO]);
/** Dar de baja: solo Administrador. */
export const puedeDarDeBaja = (rol) => rol === ADMIN;

/**
 * URL de la foto. Con S3 (USE_S3=True) llega prefirmada y expira a los 900 s;
 * se aceptan los nombres "foto_url" o "foto" para no depender del serializer exacto.
 */
export const urlFoto = (activo) => activo?.foto_url || activo?.foto || null;

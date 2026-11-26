import { tieneRol, VENTAS, ENCARGADO } from "../../auth/roles";

/**
 * GET /dashboard/resumen/ devuelve enlaces de la app Django (/activos/RTM-0001/, /prestamos/?estado=…).
 * Solo Activos y Contratistas existen en el frontend Vite: esos se traducen a rutas internas
 * y el resto se muestra como texto (devuelve null).
 */
export function rutaInterna(url, rol) {
  if (!url || typeof url !== "string" || /^https?:/i.test(url)) return null;
  const [ruta, query = ""] = url.split("?");
  const limpia = ruta.replace(/\/+$/, "") || "/";
  const destino = (base) => `${base}${query ? `?${query}` : ""}`;
  if (limpia === "/activos" || /^\/activos\/[A-Za-z0-9-]+$/.test(limpia)) return destino(limpia);
  if (limpia === "/contratistas" || /^\/contratistas\/\d+$/.test(limpia)) {
    return tieneRol(rol, [VENTAS, ENCARGADO]) ? destino(limpia) : null;
  }
  return null;
}

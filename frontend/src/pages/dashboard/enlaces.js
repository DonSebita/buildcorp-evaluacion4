import { tieneRol, VENTAS, ENCARGADO } from "../../auth/roles";
import { sinBarrasFinales } from "../../utils/texto";

/**
 * GET /dashboard/resumen/ devuelve enlaces de la app Django (/activos/RTM-0001/, /prestamos/?estado=…).
 * Activos, Contratistas, Alertas, Cobros y Parámetros existen en el frontend Vite: esos se traducen a rutas internas
 * y el resto se muestra como texto (devuelve null).
 */
export function rutaInterna(url, rol) {
  if (!url || typeof url !== "string" || /^https?:/i.test(url)) return null;
  const [ruta, query = ""] = url.split("?");
  const limpia = sinBarrasFinales(ruta) || "/";
  const destino = (base) => `${base}${query ? `?${query}` : ""}`;
  if (limpia === "/activos" || /^\/activos\/[A-Za-z0-9-]+$/.test(limpia)) return destino(limpia);
  if (limpia === "/contratistas" || /^\/contratistas\/\d+$/.test(limpia)) {
    return tieneRol(rol, [VENTAS, ENCARGADO]) ? destino(limpia) : null;
  }
  if (limpia === "/alertas") return destino(limpia);
  if (limpia === "/prestamos/cobros" || limpia === "/cobros") return tieneRol(rol, [VENTAS]) ? "/cobros" : null;
  if (limpia === "/prestamos/parametros") return tieneRol(rol, [VENTAS]) ? "/parametros" : null;
  return null;
}

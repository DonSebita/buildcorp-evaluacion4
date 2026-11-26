/**
 * Capa de acceso al API REST de BuildCorp (Django REST Framework + SimpleJWT).
 *
 * - Base: import.meta.env.VITE_API_URL (local http://localhost:8000/api/v1; en AWS, API Gateway).
 * - Agrega "Authorization: Bearer <access>" a cada solicitud autenticada.
 * - Ante un 401 intenta renovar el access UNA vez con el refresh y repite la solicitud.
 *   Si la renovación falla, borra la sesión y avisa al AuthContext (vuelve al login).
 * - Convierte los errores de DRF en mensajes legibles (mensajeDeError, portado de static/js/api.js)
 *   y conserva el detalle por campo en error.campos para pintarlo en los formularios.
 * - 429 (rate limit de API Gateway o de DRF) lanza un error propio: "Demasiadas solicitudes".
 *
 * Guardado de tokens: el access vive solo en memoria (variable de este módulo) y el refresh en
 * sessionStorage, que se borra al cerrar la pestaña. Es más simple que una cookie httpOnly pero
 * queda expuesto a XSS; el trade-off se documenta en el informe.
 *
 * Uso:
 *   import { api } from "../api/client";
 *   const datos = await api.get("/contratistas/", { params: { search: "acme" } });
 *   await api.post("/contratistas/", { razon_social: "..." });
 */

export const API_URL = (import.meta.env?.VITE_API_URL || "http://localhost:8000/api/v1").replace(/\/+$/, "");

const CLAVE_REFRESH = "buildcorp.refresh";

let accessToken = null;
let renovacionEnCurso = null;
let alExpirar = () => {};

/* ---------------- tokens ---------------- */

export const tokens = {
  getAccess: () => accessToken,
  setAccess: (valor) => {
    accessToken = valor || null;
  },
  getRefresh: () => {
    try {
      return sessionStorage.getItem(CLAVE_REFRESH);
    } catch {
      return null;
    }
  },
  setRefresh: (valor) => {
    try {
      if (valor) sessionStorage.setItem(CLAVE_REFRESH, valor);
      else sessionStorage.removeItem(CLAVE_REFRESH);
    } catch {
      /* modo privado sin almacenamiento: la sesión dura lo que dure el access */
    }
  },
  limpiar: () => {
    accessToken = null;
    tokens.setRefresh(null);
  },
};

/** El AuthContext registra aquí qué hacer cuando la sesión no se puede renovar. */
export function alExpirarSesion(fn) {
  alExpirar = typeof fn === "function" ? fn : () => {};
}

/* ---------------- errores ---------------- */

export class ApiError extends Error {
  /**
   * @param {string} mensaje  texto listo para mostrar al usuario
   * @param {number} status   código HTTP (0 = sin conexión)
   * @param {any}    datos    cuerpo JSON devuelto por DRF (si lo hubo)
   */
  constructor(mensaje, status, datos = null) {
    super(mensaje);
    this.name = "ApiError";
    this.status = status;
    this.datos = datos;
    this.campos = erroresPorCampo(datos);
  }
}

/** Convierte la respuesta de error de DRF en un texto legible (portado de static/js/api.js). */
export function mensajeDeError(datos, status) {
  if (!datos) return `Error ${status}. Intenta de nuevo.`;
  if (typeof datos === "string") return datos;
  if (Array.isArray(datos)) return datos.join(" ");
  if (datos.detail) return Array.isArray(datos.detail) ? datos.detail.join(" ") : String(datos.detail);
  const partes = [];
  for (const [campo, valor] of Object.entries(datos)) {
    const texto = Array.isArray(valor) ? valor.join(" ") : typeof valor === "object" ? JSON.stringify(valor) : valor;
    partes.push(campo === "non_field_errors" ? texto : `${campo}: ${texto}`);
  }
  return partes.join(" · ") || `Error ${status}.`;
}

/** {"rut": ["RUT inválido."], "non_field_errors": [...]} → {rut: "RUT inválido.", non_field_errors: "..."} */
function erroresPorCampo(datos) {
  if (!datos || typeof datos !== "object" || Array.isArray(datos) || datos.detail) return {};
  const campos = {};
  for (const [campo, valor] of Object.entries(datos)) {
    campos[campo] = Array.isArray(valor) ? valor.join(" ") : typeof valor === "object" ? JSON.stringify(valor) : String(valor);
  }
  return campos;
}

/* ---------------- solicitudes ---------------- */

function construirUrl(ruta, params) {
  const url = /^https?:\/\//.test(ruta) ? new URL(ruta) : new URL(API_URL + (ruta.startsWith("/") ? ruta : `/${ruta}`));
  if (params) {
    for (const [clave, valor] of Object.entries(params)) {
      if (valor !== undefined && valor !== null && valor !== "") url.searchParams.set(clave, valor);
    }
  }
  return url.toString();
}

async function leerCuerpo(resp) {
  if (resp.status === 204) return null;
  const tipo = resp.headers.get("Content-Type") || "";
  if (tipo.includes("json")) return resp.json().catch(() => null);
  const texto = await resp.text().catch(() => "");
  return texto || null;
}

/** Pide un access nuevo con el refresh. Comparte la promesa si ya hay una renovación en curso
 *  (con rotación + blacklist, dos renovaciones simultáneas invalidarían la segunda). */
export function renovarAccess() {
  if (renovacionEnCurso) return renovacionEnCurso;
  const refresh = tokens.getRefresh();
  if (!refresh) return Promise.resolve(false);

  renovacionEnCurso = (async () => {
    try {
      const resp = await fetch(construirUrl("/auth/token/refresh/"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ refresh }),
      });
      if (!resp.ok) return false;
      const datos = await resp.json();
      tokens.setAccess(datos.access);
      if (datos.refresh) tokens.setRefresh(datos.refresh); // ROTATE_REFRESH_TOKENS
      return true;
    } catch {
      return false;
    } finally {
      renovacionEnCurso = null;
    }
  })();
  return renovacionEnCurso;
}

/**
 * Llama al API y devuelve el JSON (o null si la respuesta es 204).
 * @param {string} ruta  ruta relativa a VITE_API_URL ("/contratistas/") o URL absoluta (p. ej. "next" de DRF)
 * @param {object} [opciones]
 * @param {string} [opciones.method="GET"]
 * @param {any}    [opciones.body]     objeto (se envía como JSON) o FormData (para archivos)
 * @param {object} [opciones.params]   query string
 * @param {object} [opciones.headers]
 * @param {boolean}[opciones.auth=true] false para no enviar el token (login)
 * @param {AbortSignal} [opciones.signal]
 * @throws {ApiError}
 */
export async function solicitar(ruta, opciones = {}) {
  const { method = "GET", body, params, headers = {}, auth = true, signal, _reintento = false } = opciones;
  const metodo = method.toUpperCase();
  const cabeceras = { Accept: "application/json", ...headers };
  let cuerpo;
  if (body instanceof FormData) {
    cuerpo = body; // el navegador pone el boundary del multipart
  } else if (body !== undefined) {
    cabeceras["Content-Type"] = "application/json";
    cuerpo = JSON.stringify(body);
  }
  if (auth && accessToken) cabeceras.Authorization = `Bearer ${accessToken}`;

  let resp;
  try {
    resp = await fetch(construirUrl(ruta, params), { method: metodo, headers: cabeceras, body: cuerpo, signal });
  } catch (e) {
    if (e?.name === "AbortError") throw e;
    throw new ApiError("Sin conexión con el servidor. Revisa la red y vuelve a intentar.", 0);
  }

  // 401: renovar el access una sola vez y repetir.
  if (resp.status === 401 && auth && !_reintento) {
    if (await renovarAccess()) {
      return solicitar(ruta, { ...opciones, _reintento: true });
    }
    tokens.limpiar();
    alExpirar();
    throw new ApiError("Tu sesión expiró. Vuelve a iniciar sesión.", 401);
  }

  const datos = await leerCuerpo(resp);
  if (resp.ok) return datos;

  if (resp.status === 429) {
    const espera = resp.headers.get("Retry-After");
    throw new ApiError(
      `Demasiadas solicitudes. Espera ${espera ? `${espera} s` : "unos segundos"} y vuelve a intentar.`,
      429,
      datos
    );
  }
  if (resp.status === 403) {
    throw new ApiError(datos?.detail || datos?.message || "Tu rol no tiene permiso para esta acción.", 403, datos);
  }
  if (resp.status === 404 && !datos?.detail) {
    throw new ApiError("No se encontró el recurso solicitado.", 404, datos);
  }
  if (resp.status >= 500) {
    throw new ApiError(`Error del servidor (${resp.status}). Intenta de nuevo en un momento.`, resp.status, datos);
  }
  throw new ApiError(mensajeDeError(datos, resp.status), resp.status, datos);
}

/** Atajos: api.get(ruta, {params}), api.post(ruta, body), api.put, api.patch, api.delete. */
export const api = {
  get: (ruta, opciones = {}) => solicitar(ruta, { ...opciones, method: "GET" }),
  post: (ruta, body, opciones = {}) => solicitar(ruta, { ...opciones, method: "POST", body }),
  put: (ruta, body, opciones = {}) => solicitar(ruta, { ...opciones, method: "PUT", body }),
  patch: (ruta, body, opciones = {}) => solicitar(ruta, { ...opciones, method: "PATCH", body }),
  delete: (ruta, opciones = {}) => solicitar(ruta, { ...opciones, method: "DELETE" }),
};

/** Normaliza listas de DRF: acepta la respuesta paginada ({count, results}) o un arreglo plano. */
export function resultados(datos) {
  if (Array.isArray(datos)) return { filas: datos, total: datos.length, siguiente: null, anterior: null };
  return {
    filas: datos?.results ?? [],
    total: datos?.count ?? 0,
    siguiente: datos?.next ?? null,
    anterior: datos?.previous ?? null,
  };
}

export default api;

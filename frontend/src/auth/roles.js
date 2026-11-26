/**
 * Roles del sistema (mismos nombres que apps/usuarios/roles.py, los entrega GET /auth/me/).
 * Ocultar un botón NO es seguridad: el backend responde 403 igual. Esto solo ordena la interfaz.
 */
export const ADMIN = "Administrador";
export const BODEGUERO = "Bodeguero";
export const ENCARGADO = "Encargado E/R";
export const VENTAS = "Ventas";

export const TODOS = [ADMIN, BODEGUERO, ENCARGADO, VENTAS];

/** Clave corta para el color de "copia" del talonario (data-rol). */
export const CLAVES = { [ADMIN]: "admin", [BODEGUERO]: "bodega", [ENCARGADO]: "terreno", [VENTAS]: "ventas" };

/** El Administrador puede todo; el resto, solo lo listado. Sin lista = cualquier rol. */
export function tieneRol(rol, permitidos) {
  if (!rol) return false;
  if (!permitidos || permitidos.length === 0) return true;
  return rol === ADMIN || permitidos.includes(rol);
}

/**
 * Menú del riel. Cada ítem declara qué roles lo ven (además del Administrador).
 * Contratistas sigue la misma regla que templates/base.html (Ventas y Encargado E/R).
 * Para un ítem solo del Administrador se usa roles: [ADMIN] (una lista vacía significa «todos»).
 */
export const MENU = [
  {
    seccion: null,
    items: [
      { a: "/dashboard", texto: "Inicio", icono: "bi-grid-1x2", roles: null },
      { a: "/alertas", texto: "Alertas", icono: "bi-bell", roles: null },
    ],
  },
  {
    seccion: "Arriendos",
    items: [
      { a: "/contratistas", texto: "Contratistas", icono: "bi-buildings", roles: [VENTAS, ENCARGADO] },
      { a: "/cobros", texto: "Cobros", icono: "bi-cash-stack", roles: [VENTAS] },
    ],
  },
  {
    seccion: "Inventario",
    items: [
      { a: "/activos", texto: "Activos", icono: "bi-tools", roles: null },
      { a: "/categorias", texto: "Categorías y tarifas", icono: "bi-tags", roles: null },
    ],
  },
  {
    seccion: "Administración",
    items: [
      { a: "/usuarios", texto: "Trabajadores", icono: "bi-people", roles: [ADMIN] },
      { a: "/parametros", texto: "Parámetros", icono: "bi-sliders", roles: [VENTAS] },
    ],
  },
  {
    seccion: "Sistema",
    items: [{ a: "/diagnostico", texto: "Diagnóstico API", icono: "bi-speedometer2", roles: null }],
  },
];

/** Devuelve el menú filtrado para un rol, sin secciones vacías. */
export function menuPara(rol) {
  return MENU.map((s) => ({ ...s, items: s.items.filter((i) => tieneRol(rol, i.roles)) })).filter((s) => s.items.length);
}

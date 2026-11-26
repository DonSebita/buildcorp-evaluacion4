/** Formatos chilenos (portados de static/js/api.js). Valores vacíos se muestran como "—". */
const fmtCLP = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const fmtNum = new Intl.NumberFormat("es-CL");
const fmtFecha = new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
const fmtFechaHora = new Intl.DateTimeFormat("es-CL", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const vacio = (v) => v === null || v === undefined || v === "";

export const clp = (n) => (vacio(n) ? "—" : fmtCLP.format(Number(n)));
export const num = (n) => (vacio(n) ? "—" : fmtNum.format(Number(n)));

/** "2026-11-25" → "25-11-2026" sin desfase de zona horaria. */
export function fecha(iso) {
  if (!iso) return "—";
  const [a, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  return fmtFecha.format(new Date(a, m - 1, d));
}

export const fechaHora = (iso) => (iso ? fmtFechaHora.format(new Date(iso)) : "—");

import Cargando from "./Cargando";

/**
 * Tabla del sistema. En celular (< 576 px) se apila como fichas usando el título de cada columna.
 *
 * <Tabla
 *   columnas={[
 *     { clave: "rut", titulo: "RUT", render: (f) => <span className="folio">{f.rut}</span> },
 *     { clave: "razon_social", titulo: "Razón social" },
 *     { clave: "estado", titulo: "Estado", render: (f) => <Timbre estado={f.estado} /> },
 *     { clave: "total", titulo: "Total", num: true, render: (f) => clp(f.total) },
 *     { clave: "acciones", titulo: "", accion: true, render: (f) => <button …>Editar</button> },
 *   ]}
 *   filas={filas}
 *   cargando={cargando}
 *   error={error}
 *   vacio="Aún no hay contratistas."
 *   onFila={(f) => navigate(`/contratistas/${f.id}`)}
 * />
 */
export default function Tabla({
  columnas,
  filas = [],
  cargando = false,
  error = "",
  vacio = "No hay registros.",
  claveFila = (f) => f.id,
  onFila,
  titulo,
}) {
  if (cargando) return <Cargando />;
  if (error) {
    return (
      <div className="vacio" role="alert">
        <i className="bi bi-exclamation-octagon text-crit" aria-hidden="true"></i>
        {error}
      </div>
    );
  }
  if (!filas.length) {
    return (
      <div className="vacio">
        <i className="bi bi-inbox" aria-hidden="true"></i>
        {vacio}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="tabla">
        {titulo && <caption className="sr-only">{titulo}</caption>}
        <thead>
          <tr>
            {columnas.map((c) => (
              <th key={c.clave} scope="col" className={c.num ? "num" : ""} style={c.ancho ? { width: c.ancho } : undefined}>
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr
              key={claveFila(f) ?? i}
              className={onFila ? "clicable" : undefined}
              onClick={
                onFila
                  ? (e) => {
                      if (e.target.closest("a, button, input, select, textarea, label")) return;
                      if (String(window.getSelection?.() ?? "").length) return; // estaba seleccionando texto
                      onFila(f);
                    }
                  : undefined
              }
            >
              {columnas.map((c) => (
                <td key={c.clave} data-label={c.titulo || undefined} className={[c.num ? "num" : "", c.accion ? "celda-accion text-right" : ""].join(" ").trim() || undefined}>
                  {c.render ? c.render(f) : (f[c.clave] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

import { Link } from "react-router-dom";
import { clp, num } from "../../utils/formato";

/**
 * Gráfico de barras horizontales simple (sin librerías): una barra por categoría,
 * cada una con su nombre y su cifra escritos (el dato nunca depende solo del color).
 * Barras finas con extremo redondeado anclado a la base; tooltip nativo con el detalle.
 *
 * <GraficoBarras titulo="Activos por estado" etiquetas={[...]} valores={[...]} colores={[...]}
 *   enlaces={["/activos?estado=DISPONIBLE", ...]} formato="num" />
 */
export default function GraficoBarras({ titulo, etiquetas = [], valores = [], colores = [], enlaces = [], formato = "num", unidad = "" }) {
  const fmt = formato === "clp" ? clp : num;
  const total = valores.reduce((s, v) => s + (Number(v) || 0), 0);
  const maximo = Math.max(1, ...valores.map((v) => Number(v) || 0));

  return (
    <figure className="m-0 grid gap-3" aria-label={titulo}>
      <ul className="m-0 grid list-none gap-2.5 p-0">
        {etiquetas.map((etiqueta, i) => {
          const v = Number(valores[i]) || 0;
          const pct = (v / maximo) * 100;
          const porcentaje = total ? Math.round((v / total) * 100) : 0;
          const detalle = `${etiqueta}: ${fmt(v)}${unidad}${formato !== "clp" && total ? ` (${porcentaje} % del total)` : ""}`;
          const contenido = (
            <>
              <span className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-semibold text-texto">{etiqueta}</span>
                <span className="num font-bold text-texto">
                  {fmt(v)}
                  {unidad}
                  {formato !== "clp" && total > 0 && <span className="ml-1.5 font-normal text-texto-2">{porcentaje} %</span>}
                </span>
              </span>
              <span className="block h-2.5 rounded-r-[4px] bg-linea-suave" aria-hidden="true">
                <span
                  className="block h-full rounded-r-[4px] transition-[width] duration-500 motion-reduce:transition-none"
                  style={{ width: `${v ? Math.max(pct, 1.5) : 0}%`, background: colores[i] || "var(--color-tinta)" }}
                ></span>
              </span>
            </>
          );
          return (
            <li key={etiqueta} title={detalle}>
              {enlaces[i] ? (
                <Link to={enlaces[i]} className="-mx-2 grid gap-1 rounded-md px-2 py-1 no-underline hover:bg-papel" aria-label={`${detalle}. Ver lista`}>
                  {contenido}
                </Link>
              ) : (
                <div className="grid gap-1 py-1" aria-label={detalle}>{contenido}</div>
              )}
            </li>
          );
        })}
      </ul>
      {formato !== "clp" && (
        <figcaption className="num text-sm text-texto-2">
          Total: <strong className="text-texto">{fmt(total)}</strong>
        </figcaption>
      )}
    </figure>
  );
}

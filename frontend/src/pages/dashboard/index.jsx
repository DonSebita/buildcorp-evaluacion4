import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../auth/contexto";
import { BODEGUERO, tieneRol } from "../../auth/roles";
import { Aviso } from "../../components/Aviso";
import Cargando from "../../components/Cargando";
import Tabla from "../../components/Tabla";
import Timbre from "../../components/Timbre";
import { clp, fecha, fechaHora, num } from "../../utils/formato";
import GraficoBarras from "./GraficoBarras";
import { rutaInterna } from "./enlaces";

/** Mismo orden y colores que apps/dashboard/services.py (grafico_estados). */
const ESTADOS_ACTIVO = [
  { valor: "DISPONIBLE", texto: "Disponible", color: "#2D6A3E" },
  { valor: "EN_USO", texto: "En uso", color: "#2E2A6E" },
  { valor: "MANTENIMIENTO", texto: "Mantenimiento", color: "#B07D10" },
  { valor: "DADO_DE_BAJA", texto: "Dado de baja", color: "#8C8AA3" },
];

const fmtHoy = new Intl.DateTimeFormat("es-CL", { weekday: "long", day: "numeric", month: "long" });

/**
 * Inicio: GET /dashboard/resumen/ (KPIs, tablas y alertas según el rol) y un gráfico de activos por estado.
 * Algunos roles (Encargado E/R, Ventas) no reciben ese gráfico en el resumen: entonces se arma con
 * el total de GET /activos/?estado=X (count de la paginación de DRF, page_size=1).
 */
export default function Dashboard() {
  const { usuario, rol } = useAuth();
  const [datos, setDatos] = useState(null);
  const [porEstado, setPorEstado] = useState(null);
  const [error, setError] = useState("");
  const [actualizando, setActualizando] = useState(true);

  const cargar = useCallback(async (signal) => {
    const resumen = await api.get("/dashboard/resumen/", { signal });
    let estados;
    if (resumen?.grafico?.titulo === "Activos por estado") {
      estados = ESTADOS_ACTIVO.map((e, i) => ({ ...e, n: resumen.grafico.valores?.[i] ?? 0, color: resumen.grafico.colores?.[i] || e.color }));
    } else {
      const totales = await Promise.all(
        ESTADOS_ACTIVO.map((e) => api.get("/activos/", { params: { estado: e.valor, page_size: 1 }, signal }).then((r) => (Array.isArray(r) ? r.length : r?.count ?? 0)))
      );
      estados = ESTADOS_ACTIVO.map((e, i) => ({ ...e, n: totales[i] }));
    }
    return { resumen, estados };
  }, []);

  const refrescar = useCallback(
    (signal) =>
      cargar(signal)
        .then(({ resumen, estados }) => {
          setError("");
          setDatos(resumen);
          setPorEstado(estados);
        })
        .catch((e) => {
          if (e?.name !== "AbortError") setError(e.message);
        })
        .finally(() => {
          if (!signal?.aborted) setActualizando(false);
        }),
    [cargar]
  );

  useEffect(() => {
    const control = new AbortController();
    refrescar(control.signal);
    return () => control.abort();
  }, [refrescar]);

  const nombre = usuario?.nombre?.split(" ")[0] || usuario?.username || "";
  // La fecha la entrega el backend (zona horaria de Chile), no el reloj del navegador.
  const hoy = datos?.hoy ? fmtHoy.format(new Date(`${datos.hoy}T12:00:00`)) : "";

  return (
    <div className="grid gap-5">
      {/* Franja de copia: saludo, rol timbrado, fecha y acciones primarias del rol */}
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-[var(--copia-linea)] bg-[var(--copia)] px-5 py-4 text-[var(--copia-texto)]">
        <div className="grid gap-1">
          <h1 className="m-0 text-[1.35rem] font-extrabold">Hola{nombre ? `, ${nombre}` : ""}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="timbre timbre-info">{rol || "Sin rol"}</span>
            <span className="first-letter:uppercase">{hoy}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/activos" className="btn btn-secundario no-underline">
            <i className="bi bi-tools" aria-hidden="true"></i> Ver activos
          </Link>
          {tieneRol(rol, [BODEGUERO]) && (
            <Link to="/activos/nuevo" className="btn btn-primario no-underline">
              <i className="bi bi-plus-lg" aria-hidden="true"></i> Nuevo activo
            </Link>
          )}
          <button type="button" className="btn btn-secundario" onClick={() => {
              setActualizando(true);
              refrescar();
            }} disabled={actualizando} aria-busy={actualizando} aria-label="Actualizar datos">
            <i className={`bi bi-arrow-clockwise ${actualizando ? "animate-spin" : ""}`} aria-hidden="true"></i>
          </button>
        </div>
      </section>

      {error && <Aviso tipo="error">{error}</Aviso>}
      {!datos && !error && <Cargando texto="Cargando resumen…" />}

      {datos && (
        <>
          <Kpis kpis={datos.kpis || []} rol={rol} />

          <div className="grid gap-5 xl:grid-cols-2">
            <section className="hoja" aria-labelledby="graf-estados">
              <div className="hoja-cabeza flex items-center justify-between gap-3">
                <h2 id="graf-estados">Activos por estado</h2>
                <Link to="/activos" className="text-sm">Ver todos</Link>
              </div>
              <div className="hoja-cuerpo">
                <GraficoBarras
                  titulo="Activos por estado"
                  etiquetas={porEstado.map((e) => e.texto)}
                  valores={porEstado.map((e) => e.n)}
                  colores={porEstado.map((e) => e.color)}
                  enlaces={porEstado.map((e) => `/activos?estado=${e.valor}`)}
                />
              </div>
            </section>

            {datos.grafico && datos.grafico.titulo !== "Activos por estado" && (
              <section className="hoja" aria-labelledby="graf-extra">
                <div className="hoja-cabeza">
                  <h2 id="graf-extra">{datos.grafico.titulo}</h2>
                </div>
                <div className="hoja-cuerpo">
                  <GraficoBarras
                    titulo={datos.grafico.titulo}
                    etiquetas={datos.grafico.etiquetas}
                    valores={datos.grafico.valores}
                    colores={datos.grafico.colores}
                    formato={datos.grafico.formato}
                  />
                </div>
              </section>
            )}

            {datos.alertas?.length > 0 && <Alertas alertas={datos.alertas} rol={rol} />}
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            {(datos.tablas || []).map((t) => (
              <TablaResumen key={t.titulo} tabla={t} rol={rol} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Cuatro cifras grandes separadas por filetes, sin tarjetas; la crítica en rojo folio. */
function Kpis({ kpis, rol }) {
  if (!kpis.length) return null;
  return (
    <section className="hoja" aria-label="Indicadores">
      <dl className="m-0 grid grid-cols-2 lg:grid-cols-4">
        {kpis.map((k, i) => {
          const valor = k.formato === "clp" ? clp(k.valor) : num(k.valor);
          const ruta = rutaInterna(k.enlace, rol);
          return (
            <div
              key={k.etiqueta}
              className={`flex min-w-0 flex-col-reverse gap-1 px-4 py-4 sm:px-5 ${i % 2 ? "border-l border-linea" : ""} ${i >= 2 ? "border-t border-linea lg:border-t-0" : ""} ${i === 2 ? "lg:border-l" : ""}`}
            >
              <dt className="text-sm text-texto-2">
                {ruta ? <Link to={ruta}>{k.etiqueta}</Link> : k.etiqueta}
                {k.critico && <span className="mt-0.5 block font-semibold text-folio">requiere acción</span>}
              </dt>
              <dd
                className={`num m-0 text-[clamp(1.5rem,7vw,2.4rem)] leading-none font-extrabold break-words ${k.critico ? "text-folio" : "text-texto"}`}
                style={{ fontStretch: "78%" }}
              >
                {valor}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}

const NIVEL_TEXTO = { CRITICO: "Crítica", WARNING: "Atención", INFO: "Aviso" };

function Alertas({ alertas, rol }) {
  return (
    <section className="hoja" aria-labelledby="alertas-titulo">
      <div className="hoja-cabeza">
        <h2 id="alertas-titulo">Alertas abiertas</h2>
      </div>
      <ul className="m-0 list-none p-0">
        {alertas.map((a) => {
          const ruta = rutaInterna(a.enlace, rol);
          return (
            <li key={a.id} className="flex items-start gap-3 border-b border-linea-suave px-[1.15rem] py-3 last:border-b-0">
              <Timbre estado={a.nivel} texto={NIVEL_TEXTO[a.nivel] || a.nivel} />
              <div className="min-w-0 flex-1">
                <div>{ruta ? <Link to={ruta}>{a.mensaje}</Link> : a.mensaje}</div>
                <div className="text-sm text-texto-2">
                  {a.tipo} · {fechaHora(a.fecha)}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Tablas que arma el backend: columnas con tipo folio, enlace, timbre, fecha, fechahora, clp o accion. */
function TablaResumen({ tabla, rol }) {
  const ruta = rutaInterna(tabla.enlace, rol);
  const columnas = (tabla.columnas || []).map((c) => ({
    clave: c.clave,
    titulo: c.titulo,
    num: c.tipo === "clp",
    accion: c.tipo === "accion",
    render: (f) => celda(c.tipo, f[c.clave], rol),
  }));
  return (
    <section className="hoja">
      <div className="hoja-cabeza flex items-center justify-between gap-3">
        <h2>{tabla.titulo}</h2>
        {ruta && <Link to={ruta} className="text-sm">Ver todo</Link>}
      </div>
      <Tabla titulo={tabla.titulo} columnas={columnas} filas={tabla.filas || []} vacio={tabla.vacio} claveFila={() => null} />
    </section>
  );
}

function celda(tipo, valor, rol) {
  if (valor === null || valor === undefined || valor === "") return "—";
  const texto = typeof valor === "object" ? valor.texto : valor;
  const ruta = typeof valor === "object" ? rutaInterna(valor.url, rol) : null;
  switch (tipo) {
    case "folio":
      return ruta ? <Link className="folio" to={ruta}>{texto}</Link> : <span className="folio">{texto}</span>;
    case "enlace":
      return ruta ? <Link to={ruta}>{texto}</Link> : texto;
    case "timbre":
      return <Timbre estado={valor.estado} texto={valor.texto} />;
    case "fecha":
      return fecha(valor);
    case "fechahora":
      return fechaHora(valor);
    case "clp":
      return clp(valor);
    case "accion":
      return ruta ? <Link to={ruta} className="btn btn-sm btn-secundario no-underline">{texto}</Link> : null;
    default:
      return String(texto);
  }
}

import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, resultados } from "../../api/client";
import { useAuth } from "../../auth/contexto";
import Tabla from "../../components/Tabla";
import Timbre from "../../components/Timbre";
import { num } from "../../utils/formato";
import { ESTADOS, puedeEscribir } from "./comun";

const POR_PAGINA = 20;

/** Lista de activos: GET /activos/?estado=&search=&page=. Los filtros viven en la URL (se pueden compartir). */
export default function Lista() {
  const { rol } = useAuth();
  const navegar = useNavigate();
  const [params, setParams] = useSearchParams();
  const estado = params.get("estado") || "";
  const busqueda = params.get("search") || "";
  const pagina = Math.max(1, Number(params.get("page")) || 1);

  const [texto, setTexto] = useState(busqueda);
  // La respuesta guarda los filtros con que se pidió: si no coinciden con los actuales, está cargando.
  const clave = JSON.stringify([estado, busqueda, pagina]);
  const [respuesta, setRespuesta] = useState({ clave: null, datos: { filas: [], total: 0 }, error: "" });
  const cargando = respuesta.clave !== clave;
  const { datos, error } = respuesta;

  useEffect(() => {
    const control = new AbortController();
    api
      .get("/activos/", { params: { estado, search: busqueda, page: pagina, page_size: POR_PAGINA }, signal: control.signal })
      .then((r) => setRespuesta({ clave, datos: resultados(r), error: "" }))
      .catch((e) => {
        if (e?.name !== "AbortError") setRespuesta({ clave, datos: { filas: [], total: 0 }, error: e.message });
      });
    return () => control.abort();
  }, [clave, estado, busqueda, pagina]);

  function cambiar(nuevos) {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(nuevos)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    if (!("page" in nuevos)) p.delete("page");
    setParams(p);
  }

  const paginas = Math.max(1, Math.ceil(datos.total / POR_PAGINA));

  const columnas = [
    { clave: "codigo", titulo: "Código", render: (f) => <Link className="folio" to={`/activos/${f.id}`}>{f.codigo}</Link> },
    { clave: "nombre", titulo: "Activo", render: (f) => (
      <>
        <span className="font-semibold">{f.nombre}</span>
        {(f.marca || f.modelo) && <span className="block text-sm text-texto-2">{[f.marca, f.modelo].filter(Boolean).join(" · ")}</span>}
      </>
    ) },
    { clave: "categoria_nombre", titulo: "Categoría" },
    { clave: "bodega_nombre", titulo: "Bodega", render: (f) => f.bodega_nombre || "—" },
    { clave: "usos_totales", titulo: "Usos", num: true, render: (f) => num(f.usos_totales) },
    { clave: "estado", titulo: "Estado", render: (f) => <Timbre estado={f.estado} texto={f.estado_display} /> },
  ];

  return (
    <section className="hoja">
      <div className="hoja-cabeza flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[1.02rem] font-bold">Activos</h1>
        {puedeEscribir(rol) && (
          <Link to="/activos/nuevo" className="btn btn-primario no-underline">
            <i className="bi bi-plus-lg" aria-hidden="true"></i> Nuevo activo
          </Link>
        )}
      </div>

      <div className="hoja-cuerpo grid gap-3 border-b border-linea-suave">
        <form
          role="search"
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            cambiar({ search: texto.trim() });
          }}
        >
          <label htmlFor="buscar-activo" className="sr-only">Buscar activo</label>
          <input
            id="buscar-activo"
            type="search"
            className="campo max-w-sm flex-1"
            placeholder="Código, nombre, marca, modelo o serie"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
          <button type="submit" className="btn btn-secundario">
            <i className="bi bi-search" aria-hidden="true"></i> Buscar
          </button>
        </form>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por estado">
          {[{ valor: "", texto: "Todos" }, ...ESTADOS].map((e) => (
            <button
              key={e.valor || "todos"}
              type="button"
              className={`btn btn-sm ${estado === e.valor ? "btn-primario" : "btn-secundario"}`}
              aria-pressed={estado === e.valor}
              onClick={() => cambiar({ estado: e.valor })}
            >
              {e.texto}
            </button>
          ))}
        </div>
      </div>

      <Tabla
        titulo="Activos"
        columnas={columnas}
        filas={datos.filas}
        cargando={cargando}
        error={error}
        vacio={busqueda || estado ? "Ningún activo coincide con el filtro." : "Aún no hay activos."}
        onFila={(f) => navegar(`/activos/${f.id}`)}
      />

      {!cargando && !error && datos.total > 0 && (
        <nav className="flex flex-wrap items-center justify-between gap-2 border-t border-linea-suave px-[1.15rem] py-3 text-sm text-texto-2" aria-label="Paginación">
          <span className="num">
            {num(datos.total)} activo{datos.total === 1 ? "" : "s"} · página {pagina} de {paginas}
          </span>
          <span className="flex gap-2">
            <button type="button" className="btn btn-sm btn-secundario" disabled={pagina <= 1} onClick={() => cambiar({ page: String(pagina - 1) })}>
              <i className="bi bi-chevron-left" aria-hidden="true"></i> Anterior
            </button>
            <button type="button" className="btn btn-sm btn-secundario" disabled={pagina >= paginas} onClick={() => cambiar({ page: String(pagina + 1) })}>
              Siguiente <i className="bi bi-chevron-right" aria-hidden="true"></i>
            </button>
          </span>
        </nav>
      )}
    </section>
  );
}

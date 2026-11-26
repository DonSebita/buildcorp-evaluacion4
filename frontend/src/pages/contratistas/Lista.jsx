import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, resultados } from "../../api/client";
import { useAviso } from "../../components/avisos";
import ModalConfirmacion from "../../components/ModalConfirmacion";
import Tabla from "../../components/Tabla";
import Timbre from "../../components/Timbre";
import { num } from "../../utils/formato";
import { usePuedeEscribir } from "./permisos";

const POR_PAGINA = 20;

/** Lista de contratistas: búsqueda (?search=), filtro por estado y paginación de DRF. */
export default function Lista() {
  const navegar = useNavigate();
  const aviso = useAviso();
  const puedeEscribir = usePuedeEscribir();
  const [params, setParams] = useSearchParams();
  const busqueda = params.get("q") ?? "";
  const estado = params.get("estado") ?? "";
  const pagina = Math.max(1, Number(params.get("pagina")) || 1);

  const [texto, setTexto] = useState(busqueda);
  const [carga, setCarga] = useState({ clave: null, datos: { filas: [], total: 0 }, error: "" });
  const [aBorrar, setABorrar] = useState(null);
  const [recarga, setRecarga] = useState(0);

  // Si cambia la URL (atrás/adelante del navegador), el cuadro de búsqueda la sigue.
  const [busquedaPrevia, setBusquedaPrevia] = useState(busqueda);
  if (busquedaPrevia !== busqueda) {
    setBusquedaPrevia(busqueda);
    setTexto(busqueda);
  }

  function cambiarFiltros(cambios) {
    const nuevos = new URLSearchParams(params);
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor === "" || valor === null || valor === undefined || (clave === "pagina" && valor === 1)) nuevos.delete(clave);
      else nuevos.set(clave, String(valor));
    }
    setParams(nuevos, { replace: true });
  }

  // Búsqueda con espera de 350 ms para no pedir al API en cada tecla (cuida el rate limit).
  useEffect(() => {
    if (texto === busqueda) return undefined;
    const t = setTimeout(() => cambiarFiltros({ q: texto.trim(), pagina: 1 }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto]);

  // "cargando" se deriva de la clave de la consulta: sin setState síncrono dentro del efecto.
  const clave = JSON.stringify([busqueda, estado, pagina, recarga]);
  const cargando = carga.clave !== clave;
  const { datos, error } = carga;

  useEffect(() => {
    const control = new AbortController();
    api
      .get("/contratistas/", {
        params: { search: busqueda, estado, page: pagina, page_size: POR_PAGINA },
        signal: control.signal,
      })
      .then((r) => setCarga({ clave, datos: resultados(r), error: "" }))
      .catch((e) => {
        if (e?.name === "AbortError") return;
        // Página fuera de rango (p. ej. tras borrar el último de la página): volver a la 1.
        if (e?.status === 404 && pagina > 1) cambiarFiltros({ pagina: 1 });
        else setCarga({ clave, datos: { filas: [], total: 0 }, error: e.message });
      });
    return () => control.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  const totalPaginas = Math.max(1, Math.ceil(datos.total / POR_PAGINA));

  const columnas = [
    { clave: "rut", titulo: "RUT", render: (f) => <span className="folio">{f.rut}</span> },
    {
      clave: "razon_social",
      titulo: "Razón social",
      render: (f) => (
        <Link to={`/contratistas/${f.id}`} className="font-semibold hover:underline">
          {f.razon_social}
        </Link>
      ),
    },
    { clave: "contacto", titulo: "Contacto", render: (f) => f.contacto || "—" },
    { clave: "obras", titulo: "Obras", num: true, render: (f) => num(f.obras?.length ?? 0) },
    { clave: "estado", titulo: "Estado", render: (f) => <Timbre estado={f.estado} texto={f.estado_display} /> },
  ];
  if (puedeEscribir) {
    columnas.push({
      // Sin "accion: true": en celular la celda flotante de Tabla tapa la primera fila de la ficha,
      // así que las acciones van como una fila más ("Acciones") al final de cada ficha.
      clave: "acciones",
      titulo: "Acciones",
      render: (f) => (
        <div className="flex justify-end gap-1">
          <Link to={`/contratistas/${f.id}/editar`} className="btn btn-sm btn-secundario" aria-label={`Editar ${f.razon_social}`}>
            <i className="bi bi-pencil" aria-hidden="true"></i>
            <span className="max-sm:sr-only">Editar</span>
          </Link>
          <button type="button" className="btn btn-sm btn-secundario" onClick={() => setABorrar(f)} aria-label={`Eliminar ${f.razon_social}`}>
            <i className="bi bi-trash" aria-hidden="true"></i>
            <span className="max-sm:sr-only">Eliminar</span>
          </button>
        </div>
      ),
    });
  }

  return (
    <section className="hoja">
      <div className="hoja-cabeza flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[1.02rem] font-bold">Contratistas</h1>
          <p className="m-0 text-sm text-texto-2">
            {cargando ? "Cargando…" : `${num(datos.total)} contratista${datos.total === 1 ? "" : "s"}`}
          </p>
        </div>
        {puedeEscribir && (
          <Link to="/contratistas/nuevo" className="btn btn-primario">
            <i className="bi bi-plus-lg" aria-hidden="true"></i>
            Nuevo contratista
          </Link>
        )}
      </div>

      <div className="hoja-cuerpo grid gap-4">
        <form className="flex flex-wrap items-end gap-3" role="search" onSubmit={(e) => { e.preventDefault(); cambiarFiltros({ q: texto.trim(), pagina: 1 }); }}>
          <div className="min-w-56 flex-1">
            <label className="etiqueta" htmlFor="buscar-contratista">Buscar</label>
            <input
              id="buscar-contratista"
              type="search"
              className="campo"
              placeholder="RUT, razón social o contacto"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
            />
          </div>
          <div className="w-44">
            <label className="etiqueta" htmlFor="filtro-estado">Estado</label>
            <select id="filtro-estado" className="campo" value={estado} onChange={(e) => cambiarFiltros({ estado: e.target.value, pagina: 1 })}>
              <option value="">Todos</option>
              <option value="ACTIVO">Activo</option>
              <option value="BLOQUEADO">Bloqueado</option>
            </select>
          </div>
        </form>

        <Tabla
          titulo="Lista de contratistas"
          columnas={columnas}
          filas={datos.filas}
          cargando={cargando}
          error={error}
          vacio={busqueda || estado ? "Ningún contratista coincide con la búsqueda." : "Aún no hay contratistas."}
          onFila={(f) => navegar(`/contratistas/${f.id}`)}
        />

        {!cargando && !error && totalPaginas > 1 && (
          <nav className="flex items-center justify-between gap-2" aria-label="Paginación">
            <button type="button" className="btn btn-sm btn-secundario" disabled={pagina <= 1} onClick={() => cambiarFiltros({ pagina: pagina - 1 })}>
              <i className="bi bi-chevron-left" aria-hidden="true"></i> Anterior
            </button>
            <span className="text-sm text-texto-2" aria-live="polite">
              Página {pagina} de {totalPaginas}
            </span>
            <button type="button" className="btn btn-sm btn-secundario" disabled={pagina >= totalPaginas} onClick={() => cambiarFiltros({ pagina: pagina + 1 })}>
              Siguiente <i className="bi bi-chevron-right" aria-hidden="true"></i>
            </button>
          </nav>
        )}
      </div>

      <ModalConfirmacion
        abierto={!!aBorrar}
        titulo="Eliminar contratista"
        mensaje={aBorrar ? `¿Eliminar a ${aBorrar.razon_social} (${aBorrar.rut}) y sus obras? Esta acción no se puede deshacer.` : ""}
        textoConfirmar="Eliminar"
        peligro
        onConfirmar={async () => {
          await api.delete(`/contratistas/${aBorrar.id}/`); // un 409 (préstamos asociados) se muestra en el modal
          aviso(`${aBorrar.razon_social} eliminado.`);
          setRecarga((n) => n + 1);
        }}
        onCerrar={() => setABorrar(null)}
      />
    </section>
  );
}

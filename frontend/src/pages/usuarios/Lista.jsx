import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, resultados } from "../../api/client";
import { useAuth } from "../../auth/contexto";
import { TODOS } from "../../auth/roles";
import { useAviso } from "../../components/avisos";
import ModalConfirmacion from "../../components/ModalConfirmacion";
import Tabla from "../../components/Tabla";
import Timbre from "../../components/Timbre";
import { fechaHora, num } from "../../utils/formato";
import DialogoClave from "./DialogoClave";

const POR_PAGINA = 25;

/** Trabajadores: búsqueda, filtros por rol y estado, activar/desactivar y restablecer clave. */
export default function Lista() {
  const aviso = useAviso();
  const { usuario: yo } = useAuth();
  const [params, setParams] = useSearchParams();
  const busqueda = params.get("q") ?? "";
  const rol = params.get("rol") ?? "";
  const activo = params.get("activo") ?? "";
  const pagina = Math.max(1, Number(params.get("pagina")) || 1);

  const [texto, setTexto] = useState(busqueda);
  const [carga, setCarga] = useState({ clave: null, datos: { filas: [], total: 0 }, error: "" });
  const [recarga, setRecarga] = useState(0);
  const [aCambiar, setACambiar] = useState(null);
  const [aClave, setAClave] = useState(null);

  function cambiarFiltros(cambios) {
    const nuevos = new URLSearchParams(params);
    for (const [k, v] of Object.entries(cambios)) {
      if (v === "" || v === null || v === undefined || (k === "pagina" && v === 1)) nuevos.delete(k);
      else nuevos.set(k, String(v));
    }
    setParams(nuevos, { replace: true });
  }

  useEffect(() => {
    if (texto === busqueda) return undefined;
    const t = setTimeout(() => cambiarFiltros({ q: texto.trim(), pagina: 1 }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto]);

  const clave = JSON.stringify([busqueda, rol, activo, pagina, recarga]);
  const cargando = carga.clave !== clave;
  const { datos, error } = carga;

  useEffect(() => {
    const control = new AbortController();
    api
      .get("/usuarios/", { params: { search: busqueda, rol, is_active: activo, page: pagina, page_size: POR_PAGINA }, signal: control.signal })
      .then((r) => setCarga({ clave, datos: resultados(r), error: "" }))
      .catch((e) => {
        if (e?.name === "AbortError") return;
        if (e?.status === 404 && pagina > 1) cambiarFiltros({ pagina: 1 });
        else setCarga({ clave, datos: { filas: [], total: 0 }, error: e.message });
      });
    return () => control.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  const totalPaginas = Math.max(1, Math.ceil(datos.total / POR_PAGINA));

  const columnas = [
    {
      clave: "nombre",
      titulo: "Trabajador",
      render: (f) => (
        <div>
          <Link to={`/usuarios/${f.id}/editar`} className="font-semibold hover:underline">{f.nombre}</Link>
          {f.id === yo?.id && <span className="text-sm text-texto-2"> (tú)</span>}
          <div className="folio text-sm text-texto-2">{f.username}</div>
        </div>
      ),
    },
    { clave: "rol", titulo: "Rol", render: (f) => (f.rol ? <Timbre estado="INFO" texto={f.rol} /> : <Timbre estado="PENDIENTE" texto="Sin rol" />) },
    { clave: "cargo", titulo: "Cargo", render: (f) => f.cargo || "—" },
    { clave: "rut", titulo: "RUT", render: (f) => (f.rut ? <span className="folio">{f.rut}</span> : "—") },
    { clave: "last_login", titulo: "Último acceso", render: (f) => (f.last_login ? fechaHora(f.last_login) : "Nunca") },
    { clave: "is_active", titulo: "Estado", render: (f) => (f.is_active ? <Timbre estado="ACTIVO" texto="Activo" /> : <Timbre estado="DADO_DE_BAJA" texto="Inactivo" />) },
    {
      clave: "acciones",
      titulo: "Acciones",
      render: (f) => (
        <div className="flex flex-wrap justify-end gap-1">
          <Link to={`/usuarios/${f.id}/editar`} className="btn btn-sm btn-secundario" aria-label={`Editar ${f.nombre}`}>
            <i className="bi bi-pencil" aria-hidden="true"></i>
            <span className="max-sm:sr-only">Editar</span>
          </Link>
          <button type="button" className="btn btn-sm btn-secundario" onClick={() => setAClave(f)} aria-label={`Restablecer clave de ${f.nombre}`}>
            <i className="bi bi-key" aria-hidden="true"></i>
            <span className="max-sm:sr-only">Clave</span>
          </button>
          {f.id !== yo?.id && (
            <button type="button" className={`btn btn-sm ${f.is_active ? "btn-peligro" : "btn-secundario"}`} onClick={() => setACambiar(f)}>
              <i className={`bi ${f.is_active ? "bi-person-slash" : "bi-person-check"}`} aria-hidden="true"></i>
              <span className="max-sm:sr-only">{f.is_active ? "Desactivar" : "Activar"}</span>
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <section className="hoja">
      <div className="hoja-cabeza flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[1.02rem] font-bold">Trabajadores</h1>
          <p className="m-0 text-sm text-texto-2">
            {cargando ? "Cargando…" : `${num(datos.total)} trabajador${datos.total === 1 ? "" : "es"}`} · cuentas y roles del personal
          </p>
        </div>
        <Link to="/usuarios/nuevo" className="btn btn-primario">
          <i className="bi bi-person-plus" aria-hidden="true"></i>
          Nuevo trabajador
        </Link>
      </div>

      <div className="hoja-cuerpo grid gap-4">
        <form className="flex flex-wrap items-end gap-3" role="search" onSubmit={(e) => { e.preventDefault(); cambiarFiltros({ q: texto.trim(), pagina: 1 }); }}>
          <div className="min-w-56 flex-1">
            <label className="etiqueta" htmlFor="buscar-usuario">Buscar</label>
            <input id="buscar-usuario" type="search" className="campo" placeholder="Usuario, nombre, RUT, correo o cargo" value={texto} onChange={(e) => setTexto(e.target.value)} />
          </div>
          <div className="w-48">
            <label className="etiqueta" htmlFor="filtro-rol">Rol</label>
            <select id="filtro-rol" className="campo" value={rol} onChange={(e) => cambiarFiltros({ rol: e.target.value, pagina: 1 })}>
              <option value="">Todos</option>
              {TODOS.map((r) => <option key={r} value={r}>{r}</option>)}
              <option value="sin_rol">Sin rol</option>
            </select>
          </div>
          <div className="w-40">
            <label className="etiqueta" htmlFor="filtro-activo">Estado</label>
            <select id="filtro-activo" className="campo" value={activo} onChange={(e) => cambiarFiltros({ activo: e.target.value, pagina: 1 })}>
              <option value="">Todos</option>
              <option value="true">Activos</option>
              <option value="false">Inactivos</option>
            </select>
          </div>
        </form>

        <Tabla
          titulo="Lista de trabajadores"
          columnas={columnas}
          filas={datos.filas}
          cargando={cargando}
          error={error}
          vacio={busqueda || rol || activo ? "Ningún trabajador coincide con los filtros." : "Aún no hay trabajadores."}
        />

        {!cargando && !error && totalPaginas > 1 && (
          <nav className="flex items-center justify-between gap-2" aria-label="Paginación">
            <button type="button" className="btn btn-sm btn-secundario" disabled={pagina <= 1} onClick={() => cambiarFiltros({ pagina: pagina - 1 })}>
              <i className="bi bi-chevron-left" aria-hidden="true"></i> Anterior
            </button>
            <span className="text-sm text-texto-2" aria-live="polite">Página {pagina} de {totalPaginas}</span>
            <button type="button" className="btn btn-sm btn-secundario" disabled={pagina >= totalPaginas} onClick={() => cambiarFiltros({ pagina: pagina + 1 })}>
              Siguiente <i className="bi bi-chevron-right" aria-hidden="true"></i>
            </button>
          </nav>
        )}
      </div>

      <ModalConfirmacion
        abierto={!!aCambiar}
        titulo={aCambiar?.is_active ? "Desactivar trabajador" : "Activar trabajador"}
        mensaje={
          aCambiar?.is_active
            ? `${aCambiar.nombre} no podrá iniciar sesión y se cerrarán sus sesiones abiertas. Su historial (préstamos, firmas) se conserva.`
            : `${aCambiar?.nombre ?? ""} podrá volver a iniciar sesión con su clave.`
        }
        textoConfirmar={aCambiar?.is_active ? "Desactivar" : "Activar"}
        peligro={Boolean(aCambiar?.is_active)}
        onConfirmar={async () => {
          await api.post(`/usuarios/${aCambiar.id}/${aCambiar.is_active ? "desactivar" : "activar"}/`);
          aviso(`${aCambiar.nombre} ${aCambiar.is_active ? "desactivado" : "activado"}.`);
          setRecarga((n) => n + 1);
        }}
        onCerrar={() => setACambiar(null)}
      />
      <DialogoClave usuario={aClave} abierto={!!aClave} onCerrar={() => setAClave(null)} onHecho={() => aviso(`Clave de ${aClave.nombre} restablecida.`)} />
    </section>
  );
}

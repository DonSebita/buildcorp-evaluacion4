import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../auth/contexto";
import { Aviso } from "../../components/Aviso";
import { useAviso } from "../../components/avisos";
import Cargando from "../../components/Cargando";
import Tabla from "../../components/Tabla";
import Timbre from "../../components/Timbre";
import { clp, fecha, fechaHora, num } from "../../utils/formato";
import DialogoBaja from "./DialogoBaja";
import FotoActivo from "./FotoActivo";
import { puedeDarDeBaja, puedeEscribir, textoEstado } from "./comun";

/**
 * Ficha del activo con foto y hoja de vida (GET /activos/{id}/hoja-vida/).
 * Acepta también el código (/activos/RTM-0001, como los enlaces de la app Django y del dashboard):
 * lo resuelve con GET /activos/codigo/{codigo}/ y redirige a /activos/{id}.
 */
export default function Ficha() {
  const { id: param } = useParams();
  const navegar = useNavigate();
  const esId = /^\d+$/.test(param);
  const id = esId ? param : null;
  const { rol } = useAuth();
  const aviso = useAviso();
  // hoja y error quedan asociados al parámetro de la URL; si cambia, se muestra "cargando" sin efectos extra.
  const [estadoFicha, setEstadoFicha] = useState({ param: null, hoja: null, error: "" });
  const actual = estadoFicha.param === param;
  const hoja = actual ? estadoFicha.hoja : null;
  const error = actual ? estadoFicha.error : "";
  const [baja, setBaja] = useState(false);
  const [timbrar, setTimbrar] = useState(false);

  const cargar = useCallback(async () => {
    const datos = await api.get(`/activos/${id}/hoja-vida/`);
    setEstadoFicha({ param: id, hoja: datos, error: "" });
    return datos;
  }, [id]);

  useEffect(() => {
    const fallar = (mensaje) => setEstadoFicha({ param, hoja: null, error: mensaje });
    if (esId) {
      api
        .get(`/activos/${param}/hoja-vida/`)
        .then((datos) => setEstadoFicha({ param, hoja: datos, error: "" }))
        .catch((e) => fallar(e.message));
    } else {
      api
        .get(`/activos/codigo/${encodeURIComponent(param)}/`)
        .then((a) => navegar(`/activos/${a.id}`, { replace: true }))
        .catch((e) => fallar(e.status === 404 ? `No existe un activo con código ${param}.` : e.message));
    }
  }, [esId, param, navegar]);

  /** La URL prefirmada expiró: se pide solo el activo para obtener una nueva. */
  const refrescarFoto = useCallback(async () => {
    const activo = await api.get(`/activos/${id}/`);
    setEstadoFicha((e) => (e.hoja ? { ...e, hoja: { ...e.hoja, activo } } : e));
    return activo;
  }, [id]);

  if (error) {
    return (
      <section className="hoja">
        <div className="hoja-cuerpo grid gap-3">
          <Aviso tipo="error">{error}</Aviso>
          <Link to="/activos">Volver a la lista</Link>
        </div>
      </section>
    );
  }
  if (!hoja) return <Cargando texto="Cargando ficha…" />;

  const a = hoja.activo;
  const dadoDeBaja = a.estado === "DADO_DE_BAJA";

  const datos = [
    ["Categoría", a.categoria_nombre],
    ["Marca", a.marca],
    ["Modelo", a.modelo],
    ["N.º de serie", a.numero_serie],
    ["Bodega", a.bodega_nombre],
    ["Adquisición", fecha(a.fecha_adquisicion)],
    ["Valor de compra", clp(a.valor_compra)],
    ["Horas de uso", `${num(a.horas_uso_totales)} h`],
    ["Usos totales", num(a.usos_totales)],
    ["Usos desde la mantención", num(a.usos_desde_mantencion)],
  ];

  return (
    <div className="grid gap-5">
      <nav className="text-sm" aria-label="Ruta">
        <Link to="/activos">Activos</Link> <span className="text-texto-2">/ {a.codigo}</span>
      </nav>

      <section className="hoja">
        <div className="hoja-cabeza flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[1.15rem] font-bold">
              <span className="folio">{a.codigo}</span> · {a.nombre}
            </h1>
            <Timbre estado={a.estado} texto={a.estado_display} grande nuevo={timbrar} />
          </div>
          <div className="flex flex-wrap gap-2">
            {puedeEscribir(rol) && !dadoDeBaja && (
              <Link to={`/activos/${a.id}/editar`} className="btn btn-secundario no-underline">
                <i className="bi bi-pencil" aria-hidden="true"></i> Editar
              </Link>
            )}
            {puedeDarDeBaja(rol) && !dadoDeBaja && (
              <button type="button" className="btn btn-peligro" onClick={() => setBaja(true)} disabled={a.estado === "EN_USO"} title={a.estado === "EN_USO" ? "Está arrendado: espera la devolución" : undefined}>
                <i className="bi bi-archive" aria-hidden="true"></i> Dar de baja
              </button>
            )}
          </div>
        </div>
        <div className="hoja-cuerpo grid gap-6 md:grid-cols-[minmax(0,320px)_1fr]">
          <FotoActivo activo={a} onRefrescar={refrescarFoto} />
          <div className="grid gap-4">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
              {datos.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-b border-linea-suave py-1.5">
                  <dt className="text-texto-2">{k}</dt>
                  <dd className="num m-0 text-right font-semibold">{v || "—"}</dd>
                </div>
              ))}
            </dl>
            {a.mantencion && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold">Mantención:</span>
                <Timbre estado={a.mantencion.situacion} />
                <span className="text-texto-2">{a.mantencion.criterio}</span>
              </div>
            )}
          </div>
        </div>
      </section>

      <HojaDeVida hoja={hoja} />

      <DialogoBaja
        activo={a}
        abierto={baja}
        onCerrar={() => setBaja(false)}
        onHecho={() => {
          aviso(`${a.codigo} quedó dado de baja.`);
          setTimbrar(true);
          cargar().catch((e) => aviso(e.message, "error"));
        }}
      />
    </div>
  );
}

function HojaDeVida({ hoja }) {
  const [pestana, setPestana] = useState("historial");
  const pestanas = [
    { clave: "historial", texto: "Estados", n: hoja.historial?.length || 0 },
    { clave: "mantenimientos", texto: "Mantenciones", n: hoja.mantenimientos?.length || 0 },
    { clave: "traslados", texto: "Traslados", n: hoja.traslados?.length || 0 },
  ];

  const tablas = {
    historial: {
      columnas: [
        { clave: "fecha", titulo: "Fecha", render: (f) => fechaHora(f.fecha) },
        { clave: "cambio", titulo: "Cambio", render: (f) => (
          <span className="inline-flex flex-wrap items-center gap-1.5">
            {f.estado_anterior ? <Timbre estado={f.estado_anterior} texto={textoEstado(f.estado_anterior)} /> : <span className="text-texto-2">Alta</span>}
            <i className="bi bi-arrow-right text-texto-2" aria-label="pasa a"></i>
            <Timbre estado={f.estado_nuevo} texto={textoEstado(f.estado_nuevo)} />
          </span>
        ) },
        { clave: "motivo", titulo: "Motivo", render: (f) => f.motivo || "—" },
        { clave: "referencia", titulo: "Referencia", render: (f) => (f.referencia ? <span className="folio">{f.referencia}</span> : "—") },
        { clave: "usuario", titulo: "Usuario", render: (f) => f.usuario || "—" },
      ],
      filas: hoja.historial || [],
      vacio: "Sin cambios de estado registrados.",
      claveFila: () => null, // sin id: se usa la posición
    },
    mantenimientos: {
      columnas: [
        { clave: "folio", titulo: "Folio", render: (f) => <span className="folio">{f.folio}</span> },
        { clave: "fecha", titulo: "Fecha", render: (f) => fecha(f.fecha) },
        { clave: "tipo", titulo: "Tipo", render: (f) => f.tipo_display || f.tipo },
        { clave: "tecnico", titulo: "Técnico" },
        { clave: "descripcion", titulo: "Trabajo" },
        { clave: "costo", titulo: "Costo", num: true, render: (f) => clp(f.costo) },
      ],
      filas: hoja.mantenimientos || [],
      vacio: "Sin mantenciones registradas.",
    },
    traslados: {
      columnas: [
        { clave: "fecha", titulo: "Fecha", render: (f) => fechaHora(f.fecha) },
        { clave: "bodega_origen", titulo: "Desde", render: (f) => f.bodega_origen || "—" },
        { clave: "bodega_destino", titulo: "Hacia" },
        { clave: "usuario", titulo: "Usuario", render: (f) => f.usuario || "—" },
        { clave: "observacion", titulo: "Observación", render: (f) => f.observacion || "—" },
      ],
      filas: hoja.traslados || [],
      vacio: "Sin traslados registrados.",
      claveFila: () => null,
    },
  };
  const t = tablas[pestana];

  return (
    <section className="hoja" aria-labelledby="hoja-vida-titulo">
      <div className="hoja-cabeza flex flex-wrap items-center justify-between gap-3">
        <h2 id="hoja-vida-titulo">Hoja de vida</h2>
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Secciones de la hoja de vida">
          {pestanas.map((p) => (
            <button
              key={p.clave}
              type="button"
              role="tab"
              aria-selected={pestana === p.clave}
              className={`btn btn-sm ${pestana === p.clave ? "btn-primario" : "btn-secundario"}`}
              onClick={() => setPestana(p.clave)}
            >
              {p.texto} <span className="num opacity-75">({p.n})</span>
            </button>
          ))}
        </div>
      </div>
      <div role="tabpanel">
        <Tabla titulo={`Hoja de vida · ${pestana}`} columnas={t.columnas} filas={t.filas} vacio={t.vacio} claveFila={t.claveFila} />
      </div>
    </section>
  );
}

import { useEffect, useState } from "react";
import { api, resultados } from "../../api/client";
import { useAviso } from "../../components/avisos";
import ModalConfirmacion from "../../components/ModalConfirmacion";
import Tabla from "../../components/Tabla";
import Timbre from "../../components/Timbre";
import { clp, fecha, num } from "../../utils/formato";

const POR_PAGINA = 25;

/** Cobros (Administrador y Ventas): GET /cobros/?estado= y POST /cobros/{id}/pagar/. */
export default function Cobros() {
  const aviso = useAviso();
  const [estado, setEstado] = useState("PENDIENTE");
  const [pagina, setPagina] = useState(1);
  const [recarga, setRecarga] = useState(0);
  const [aPagar, setAPagar] = useState(null);
  const [carga, setCarga] = useState({ clave: null, datos: { filas: [], total: 0 }, error: "" });

  const clave = JSON.stringify([estado, pagina, recarga]);
  const cargando = carga.clave !== clave;
  const { datos, error } = carga;

  useEffect(() => {
    const control = new AbortController();
    api
      .get("/cobros/", { params: { estado, page: pagina, page_size: POR_PAGINA }, signal: control.signal })
      .then((r) => setCarga({ clave, datos: resultados(r), error: "" }))
      .catch((e) => e?.name !== "AbortError" && setCarga({ clave, datos: { filas: [], total: 0 }, error: e.message }));
    return () => control.abort();
  }, [clave, estado, pagina]);

  const totalPaginas = Math.max(1, Math.ceil(datos.total / POR_PAGINA));
  const sumaPagina = datos.filas.reduce((s, f) => s + Number(f.total || 0), 0);

  const columnas = [
    { clave: "prestamo_codigo", titulo: "Préstamo", render: (f) => <span className="folio">{f.prestamo_codigo}</span> },
    { clave: "contratista", titulo: "Contratista" },
    { clave: "dias_cobrados", titulo: "Días", num: true, render: (f) => `${num(f.dias_cobrados)}${f.dias_atraso ? ` (+${f.dias_atraso} atraso)` : ""}` },
    { clave: "neto", titulo: "Neto", num: true, render: (f) => clp(f.neto) },
    { clave: "iva", titulo: "IVA", num: true, render: (f) => clp(f.iva) },
    { clave: "total", titulo: "Total", num: true, render: (f) => <strong>{clp(f.total)}</strong> },
    { clave: "creado", titulo: "Emitido", render: (f) => fecha(f.creado) },
    { clave: "estado", titulo: "Estado", render: (f) => <Timbre estado={f.estado} texto={f.fecha_pago ? `Pagado ${fecha(f.fecha_pago)}` : f.estado_display} /> },
    {
      clave: "acciones",
      titulo: "",
      render: (f) =>
        f.estado === "PENDIENTE" ? (
          <button type="button" className="btn btn-sm btn-primario" onClick={() => setAPagar(f)}>
            <i className="bi bi-cash-coin" aria-hidden="true"></i> Registrar pago
          </button>
        ) : null,
    },
  ];

  return (
    <section className="hoja">
      <div className="hoja-cabeza flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[1.02rem] font-bold">Cobros</h1>
          <p className="m-0 text-sm text-texto-2">
            {cargando ? "Cargando…" : `${num(datos.total)} cobro${datos.total === 1 ? "" : "s"} · ${clp(sumaPagina)} en esta página`}
          </p>
        </div>
        <div className="w-44">
          <label className="etiqueta" htmlFor="filtro-cobro">Estado</label>
          <select id="filtro-cobro" className="campo" value={estado} onChange={(e) => { setEstado(e.target.value); setPagina(1); }}>
            <option value="PENDIENTE">Pendientes</option>
            <option value="PAGADO">Pagados</option>
            <option value="">Todos</option>
          </select>
        </div>
      </div>
      <div className="hoja-cuerpo grid gap-4">
        <Tabla titulo="Cobros" columnas={columnas} filas={datos.filas} cargando={cargando} error={error} vacio="No hay cobros con ese estado." />
        {!cargando && !error && totalPaginas > 1 && (
          <nav className="flex items-center justify-between gap-2" aria-label="Paginación">
            <button type="button" className="btn btn-sm btn-secundario" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>Anterior</button>
            <span className="text-sm text-texto-2">Página {pagina} de {totalPaginas}</span>
            <button type="button" className="btn btn-sm btn-secundario" disabled={pagina >= totalPaginas} onClick={() => setPagina(pagina + 1)}>Siguiente</button>
          </nav>
        )}
      </div>
      <ModalConfirmacion
        abierto={!!aPagar}
        titulo="Registrar pago"
        mensaje={aPagar ? `¿Registrar el pago de ${clp(aPagar.total)} de ${aPagar.contratista} (${aPagar.prestamo_codigo})? El préstamo quedará cerrado.` : ""}
        textoConfirmar="Registrar pago"
        onConfirmar={async () => {
          await api.post(`/cobros/${aPagar.id}/pagar/`);
          aviso(`Pago de ${aPagar.prestamo_codigo} registrado.`);
          setRecarga((n) => n + 1);
        }}
        onCerrar={() => setAPagar(null)}
      />
    </section>
  );
}

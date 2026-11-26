import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, resultados } from "../../api/client";
import { useAuth } from "../../auth/contexto";
import { useAviso } from "../../components/avisos";
import Cargando from "../../components/Cargando";
import Timbre from "../../components/Timbre";
import { fechaHora, num } from "../../utils/formato";
import { rutaInterna } from "../dashboard/enlaces";

const NIVEL_TEXTO = { CRITICO: "Crítica", WARNING: "Atención", INFO: "Aviso" };
const TIPOS = [
  { valor: "", texto: "Todos los tipos" },
  { valor: "SOLICITUD_DESBLOQUEO", texto: "Solicitudes de desbloqueo" },
  { valor: "SOLICITUD_BAJA", texto: "Solicitudes de baja" },
  { valor: "MOROSIDAD", texto: "Morosidad" },
  { valor: "BLOQUEO", texto: "Contratista bloqueado" },
  { valor: "MANTENCION_VENCIDA", texto: "Mantención vencida" },
  { valor: "MANTENCION_PROXIMA", texto: "Mantención próxima" },
  { valor: "DANO", texto: "Daño o faltante" },
];

/**
 * Bandeja de alertas (GET /alertas/). Cada rol ve las suyas; el Administrador ve todas, incluidas
 * las solicitudes de desbloqueo (de Ventas) y de baja (del Bodeguero) que debe atender.
 */
export default function Alertas() {
  const { rol } = useAuth();
  const aviso = useAviso();
  const [tipo, setTipo] = useState("");
  const [verResueltas, setVerResueltas] = useState(false);
  const [recarga, setRecarga] = useState(0);
  const [carga, setCarga] = useState({ clave: null, filas: [], total: 0, error: "" });

  const clave = JSON.stringify([tipo, verResueltas, recarga]);
  const cargando = carga.clave !== clave;

  useEffect(() => {
    const control = new AbortController();
    api
      .get("/alertas/", { params: { tipo, resuelta: verResueltas ? "" : "false", page_size: 100 }, signal: control.signal })
      .then((r) => {
        const { filas, total } = resultados(r);
        setCarga({ clave, filas, total, error: "" });
      })
      .catch((e) => e?.name !== "AbortError" && setCarga({ clave, filas: [], total: 0, error: e.message }));
    return () => control.abort();
  }, [clave, tipo, verResueltas]);

  async function accion(alerta, que) {
    try {
      await api.post(`/alertas/${alerta.id}/${que}/`);
      if (que === "resolver") aviso("Alerta resuelta.");
      setRecarga((n) => n + 1);
    } catch (e) {
      aviso(e.message, "error");
    }
  }

  return (
    <section className="hoja">
      <div className="hoja-cabeza flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[1.02rem] font-bold">Alertas</h1>
          <p className="m-0 text-sm text-texto-2">
            {cargando ? "Cargando…" : `${num(carga.total)} alerta${carga.total === 1 ? "" : "s"}${verResueltas ? "" : " abiertas"}`}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-60">
            <label className="etiqueta" htmlFor="filtro-tipo">Tipo</label>
            <select id="filtro-tipo" className="campo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {TIPOS.map((t) => <option key={t.valor} value={t.valor}>{t.texto}</option>)}
            </select>
          </div>
          <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
            <input type="checkbox" className="size-5 accent-tinta" checked={verResueltas} onChange={(e) => setVerResueltas(e.target.checked)} />
            Incluir resueltas
          </label>
        </div>
      </div>

      {cargando ? (
        <Cargando />
      ) : carga.error ? (
        <div className="vacio" role="alert"><i className="bi bi-exclamation-octagon text-crit" aria-hidden="true"></i>{carga.error}</div>
      ) : !carga.filas.length ? (
        <div className="vacio"><i className="bi bi-check2-circle" aria-hidden="true"></i>No hay alertas pendientes.</div>
      ) : (
        <ul className="m-0 list-none p-0">
          {carga.filas.map((a) => {
            const ruta = rutaInterna(a.enlace, rol);
            return (
              <li key={a.id} className={`flex flex-wrap items-start gap-3 border-b border-linea-suave px-[1.15rem] py-3 last:border-b-0 ${a.resuelta ? "opacity-60" : ""}`}>
                <Timbre estado={a.resuelta ? "CERRADO" : a.nivel} texto={a.resuelta ? "Resuelta" : NIVEL_TEXTO[a.nivel] || a.nivel} />
                <div className="min-w-0 flex-1">
                  <div className={a.leida ? "" : "font-semibold"}>{ruta ? <Link to={ruta}>{a.mensaje}</Link> : a.mensaje}</div>
                  <div className="text-sm text-texto-2">
                    {a.tipo_display} · {fechaHora(a.fecha)}
                    {a.rol_destino ? ` · para ${a.rol_destino}` : ""}
                  </div>
                </div>
                {!a.resuelta && (
                  <div className="flex gap-1">
                    {!a.leida && (
                      <button type="button" className="btn btn-sm btn-secundario" onClick={() => accion(a, "marcar-leida")}>
                        <i className="bi bi-eye" aria-hidden="true"></i> <span className="max-sm:sr-only">Leída</span>
                      </button>
                    )}
                    <button type="button" className="btn btn-sm btn-secundario" onClick={() => accion(a, "resolver")}>
                      <i className="bi bi-check2" aria-hidden="true"></i> <span className="max-sm:sr-only">Resolver</span>
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

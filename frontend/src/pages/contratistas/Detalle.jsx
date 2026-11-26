import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../api/client";
import { Aviso } from "../../components/Aviso";
import { useAviso } from "../../components/avisos";
import Cargando from "../../components/Cargando";
import ModalConfirmacion from "../../components/ModalConfirmacion";
import Timbre from "../../components/Timbre";
import { fechaHora } from "../../utils/formato";
import Obras from "./Obras";
import { useAccionesBloqueo, usePuedeEscribir } from "./permisos";

/** Ficha del contratista con sus obras anidadas (vienen en GET /contratistas/{id}/). */
export default function Detalle() {
  const { id } = useParams();
  const navegar = useNavigate();
  const aviso = useAviso();
  const puedeEscribir = usePuedeEscribir();
  const { puedeDesbloquear, puedeSolicitar } = useAccionesBloqueo();
  const [contratista, setContratista] = useState(null);
  const [error, setError] = useState("");
  const [borrando, setBorrando] = useState(false);
  const [bloqueo, setBloqueo] = useState(null); // "desbloquear" | "solicitar"
  const [motivo, setMotivo] = useState("");

  // Recarga tras crear, inactivar o borrar una obra (las obras vienen anidadas en el contratista).
  const cargar = useCallback(async () => {
    try {
      setContratista(await api.get(`/contratistas/${id}/`));
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }, [id]);

  useEffect(() => {
    const control = new AbortController();
    api
      .get(`/contratistas/${id}/`, { signal: control.signal })
      .then((c) => {
        setContratista(c);
        setError("");
      })
      .catch((e) => e?.name !== "AbortError" && setError(e.message));
    return () => control.abort();
  }, [id]);

  if (error && !contratista) {
    return (
      <section className="hoja">
        <div className="hoja-cuerpo grid gap-3">
          <Aviso tipo="error">{error}</Aviso>
          <Link to="/contratistas" className="btn btn-secundario justify-self-start">Volver a contratistas</Link>
        </div>
      </section>
    );
  }
  if (!contratista) return <Cargando />;

  const c = contratista;
  const bloqueado = c.estado === "BLOQUEADO";

  return (
    <div className="grid gap-5">
      <section className="hoja">
        <div className="hoja-cabeza flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link to="/contratistas" className="text-sm text-texto-2 hover:underline">
              <i className="bi bi-arrow-left" aria-hidden="true"></i> Contratistas
            </Link>
            <h1 className="flex flex-wrap items-center gap-2 text-[1.15rem] font-bold">
              {c.razon_social}
              <Timbre estado={c.estado} texto={c.estado_display} grande />
            </h1>
            <span className="folio">{c.rut}</span>
          </div>
          {puedeEscribir && (
            <div className="flex flex-wrap gap-2">
              <Link to={`/contratistas/${c.id}/editar`} className="btn btn-secundario">
                <i className="bi bi-pencil" aria-hidden="true"></i> Editar
              </Link>
              <button type="button" className="btn btn-peligro" onClick={() => setBorrando(true)}>
                <i className="bi bi-trash" aria-hidden="true"></i> Eliminar
              </button>
            </div>
          )}
        </div>

        <div className="hoja-cuerpo grid gap-4">
          {bloqueado && (
            <Aviso tipo="warning">
              <strong>Bloqueado por morosidad</strong>
              {c.fecha_bloqueo ? ` desde ${fechaHora(c.fecha_bloqueo)}` : ""}. {c.motivo_bloqueo}
              <div className="mt-1">No se le pueden asignar obras nuevas ni préstamos.</div>
              {(puedeDesbloquear || puedeSolicitar) && (
                <button type="button" className="btn btn-sm btn-secundario mt-2" onClick={() => { setMotivo(""); setBloqueo(puedeDesbloquear ? "desbloquear" : "solicitar"); }}>
                  <i className="bi bi-unlock" aria-hidden="true"></i>
                  {puedeDesbloquear ? "Desbloquear" : "Solicitar desbloqueo"}
                </button>
              )}
            </Aviso>
          )}

          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
            <Dato titulo="Contacto" valor={c.contacto} />
            <Dato titulo="Correo" valor={c.email} enlace={c.email ? `mailto:${c.email}` : null} />
            <Dato titulo="Teléfono" valor={c.telefono} enlace={c.telefono ? `tel:${c.telefono.replace(/\s/g, "")}` : null} />
          </dl>
        </div>
      </section>

      <Obras contratista={c} puedeEscribir={puedeEscribir} onCambio={() => cargar()} />

      <ModalConfirmacion
        abierto={borrando}
        titulo="Eliminar contratista"
        mensaje={`¿Eliminar a ${c.razon_social} y sus ${c.obras.length} obra(s)? Esta acción no se puede deshacer.`}
        textoConfirmar="Eliminar"
        peligro
        onConfirmar={async () => {
          await api.delete(`/contratistas/${c.id}/`); // 409 si tiene préstamos: se muestra en el modal
          aviso(`${c.razon_social} eliminado.`);
          navegar("/contratistas", { replace: true });
        }}
        onCerrar={() => setBorrando(false)}
      />

      <ModalConfirmacion
        abierto={!!bloqueo}
        titulo={bloqueo === "desbloquear" ? "Desbloquear contratista" : "Solicitar desbloqueo"}
        mensaje={
          <span className="grid gap-2">
            <span>
              {bloqueo === "desbloquear"
                ? `${c.razon_social} volverá a quedar activo. Indica el motivo (queda registrado).`
                : "Se enviará una alerta al Administrador. Indica el motivo."}
            </span>
            <label className="etiqueta" htmlFor="motivo-bloqueo">Motivo</label>
            <textarea id="motivo-bloqueo" className="campo min-h-20" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </span>
        }
        textoConfirmar={bloqueo === "desbloquear" ? "Desbloquear" : "Enviar solicitud"}
        onConfirmar={async () => {
          if (bloqueo === "desbloquear") {
            setContratista(await api.post(`/contratistas/${c.id}/desbloquear/`, { motivo }));
            aviso(`${c.razon_social} desbloqueado.`);
          } else {
            const r = await api.post(`/contratistas/${c.id}/solicitar-desbloqueo/`, { motivo });
            aviso(r?.detail || "Solicitud enviada.");
          }
        }}
        onCerrar={() => setBloqueo(null)}
      />
    </div>
  );
}

function Dato({ titulo, valor, enlace }) {
  return (
    <div>
      <dt className="text-xs font-semibold tracking-wide text-texto-2 uppercase">{titulo}</dt>
      <dd className="m-0 break-words">{valor ? enlace ? <a href={enlace} className="hover:underline">{valor}</a> : valor : "—"}</dd>
    </div>
  );
}

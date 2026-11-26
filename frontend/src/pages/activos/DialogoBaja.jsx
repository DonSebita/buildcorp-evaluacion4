import { useEffect, useRef, useState } from "react";
import { api } from "../../api/client";
import { Aviso } from "../../components/Aviso";

/**
 * Dar de baja un activo (solo Administrador): POST /activos/{id}/cambiar-estado/
 * con {estado: "DADO_DE_BAJA", motivo}. Los activos no se borran: queda en su historial.
 */
export default function DialogoBaja({ activo, abierto, onCerrar, onHecho }) {
  const ref = useRef(null);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierto && !d.open) {
      setMotivo("");
      setError("");
      d.showModal();
    } else if (!abierto && d.open) d.close();
  }, [abierto]);

  async function confirmar(e) {
    e.preventDefault();
    if (!motivo.trim()) {
      setError("Escribe el motivo de la baja.");
      return;
    }
    setOcupado(true);
    setError("");
    try {
      const actualizado = await api.post(`/activos/${activo.id}/cambiar-estado/`, { estado: "DADO_DE_BAJA", motivo: motivo.trim() });
      onHecho?.(actualizado);
      onCerrar?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        if (!ocupado) onCerrar?.();
      }}
      className="hoja m-auto w-[min(480px,calc(100vw-2rem))] p-0 text-texto backdrop:bg-texto/40"
      aria-labelledby="baja-titulo"
    >
      <form onSubmit={confirmar} noValidate>
        <div className="hoja-cabeza">
          <h2 id="baja-titulo">Dar de baja {activo?.codigo}</h2>
        </div>
        <div className="hoja-cuerpo grid gap-3">
          <p className="m-0">
            El activo <strong>{activo?.nombre}</strong> dejará de estar disponible para arriendo. No se borra: su hoja de vida se conserva.
          </p>
          {error && <Aviso tipo="error">{error}</Aviso>}
          <div>
            <label className="etiqueta" htmlFor="baja-motivo">Motivo</label>
            <textarea
              id="baja-motivo"
              className="campo min-h-24"
              rows={3}
              maxLength={255}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              disabled={ocupado}
              required
            />
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="btn btn-secundario" onClick={() => onCerrar?.()} disabled={ocupado}>Cancelar</button>
            <button type="submit" className="btn btn-peligro" disabled={ocupado} aria-busy={ocupado}>
              {ocupado ? "Procesando…" : "Dar de baja"}
            </button>
          </div>
        </div>
      </form>
    </dialog>
  );
}

import { useEffect, useRef, useState } from "react";
import { Aviso } from "./Aviso";

/**
 * Diálogo de confirmación (usa <dialog> nativo: foco atrapado y Esc para cerrar).
 *
 * <ModalConfirmacion
 *   abierto={!!aBorrar}
 *   titulo="Eliminar contratista"
 *   mensaje={`¿Eliminar a ${aBorrar?.razon_social}? Esta acción no se puede deshacer.`}
 *   textoConfirmar="Eliminar"
 *   peligro
 *   onConfirmar={async () => { await api.delete(`/contratistas/${aBorrar.id}/`); }}
 *   onCerrar={() => setABorrar(null)}
 * />
 * Si onConfirmar lanza un error, el mensaje se muestra dentro del modal (p. ej. el 409 de DRF)
 * y el modal queda abierto. Si termina bien, se llama a onCerrar.
 */
export default function ModalConfirmacion({
  abierto,
  titulo = "¿Confirmar?",
  mensaje,
  textoConfirmar = "Confirmar",
  textoCancelar = "Cancelar",
  peligro = false,
  onConfirmar,
  onCerrar,
}) {
  const ref = useRef(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo) return;
    if (abierto && !dialogo.open) {
      setError("");
      dialogo.showModal();
    } else if (!abierto && dialogo.open) {
      dialogo.close();
    }
  }, [abierto]);

  async function confirmar() {
    setOcupado(true);
    setError("");
    try {
      await onConfirmar?.();
      onCerrar?.();
    } catch (e) {
      setError(e?.message || "No se pudo completar la acción.");
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
      className="hoja m-auto w-[min(460px,calc(100vw-2rem))] p-0 text-texto backdrop:bg-texto/40"
      aria-labelledby="modal-confirmacion-titulo"
    >
      <div className="hoja-cabeza">
        <h2 id="modal-confirmacion-titulo">{titulo}</h2>
      </div>
      <div className="hoja-cuerpo grid gap-3">
        {mensaje && <p className="m-0">{mensaje}</p>}
        {error && <Aviso tipo="error">{error}</Aviso>}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn btn-secundario" onClick={() => onCerrar?.()} disabled={ocupado}>
            {textoCancelar}
          </button>
          <button
            type="button"
            className={`btn ${peligro ? "btn-peligro" : "btn-primario"}`}
            onClick={confirmar}
            disabled={ocupado}
            aria-busy={ocupado}
          >
            {ocupado ? "Procesando…" : textoConfirmar}
          </button>
        </div>
      </div>
    </dialog>
  );
}

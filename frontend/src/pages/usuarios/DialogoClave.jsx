import { useEffect, useRef, useState } from "react";
import { api } from "../../api/client";
import { Aviso } from "../../components/Aviso";

/**
 * Restablecer la clave de un trabajador: POST /usuarios/{id}/restablecer-clave/ {password}.
 * El backend valida la clave (largo, comunes, numérica) y cierra las sesiones abiertas del trabajador.
 */
export default function DialogoClave({ usuario, abierto, onCerrar, onHecho }) {
  const ref = useRef(null);
  const [clave, setClave] = useState("");
  const [repetida, setRepetida] = useState("");
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierto && !d.open) {
      setClave("");
      setRepetida("");
      setError("");
      d.showModal();
    } else if (!abierto && d.open) d.close();
  }, [abierto]);

  async function confirmar(e) {
    e.preventDefault();
    if (clave.length < 8) return setError("La clave debe tener al menos 8 caracteres.");
    if (clave !== repetida) return setError("Las claves no coinciden.");
    setOcupado(true);
    setError("");
    try {
      await api.post(`/usuarios/${usuario.id}/restablecer-clave/`, { password: clave });
      onHecho?.();
      onCerrar?.();
    } catch (err) {
      setError(err.campos?.password || err.message);
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
      aria-labelledby="clave-titulo"
    >
      <form onSubmit={confirmar} noValidate>
        <div className="hoja-cabeza">
          <h2 id="clave-titulo">Restablecer clave de {usuario?.nombre}</h2>
        </div>
        <div className="hoja-cuerpo grid gap-3">
          <p className="m-0 text-sm text-texto-2">
            Entrega la clave nueva al trabajador en persona. Sus sesiones abiertas se cerrarán.
          </p>
          {error && <Aviso tipo="error">{error}</Aviso>}
          <div>
            <label className="etiqueta" htmlFor="clave-nueva">Clave nueva</label>
            <input id="clave-nueva" type="password" className="campo" autoComplete="new-password" value={clave} onChange={(e) => setClave(e.target.value)} disabled={ocupado} required />
          </div>
          <div>
            <label className="etiqueta" htmlFor="clave-repetida">Repite la clave</label>
            <input id="clave-repetida" type="password" className="campo" autoComplete="new-password" value={repetida} onChange={(e) => setRepetida(e.target.value)} disabled={ocupado} required />
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="btn btn-secundario" onClick={() => onCerrar?.()} disabled={ocupado}>Cancelar</button>
            <button type="submit" className="btn btn-primario" disabled={ocupado} aria-busy={ocupado}>
              {ocupado ? "Guardando…" : "Restablecer clave"}
            </button>
          </div>
        </div>
      </form>
    </dialog>
  );
}

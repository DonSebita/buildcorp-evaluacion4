import { useCallback, useRef, useState } from "react";
import { AvisosContext } from "./avisos";

const ICONOS = {
  success: "bi-check-circle",
  error: "bi-exclamation-octagon",
  warning: "bi-exclamation-triangle",
  info: "bi-info-circle",
};

/** Aviso en línea (dentro de una hoja o formulario). */
export function Aviso({ tipo = "info", children, className = "" }) {
  return (
    <div className={`aviso ${tipo} ${className}`} role={tipo === "error" ? "alert" : "status"}>
      <i className={`bi ${ICONOS[tipo] || ICONOS.info}`} aria-hidden="true"></i>
      <div>{children}</div>
    </div>
  );
}

/** Proveedor de avisos flotantes (toasts). Envuelve la app una sola vez. */
export function AvisosProvider({ children }) {
  const [lista, setLista] = useState([]);
  const siguienteId = useRef(1);

  const cerrar = useCallback((id) => setLista((l) => l.filter((a) => a.id !== id)), []);

  const aviso = useCallback(
    (texto, tipo = "success") => {
      const id = siguienteId.current++;
      setLista((l) => [...l.slice(-3), { id, texto, tipo }]);
      setTimeout(() => cerrar(id), tipo === "error" ? 9000 : 5000);
      return id;
    },
    [cerrar]
  );

  return (
    <AvisosContext.Provider value={aviso}>
      {children}
      <div className="toast-zona fixed right-4 bottom-4 z-50 grid w-[min(380px,calc(100vw-2rem))] gap-2" aria-live="polite">
        {lista.map((a) => (
          <div key={a.id} className={`aviso ${a.tipo}`} role={a.tipo === "error" ? "alert" : "status"}>
            <i className={`bi ${ICONOS[a.tipo] || ICONOS.info}`} aria-hidden="true"></i>
            <div className="flex-1">{a.texto}</div>
            <button type="button" className="-m-1 p-1 opacity-60 hover:opacity-100" onClick={() => cerrar(a.id)} aria-label="Cerrar aviso">
              <i className="bi bi-x-lg" aria-hidden="true"></i>
            </button>
          </div>
        ))}
      </div>
    </AvisosContext.Provider>
  );
}

export default Aviso;

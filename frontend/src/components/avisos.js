import { createContext, useContext } from "react";

export const AvisosContext = createContext(null);

/**
 * const aviso = useAviso();
 * aviso("Contratista guardado");               // success
 * aviso(error.message, "error");               // error, warning o info
 */
export function useAviso() {
  const ctx = useContext(AvisosContext);
  if (!ctx) throw new Error("useAviso debe usarse dentro de <AvisosProvider>.");
  return ctx;
}

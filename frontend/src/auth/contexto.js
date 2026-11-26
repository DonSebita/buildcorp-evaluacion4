import { createContext, useContext } from "react";

export const AuthContext = createContext(null);

/** const { usuario, rol, login, logout, cargando } = useAuth(); */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>.");
  return ctx;
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, alExpirarSesion, renovarAccess, tokens } from "../api/client";
import { AuthContext } from "./contexto";

/**
 * Sesión JWT:
 * - access en memoria (se pierde al recargar) y refresh en sessionStorage (se borra al cerrar la pestaña).
 * - Al cargar la página, si hay refresh guardado, pide un access nuevo y luego GET /auth/me/.
 * - logout: POST /auth/logout/ {refresh} para que el backend lo agregue a la blacklist.
 */
export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(() => Boolean(tokens.getRefresh()));

  const cargarUsuario = useCallback(async () => {
    const yo = await api.get("/auth/me/");
    setUsuario(yo);
    return yo;
  }, []);

  // Si la sesión no se puede renovar en mitad del uso, se vuelve al login.
  useEffect(() => {
    alExpirarSesion(() => setUsuario(null));
    return () => alExpirarSesion(null);
  }, []);

  // Restaurar la sesión al recargar la página.
  useEffect(() => {
    if (!tokens.getRefresh()) return;
    let vigente = true;
    void (async () => {
      try {
        if (await renovarAccess()) {
          const yo = await api.get("/auth/me/");
          if (vigente) setUsuario(yo);
        } else {
          tokens.limpiar();
        }
      } catch {
        tokens.limpiar();
      } finally {
        if (vigente) setCargando(false);
      }
    })();
    return () => {
      vigente = false;
    };
  }, []);

  const login = useCallback(
    async (username, password) => {
      const datos = await api.post("/auth/token/", { username, password }, { auth: false });
      tokens.setAccess(datos.access);
      tokens.setRefresh(datos.refresh);
      try {
        return await cargarUsuario();
      } catch (e) {
        tokens.limpiar();
        throw e;
      }
    },
    [cargarUsuario]
  );

  const logout = useCallback(async () => {
    const refresh = tokens.getRefresh();
    try {
      if (refresh) await api.post("/auth/logout/", { refresh });
    } catch {
      /* aunque falle (token ya vencido, sin red), la sesión local se cierra igual */
    } finally {
      tokens.limpiar();
      setUsuario(null);
    }
  }, []);

  const valor = useMemo(
    () => ({ usuario, rol: usuario?.rol ?? null, cargando, login, logout, recargarUsuario: cargarUsuario }),
    [usuario, cargando, login, logout, cargarUsuario]
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

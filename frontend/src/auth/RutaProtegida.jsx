import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./contexto";
import { tieneRol } from "./roles";
import Cargando from "../components/Cargando";

/**
 * Exige sesión iniciada; con `roles`, además exige uno de esos roles (el Administrador siempre pasa).
 * Se usa como elemento de ruta: <Route element={<RutaProtegida roles={[VENTAS]} />}>…</Route>
 * Recordatorio: esto solo ordena la interfaz. La autorización real la hace el backend (403).
 */
export default function RutaProtegida({ roles = null, children }) {
  const { usuario, rol, cargando } = useAuth();
  const ubicacion = useLocation();

  if (cargando) return <Cargando texto="Recuperando tu sesión…" pantallaCompleta />;
  if (!usuario) return <Navigate to="/login" replace state={{ desde: ubicacion }} />;

  if (!tieneRol(rol, roles)) {
    return (
      <div className="hoja mx-auto mt-8 max-w-xl">
        <div className="hoja-cuerpo text-center">
          <i className="bi bi-shield-lock text-3xl text-texto-2" aria-hidden="true"></i>
          <h1 className="mt-2 text-xl font-bold">Sin permiso para esta sección</h1>
          <p className="mt-1 text-texto-2">
            Tu rol ({rol || "sin rol asignado"}) no tiene acceso. Si crees que es un error, habla con el Administrador.
          </p>
        </div>
      </div>
    );
  }
  return children ?? <Outlet />;
}

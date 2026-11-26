import { Route, Routes } from "react-router-dom";
import NotFound from "../NotFound";
import Lista from "./Lista";
import FormUsuario from "./FormUsuario";

/**
 * Trabajadores (solo Administrador; App.jsx la envuelve en <RutaProtegida roles={[]}>
 * y el backend responde 403 a cualquier otro rol).
 *   /usuarios               lista con búsqueda y filtros por rol y estado
 *   /usuarios/nuevo         crear trabajador con rol y clave inicial
 *   /usuarios/:id/editar    editar datos y rol
 */
export default function Usuarios() {
  return (
    <Routes>
      <Route index element={<Lista />} />
      <Route path="nuevo" element={<FormUsuario />} />
      <Route path=":id/editar" element={<FormUsuario />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

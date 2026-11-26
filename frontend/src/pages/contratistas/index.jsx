import { Route, Routes } from "react-router-dom";
import NotFound from "../NotFound";
import Lista from "./Lista";
import Detalle from "./Detalle";
import FormContratista from "./FormContratista";

/**
 * Sección Contratistas (T7). La ruta de App.jsx es "contratistas/*", así que aquí van las subrutas:
 *   /contratistas               lista con búsqueda y paginación
 *   /contratistas/nuevo         crear
 *   /contratistas/:id           detalle con sus obras (crear, activar/inactivar y eliminar obra)
 *   /contratistas/:id/editar    editar
 * Escriben Ventas y Administrador; el resto solo lee (el backend igual responde 403).
 */
export default function Contratistas() {
  return (
    <Routes>
      <Route index element={<Lista />} />
      <Route path="nuevo" element={<FormContratista />} />
      <Route path=":id" element={<Detalle />} />
      <Route path=":id/editar" element={<FormContratista />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

import { Route, Routes } from "react-router-dom";
import NotFound from "../NotFound";
import Lista from "./Lista";
import Ficha from "./Ficha";
import FormActivo from "./FormActivo";

/**
 * Sección Activos (tarea T8). Subrutas:
 *   /activos              lista con filtro por estado y búsqueda
 *   /activos/nuevo        crear (Bodeguero / Administrador)
 *   /activos/:id          ficha con foto y hoja de vida
 *   /activos/:id/editar   editar (Bodeguero / Administrador)
 */
export default function Activos() {
  return (
    <Routes>
      <Route index element={<Lista />} />
      <Route path="nuevo" element={<FormActivo />} />
      <Route path=":id" element={<Ficha />} />
      <Route path=":id/editar" element={<FormActivo />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

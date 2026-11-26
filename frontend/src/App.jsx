import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import RutaProtegida from "./auth/RutaProtegida";
import { ADMIN, ENCARGADO, VENTAS } from "./auth/roles";
import Layout from "./layouts/Layout";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import Cargando from "./components/Cargando";

// Cada sección se carga bajo demanda (un chunk por carpeta de pages/).
const Contratistas = lazy(() => import("./pages/contratistas/index.jsx"));
const Activos = lazy(() => import("./pages/activos/index.jsx"));
const Dashboard = lazy(() => import("./pages/dashboard/index.jsx"));
const Diagnostico = lazy(() => import("./pages/diagnostico/index.jsx"));
const Usuarios = lazy(() => import("./pages/usuarios/index.jsx"));
const Parametros = lazy(() => import("./pages/parametros/index.jsx"));
const Alertas = lazy(() => import("./pages/alertas/index.jsx"));
const Cobros = lazy(() => import("./pages/cobros/index.jsx"));
const Categorias = lazy(() => import("./pages/categorias/index.jsx"));

export default function App() {
  return (
    <Suspense fallback={<Cargando />}>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<RutaProtegida />}>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="contratistas/*" element={<RutaProtegida roles={[VENTAS, ENCARGADO]}><Contratistas /></RutaProtegida>} />
            <Route path="activos/*" element={<Activos />} />
            <Route path="alertas" element={<Alertas />} />
            <Route path="cobros" element={<RutaProtegida roles={[VENTAS]}><Cobros /></RutaProtegida>} />
            <Route path="categorias" element={<Categorias />} />
            <Route path="usuarios/*" element={<RutaProtegida roles={[ADMIN]}><Usuarios /></RutaProtegida>} />
            <Route path="parametros" element={<RutaProtegida roles={[VENTAS]}><Parametros /></RutaProtegida>} />
            <Route path="diagnostico" element={<Diagnostico />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}

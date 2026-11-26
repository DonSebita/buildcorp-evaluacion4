import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/contexto";
import { CLAVES, menuPara } from "../auth/roles";

/**
 * Estructura de las pantallas internas: riel de tinta (236 px) a la izquierda con el menú
 * según el rol; en pantallas < 1024 px el riel pasa a panel lateral con barra superior.
 * El color del ítem activo es la "copia" del rol (data-rol), como en la app Django.
 */
export default function Layout() {
  const { usuario, rol, logout } = useAuth();
  const [abierto, setAbierto] = useState(false);
  const navegar = useNavigate();

  async function salir() {
    await logout();
    navegar("/login", { replace: true });
  }

  const secciones = menuPara(rol);

  return (
    <div data-rol={CLAVES[rol] || "admin"} className="min-h-screen lg:grid lg:grid-cols-[236px_minmax(0,1fr)]">
      {/* Barra superior en celular */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/10 bg-tinta px-3 py-2 text-white lg:hidden">
        <button type="button" className="btn btn-sm text-white" onClick={() => setAbierto(true)} aria-label="Abrir menú" aria-expanded={abierto} aria-controls="riel">
          <i className="bi bi-list text-xl" aria-hidden="true"></i>
        </button>
        <span className="text-lg font-extrabold tracking-tight">
          Build<b className="text-[#f4e4a1]">Corp</b>
        </span>
      </header>

      {abierto && <div className="fixed inset-0 z-40 bg-texto/40 lg:hidden" onClick={() => setAbierto(false)} aria-hidden="true"></div>}

      <nav
        id="riel"
        aria-label="Navegación principal"
        className={`fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col bg-tinta px-3.5 py-5 text-[#d4d1ee] transition-transform lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:w-auto lg:translate-x-0 ${
          abierto ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-2.5 pb-6">
          <NavLink to="/dashboard" className="text-[1.3rem] font-extrabold tracking-tight text-white no-underline hover:text-white">
            Build<b className="text-[#f4e4a1]">Corp</b>
          </NavLink>
          <button type="button" className="btn btn-sm text-white lg:hidden" onClick={() => setAbierto(false)} aria-label="Cerrar menú">
            <i className="bi bi-x-lg" aria-hidden="true"></i>
          </button>
        </div>

        <div className="riel-nav flex flex-1 flex-col gap-0.5 overflow-y-auto">
          {secciones.map((s) => (
            <div key={s.seccion || "inicio"} className="flex flex-col gap-0.5">
              {s.seccion && <div className="riel-seccion">{s.seccion}</div>}
              {s.items.map((i) => (
                <NavLink key={i.a} to={i.a} onClick={() => setAbierto(false)}>
                  <i className={`bi ${i.icono}`} aria-hidden="true"></i>
                  {i.texto}
                </NavLink>
              ))}
            </div>
          ))}
        </div>

        <div className="mt-3 border-t border-white/10 px-2.5 pt-3.5 text-sm">
          <strong className="block text-white">{usuario?.nombre || usuario?.username}</strong>
          <span className="text-[#a19dd2]">{rol || "Sin rol asignado"}</span>
          <button type="button" onClick={salir} className="mt-2 flex min-h-11 items-center gap-2 text-[#d4d1ee] hover:text-white">
            <i className="bi bi-box-arrow-left" aria-hidden="true"></i>
            Cerrar sesión
          </button>
        </div>
      </nav>

      <main className="min-w-0 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        <Outlet />
      </main>
    </div>
  );
}

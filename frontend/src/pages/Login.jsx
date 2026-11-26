import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/contexto";
import { Aviso } from "../components/Aviso";
import Cargando from "../components/Cargando";

/** Inicio de sesión con JWT (POST /auth/token/). */
export default function Login() {
  const { usuario, cargando, login } = useAuth();
  const navegar = useNavigate();
  const ubicacion = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const destino = ubicacion.state?.desde?.pathname || "/dashboard";

  if (cargando) return <Cargando texto="Recuperando tu sesión…" pantallaCompleta />;
  if (usuario) return <Navigate to={destino} replace />;

  async function enviar(e) {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError("Ingresa tu usuario y tu contraseña.");
      return;
    }
    setEnviando(true);
    setError("");
    try {
      await login(username.trim(), password);
      navegar(destino, { replace: true });
    } catch (err) {
      setError(err.status === 401 ? "Usuario o contraseña incorrectos." : err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-[400px]">
        <div className="mb-6 text-center">
          <div className="text-3xl font-extrabold tracking-tight text-tinta">
            Build<b className="text-folio">Corp</b>
          </div>
          <p className="mt-1 text-texto-2">Arriendo de maquinaria y equipos · uso interno</p>
        </div>

        <section className="hoja">
          <div className="hoja-cabeza">
            <h1 className="text-[1.02rem] font-bold">Iniciar sesión</h1>
          </div>
          <form className="hoja-cuerpo grid gap-4" onSubmit={enviar} noValidate>
            {error && <Aviso tipo="error">{error}</Aviso>}
            <div>
              <label className="etiqueta" htmlFor="usuario">
                Usuario
              </label>
              <input id="usuario" className="campo" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} disabled={enviando} required />
            </div>
            <div>
              <label className="etiqueta" htmlFor="clave">
                Contraseña
              </label>
              <input id="clave" type="password" className="campo" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={enviando} required />
            </div>
            <button type="submit" className="btn btn-primario w-full" disabled={enviando} aria-busy={enviando}>
              {enviando ? "Ingresando…" : "Ingresar"}
            </button>
          </form>
        </section>
        <p className="mt-4 text-center text-sm text-texto-2">¿Olvidaste tu clave? Pídele al Administrador que la restablezca.</p>
      </div>
    </main>
  );
}

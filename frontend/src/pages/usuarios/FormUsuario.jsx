import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../api/client";
import { Aviso } from "../../components/Aviso";
import { useAviso } from "../../components/avisos";
import Cargando from "../../components/Cargando";
import Formulario from "../../components/Formulario";
import { TODOS } from "../../auth/roles";
import { useAuth } from "../../auth/contexto";

const OPCIONES_ROL = TODOS.map((r) => ({ valor: r, texto: r }));

function camposPara(editando, esYoMismo) {
  const campos = [
    { nombre: "username", etiqueta: "Nombre de usuario", requerido: true, maxLength: 150, autoComplete: "off", ayuda: "Con este nombre inicia sesión. Letras, números y @ . + - _" },
    { nombre: "rol", etiqueta: "Rol", tipo: "select", requerido: true, opciones: OPCIONES_ROL, deshabilitado: esYoMismo, ayuda: esYoMismo ? "No puedes cambiar tu propio rol." : "Define qué pantallas y acciones tiene." },
    { nombre: "first_name", etiqueta: "Nombre", requerido: true, maxLength: 150 },
    { nombre: "last_name", etiqueta: "Apellido", maxLength: 150 },
    { nombre: "rut", etiqueta: "RUT", maxLength: 12, ayuda: "Ej: 12.345.678-5" },
    { nombre: "cargo", etiqueta: "Cargo", maxLength: 80, placeholder: "Jefe de bodega" },
    { nombre: "email", etiqueta: "Correo", tipo: "email", maxLength: 254 },
    { nombre: "telefono", etiqueta: "Teléfono", tipo: "tel", maxLength: 20, placeholder: "+56 9 1234 5678" },
  ];
  if (!editando) {
    campos.push({ nombre: "password", etiqueta: "Clave inicial", tipo: "password", requerido: true, autoComplete: "new-password", ayuda: "Mínimo 8 caracteres, no solo números ni una clave común. Entrégasela al trabajador." });
  }
  campos.push({ nombre: "is_active", etiqueta: "Puede iniciar sesión (cuenta activa)", tipo: "checkbox", deshabilitado: esYoMismo });
  return campos;
}

/** Crear (/usuarios/nuevo) o editar (/usuarios/:id/editar) un trabajador. */
export default function FormUsuario() {
  const { id } = useParams();
  const editando = Boolean(id);
  const navegar = useNavigate();
  const aviso = useAviso();
  const { usuario: yo, recargarUsuario } = useAuth();
  const [inicial, setInicial] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!editando) return undefined;
    const control = new AbortController();
    api
      .get(`/usuarios/${id}/`, { signal: control.signal })
      .then(setInicial)
      .catch((e) => e?.name !== "AbortError" && setError(e.message));
    return () => control.abort();
  }, [id, editando]);

  const esYoMismo = editando && Number(id) === yo?.id;

  let cuerpo;
  if (error) cuerpo = <Aviso tipo="error">{error}</Aviso>;
  else if (editando && !inicial) cuerpo = <Cargando />;
  else {
    cuerpo = (
      <Formulario
        campos={camposPara(editando, esYoMismo)}
        valoresIniciales={inicial ?? { is_active: true }}
        textoEnviar={editando ? "Guardar cambios" : "Crear trabajador"}
        onCancelar={() => navegar("/usuarios")}
        onEnviar={async (valores) => {
          const datos = { ...valores };
          if (esYoMismo) {
            delete datos.rol;
            delete datos.is_active;
          }
          const guardado = editando ? await api.patch(`/usuarios/${id}/`, datos) : await api.post("/usuarios/", datos);
          if (esYoMismo) await recargarUsuario();
          aviso(editando ? "Cambios guardados." : `${guardado.nombre} creado como ${guardado.rol}.`);
          navegar("/usuarios", { replace: true });
        }}
      />
    );
  }

  return (
    <section className="hoja mx-auto max-w-3xl">
      <div className="hoja-cabeza">
        <Link to="/usuarios" className="text-sm text-texto-2 hover:underline">
          <i className="bi bi-arrow-left" aria-hidden="true"></i> Volver
        </Link>
        <h1 className="text-[1.02rem] font-bold">{editando ? `Editar ${inicial?.nombre ?? "trabajador"}` : "Nuevo trabajador"}</h1>
      </div>
      <div className="hoja-cuerpo">
        {inicial?.is_superuser && (
          <Aviso tipo="info" className="mb-4">Es superusuario: siempre cuenta como Administrador, aunque tenga otro rol asignado.</Aviso>
        )}
        {cuerpo}
      </div>
    </section>
  );
}

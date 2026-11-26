import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../api/client";
import { Aviso } from "../../components/Aviso";
import { useAviso } from "../../components/avisos";
import Cargando from "../../components/Cargando";
import Formulario from "../../components/Formulario";
import { usePuedeEscribir } from "./permisos";

const CAMPOS = [
  { nombre: "rut", etiqueta: "RUT", requerido: true, ayuda: "Ej: 76.123.456-0. Se valida el dígito verificador.", autoComplete: "off" },
  { nombre: "razon_social", etiqueta: "Razón social", requerido: true, maxLength: 150 },
  { nombre: "contacto", etiqueta: "Persona de contacto", maxLength: 100 },
  { nombre: "email", etiqueta: "Correo", tipo: "email", maxLength: 254 },
  { nombre: "telefono", etiqueta: "Teléfono", tipo: "tel", maxLength: 20, placeholder: "+56 9 1234 5678" },
];

/** Crear (/contratistas/nuevo) o editar (/contratistas/:id/editar). Los errores por campo vienen de DRF. */
export default function FormContratista() {
  const { id } = useParams();
  const editando = Boolean(id);
  const navegar = useNavigate();
  const aviso = useAviso();
  const puedeEscribir = usePuedeEscribir();
  const [inicial, setInicial] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!editando) return undefined;
    const control = new AbortController();
    api
      .get(`/contratistas/${id}/`, { signal: control.signal })
      .then(setInicial)
      .catch((e) => e?.name !== "AbortError" && setError(e.message));
    return () => control.abort();
  }, [id, editando]);

  const volver = editando ? `/contratistas/${id}` : "/contratistas";

  let cuerpo;
  if (!puedeEscribir) {
    cuerpo = <Aviso tipo="warning">Tu rol solo puede consultar contratistas. Pide a Ventas o al Administrador que hagan el cambio.</Aviso>;
  } else if (error) {
    cuerpo = <Aviso tipo="error">{error}</Aviso>;
  } else if (editando && !inicial) {
    cuerpo = <Cargando />;
  } else {
    cuerpo = (
      <Formulario
        campos={CAMPOS}
        valoresIniciales={inicial ?? undefined}
        textoEnviar={editando ? "Guardar cambios" : "Crear contratista"}
        onCancelar={() => navegar(volver)}
        onEnviar={async (valores) => {
          const guardado = editando
            ? await api.patch(`/contratistas/${id}/`, valores)
            : await api.post("/contratistas/", valores);
          aviso(editando ? "Cambios guardados." : `${guardado.razon_social} creado.`);
          navegar(`/contratistas/${guardado.id}`, { replace: true });
        }}
      />
    );
  }

  return (
    <section className="hoja mx-auto max-w-3xl">
      <div className="hoja-cabeza">
        <Link to={volver} className="text-sm text-texto-2 hover:underline">
          <i className="bi bi-arrow-left" aria-hidden="true"></i> Volver
        </Link>
        <h1 className="text-[1.02rem] font-bold">
          {editando ? `Editar ${inicial?.razon_social ?? "contratista"}` : "Nuevo contratista"}
        </h1>
      </div>
      <div className="hoja-cuerpo">{cuerpo}</div>
    </section>
  );
}

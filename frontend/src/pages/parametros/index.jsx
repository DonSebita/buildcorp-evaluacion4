import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { useAuth } from "../../auth/contexto";
import { ADMIN } from "../../auth/roles";
import { Aviso } from "../../components/Aviso";
import { useAviso } from "../../components/avisos";
import Cargando from "../../components/Cargando";
import Formulario from "../../components/Formulario";

const CAMPOS = [
  { nombre: "dias_gracia", etiqueta: "Días de gracia antes del bloqueo", tipo: "number", requerido: true, min: 0, max: 60, step: 1, ayuda: "Días de atraso que se toleran antes de bloquear al contratista moroso." },
  { nombre: "recargo_atraso", etiqueta: "Recargo por atraso", tipo: "number", requerido: true, min: 0, max: 5, step: 0.05, ayuda: "Sobre la tarifa diaria: 0,5 = +50 %." },
  { nombre: "tasa_iva", etiqueta: "Tasa de IVA", tipo: "number", requerido: true, min: 0, max: 0.99, step: 0.01, ayuda: "0,19 = 19 %." },
];

/** Parámetros del sistema: GET /parametros/ (Admin y Ventas), PATCH solo Administrador. */
export default function Parametros() {
  const { rol } = useAuth();
  const aviso = useAviso();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const editable = rol === ADMIN;

  useEffect(() => {
    const control = new AbortController();
    api
      .get("/parametros/", { signal: control.signal })
      .then(setDatos)
      .catch((e) => e?.name !== "AbortError" && setError(e.message));
    return () => control.abort();
  }, []);

  let cuerpo;
  if (error) cuerpo = <Aviso tipo="error">{error}</Aviso>;
  else if (!datos) cuerpo = <Cargando />;
  else {
    cuerpo = (
      <>
        {!editable && <Aviso tipo="info" className="mb-4">Solo el Administrador puede cambiar los parámetros.</Aviso>}
        <Formulario
          campos={CAMPOS}
          valoresIniciales={datos}
          deshabilitado={!editable}
          textoEnviar="Guardar parámetros"
          onEnviar={async (valores) => {
            setDatos(await api.patch("/parametros/", valores));
            aviso("Parámetros guardados. Se aplican a los préstamos nuevos y a la próxima revisión de morosidad.");
          }}
        />
      </>
    );
  }

  return (
    <section className="hoja mx-auto max-w-3xl">
      <div className="hoja-cabeza">
        <h1 className="text-[1.02rem] font-bold">Parámetros del sistema</h1>
        <p className="m-0 text-sm text-texto-2">Reglas de cobro y morosidad. Los préstamos ya creados conservan sus tarifas.</p>
      </div>
      <div className="hoja-cuerpo">{cuerpo}</div>
    </section>
  );
}

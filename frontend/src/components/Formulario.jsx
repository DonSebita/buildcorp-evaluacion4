import { useState } from "react";
import { Aviso } from "./Aviso";

/**
 * Formulario declarativo con errores por campo de DRF.
 *
 * <Formulario
 *   campos={[
 *     { nombre: "rut", etiqueta: "RUT", requerido: true, ayuda: "Ej: 76.123.456-0" },
 *     { nombre: "razon_social", etiqueta: "Razón social", requerido: true },
 *     { nombre: "email", etiqueta: "Correo", tipo: "email" },
 *     { nombre: "estado", etiqueta: "Estado", tipo: "select", opciones: [{ valor: "ACTIVO", texto: "Activo" }] },
 *     { nombre: "direccion", etiqueta: "Dirección", tipo: "textarea", ancho: "completo" },
 *   ]}
 *   valoresIniciales={contratista}
 *   textoEnviar="Guardar"
 *   onEnviar={async (valores) => api.post("/contratistas/", valores)}
 *   onCancelar={() => navigate(-1)}
 * />
 *
 * Tipos: text (por defecto), email, number, date, password, tel, select, textarea, checkbox.
 * Si onEnviar lanza un ApiError, error.campos se pinta bajo cada campo y el resto
 * (detail / non_field_errors / campos que no están en el formulario) arriba.
 */
const SIN_VALORES = {};

export default function Formulario({
  campos,
  valoresIniciales = SIN_VALORES,
  onEnviar,
  onCancelar,
  textoEnviar = "Guardar",
  textoCancelar = "Cancelar",
  deshabilitado = false,
  children,
}) {
  const [valores, setValores] = useState(() => inicial(campos, valoresIniciales));
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState("");
  const [enviando, setEnviando] = useState(false);

  // Si llegan datos nuevos (p. ej. al terminar de cargar el registro a editar), se recargan.
  // Patrón "ajustar estado durante el render" de React: sin efecto ni render extra en pantalla.
  // Se compara el contenido (no la referencia) para que un objeto literal no reinicie el formulario.
  const firma = JSON.stringify(valoresIniciales ?? {});
  const [origen, setOrigen] = useState(firma);
  if (origen !== firma) {
    setOrigen(firma);
    setValores(inicial(campos, valoresIniciales));
  }

  function cambiar(nombre, valor) {
    setValores((v) => ({ ...v, [nombre]: valor }));
    if (errores[nombre]) setErrores((e) => ({ ...e, [nombre]: undefined }));
  }

  async function enviar(evento) {
    evento.preventDefault();
    setEnviando(true);
    setErrores({});
    setErrorGeneral("");
    try {
      await onEnviar?.(limpiar(campos, valores));
    } catch (e) {
      const porCampo = e?.campos || {};
      const nombres = new Set(campos.map((c) => c.nombre));
      const propios = {};
      const otros = [];
      for (const [campo, texto] of Object.entries(porCampo)) {
        if (nombres.has(campo)) propios[campo] = texto;
        else otros.push(campo === "non_field_errors" ? texto : `${campo}: ${texto}`);
      }
      setErrores(propios);
      setErrorGeneral(otros.length ? otros.join(" · ") : Object.keys(propios).length ? "" : e?.message || "No se pudo guardar.");
      if (Object.keys(propios).length) {
        requestAnimationFrame(() => document.getElementById(`campo-${Object.keys(propios)[0]}`)?.focus());
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} noValidate className="grid gap-4">
      {errorGeneral && <Aviso tipo="error">{errorGeneral}</Aviso>}
      <div className="grid gap-4 md:grid-cols-2">
        {campos.map((c) => (
          <Campo key={c.nombre} campo={c} valor={valores[c.nombre]} error={errores[c.nombre]} onCambio={cambiar} deshabilitado={deshabilitado || enviando} />
        ))}
      </div>
      {children}
      <div className="flex flex-wrap justify-end gap-2">
        {onCancelar && (
          <button type="button" className="btn btn-secundario" onClick={onCancelar} disabled={enviando}>
            {textoCancelar}
          </button>
        )}
        <button type="submit" className="btn btn-primario" disabled={deshabilitado || enviando} aria-busy={enviando}>
          {enviando ? "Guardando…" : textoEnviar}
        </button>
      </div>
    </form>
  );
}

function Campo({ campo, valor, error, onCambio, deshabilitado }) {
  const { nombre, etiqueta, tipo = "text", requerido = false, ayuda, opciones = [], ancho, placeholder, ...resto } = campo;
  const id = `campo-${nombre}`;
  const descripcion = [error ? `${id}-error` : null, ayuda ? `${id}-ayuda` : null].filter(Boolean).join(" ") || undefined;
  const comunes = {
    id,
    name: nombre,
    disabled: deshabilitado || campo.deshabilitado,
    required: requerido,
    "aria-invalid": error ? "true" : undefined,
    "aria-describedby": descripcion,
  };
  const completo = ancho === "completo" || tipo === "textarea" || tipo === "checkbox";

  let control;
  if (tipo === "checkbox") {
    return (
      <div className="md:col-span-2">
        <label className="flex min-h-11 items-center gap-2 font-semibold">
          <input type="checkbox" className="size-5 accent-tinta" checked={Boolean(valor)} onChange={(e) => onCambio(nombre, e.target.checked)} {...comunes} />
          {etiqueta}
        </label>
        {ayuda && <div id={`${id}-ayuda`} className="ayuda-campo">{ayuda}</div>}
        {error && <div id={`${id}-error`} className="error-campo">{error}</div>}
      </div>
    );
  } else if (tipo === "select") {
    control = (
      <select className="campo" value={valor ?? ""} onChange={(e) => onCambio(nombre, e.target.value)} {...comunes}>
        <option value="">{placeholder || "Selecciona…"}</option>
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.texto}
          </option>
        ))}
      </select>
    );
  } else if (tipo === "textarea") {
    control = <textarea className="campo min-h-24" rows={3} value={valor ?? ""} placeholder={placeholder} onChange={(e) => onCambio(nombre, e.target.value)} {...comunes} {...resto} />;
  } else {
    control = <input className="campo" type={tipo} value={valor ?? ""} placeholder={placeholder} onChange={(e) => onCambio(nombre, e.target.value)} {...comunes} {...resto} />;
  }

  return (
    <div className={completo ? "md:col-span-2" : ""}>
      <label className="etiqueta" htmlFor={id}>
        {etiqueta}
        {!requerido && <span className="font-normal text-texto-2"> (opcional)</span>}
      </label>
      {control}
      {ayuda && <div id={`${id}-ayuda`} className="ayuda-campo">{ayuda}</div>}
      {error && <div id={`${id}-error`} className="error-campo">{error}</div>}
    </div>
  );
}

function inicial(campos, valores) {
  const v = {};
  for (const c of campos) {
    const actual = valores?.[c.nombre];
    v[c.nombre] = actual ?? (c.tipo === "checkbox" ? false : "");
  }
  return v;
}

/** Envía null en vez de "" para números, fechas y selects opcionales (DRF los rechaza vacíos). */
function limpiar(campos, valores) {
  const salida = { ...valores };
  for (const c of campos) {
    if (salida[c.nombre] === "" && !c.requerido && ["number", "date", "select"].includes(c.tipo)) salida[c.nombre] = null;
  }
  return salida;
}

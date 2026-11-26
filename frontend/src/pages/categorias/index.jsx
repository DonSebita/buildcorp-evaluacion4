import { useEffect, useState } from "react";
import { api, resultados } from "../../api/client";
import { useAuth } from "../../auth/contexto";
import { ADMIN } from "../../auth/roles";
import { useAviso } from "../../components/avisos";
import Formulario from "../../components/Formulario";
import ModalConfirmacion from "../../components/ModalConfirmacion";
import Tabla from "../../components/Tabla";
import { clp } from "../../utils/formato";

const CAMPOS = [
  { nombre: "nombre", etiqueta: "Nombre", requerido: true, maxLength: 80 },
  { nombre: "prefijo_codigo", etiqueta: "Prefijo de código", requerido: true, maxLength: 4, ayuda: "3–4 letras, ej. RTM. Se usa en los códigos de los activos." },
  { nombre: "tarifa_diaria", etiqueta: "Tarifa diaria (CLP)", tipo: "number", requerido: true, min: 1, step: 1 },
  { nombre: "tarifa_mensual", etiqueta: "Tarifa mensual (CLP)", tipo: "number", requerido: true, min: 1, step: 1 },
  { nombre: "mant_cada_usos", etiqueta: "Mantención cada N usos", tipo: "number", min: 1, step: 1 },
  { nombre: "mant_cada_horas", etiqueta: "Mantención cada N horas", tipo: "number", min: 1, step: 1 },
  { nombre: "mant_cada_dias", etiqueta: "Mantención cada N días", tipo: "number", min: 1, step: 1 },
  { nombre: "descripcion", etiqueta: "Descripción", tipo: "textarea" },
  { nombre: "requiere_horometro", etiqueta: "Requiere horómetro (se registran horas al entregar y devolver)", tipo: "checkbox" },
];

/** Categorías y tarifas (GET para todos; crear, editar y eliminar solo Administrador). */
export default function Categorias() {
  const { rol } = useAuth();
  const aviso = useAviso();
  const esAdmin = rol === ADMIN;
  const [carga, setCarga] = useState({ clave: null, filas: [], error: "" });
  const [recarga, setRecarga] = useState(0);
  const [editando, setEditando] = useState(null); // null | {} (nueva) | categoría
  const [aBorrar, setABorrar] = useState(null);

  const cargando = carga.clave !== recarga;
  useEffect(() => {
    const control = new AbortController();
    api
      .get("/categorias/", { params: { page_size: 200 }, signal: control.signal })
      .then((r) => setCarga({ clave: recarga, filas: resultados(r).filas, error: "" }))
      .catch((e) => e?.name !== "AbortError" && setCarga({ clave: recarga, filas: [], error: e.message }));
    return () => control.abort();
  }, [recarga]);

  const mant = (c) => [c.mant_cada_usos && `${c.mant_cada_usos} usos`, c.mant_cada_horas && `${c.mant_cada_horas} h`, c.mant_cada_dias && `${c.mant_cada_dias} días`].filter(Boolean).join(" · ") || "—";

  const columnas = [
    { clave: "prefijo_codigo", titulo: "Prefijo", render: (c) => <span className="folio">{c.prefijo_codigo}</span> },
    { clave: "nombre", titulo: "Categoría", render: (c) => <strong>{c.nombre}</strong> },
    { clave: "tarifa_diaria", titulo: "Diaria", num: true, render: (c) => clp(c.tarifa_diaria) },
    { clave: "tarifa_mensual", titulo: "Mensual", num: true, render: (c) => clp(c.tarifa_mensual) },
    { clave: "mant", titulo: "Mantención", render: mant },
    { clave: "requiere_horometro", titulo: "Horómetro", render: (c) => (c.requiere_horometro ? "Sí" : "No") },
  ];
  if (esAdmin) {
    columnas.push({
      clave: "acciones",
      titulo: "Acciones",
      render: (c) => (
        <div className="flex justify-end gap-1">
          <button type="button" className="btn btn-sm btn-secundario" onClick={() => setEditando(c)} aria-label={`Editar ${c.nombre}`}>
            <i className="bi bi-pencil" aria-hidden="true"></i><span className="max-sm:sr-only">Editar</span>
          </button>
          <button type="button" className="btn btn-sm btn-secundario" onClick={() => setABorrar(c)} aria-label={`Eliminar ${c.nombre}`}>
            <i className="bi bi-trash" aria-hidden="true"></i><span className="max-sm:sr-only">Eliminar</span>
          </button>
        </div>
      ),
    });
  }

  return (
    <div className="grid gap-5">
      <section className="hoja">
        <div className="hoja-cabeza flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[1.02rem] font-bold">Categorías y tarifas</h1>
            <p className="m-0 text-sm text-texto-2">Tarifas en CLP y frecuencia de mantención por tipo de equipo.</p>
          </div>
          {esAdmin && !editando && (
            <button type="button" className="btn btn-primario" onClick={() => setEditando({})}>
              <i className="bi bi-plus-lg" aria-hidden="true"></i> Nueva categoría
            </button>
          )}
        </div>
        <div className="hoja-cuerpo">
          <Tabla titulo="Categorías" columnas={columnas} filas={carga.filas} cargando={cargando} error={carga.error} vacio="Aún no hay categorías." />
        </div>
      </section>

      {esAdmin && editando && (
        <section className="hoja">
          <div className="hoja-cabeza">
            <h2>{editando.id ? `Editar ${editando.nombre}` : "Nueva categoría"}</h2>
          </div>
          <div className="hoja-cuerpo">
            <Formulario
              campos={CAMPOS}
              valoresIniciales={editando}
              textoEnviar={editando.id ? "Guardar cambios" : "Crear categoría"}
              onCancelar={() => setEditando(null)}
              onEnviar={async (valores) => {
                const datos = { ...valores, prefijo_codigo: String(valores.prefijo_codigo || "").toUpperCase() };
                const g = editando.id ? await api.patch(`/categorias/${editando.id}/`, datos) : await api.post("/categorias/", datos);
                aviso(editando.id ? "Categoría actualizada. Los préstamos ya creados mantienen su tarifa." : `${g.nombre} creada.`);
                setEditando(null);
                setRecarga((n) => n + 1);
              }}
            />
          </div>
        </section>
      )}

      <ModalConfirmacion
        abierto={!!aBorrar}
        titulo="Eliminar categoría"
        mensaje={aBorrar ? `¿Eliminar ${aBorrar.nombre}? Solo es posible si no tiene activos ni paquetes asociados.` : ""}
        textoConfirmar="Eliminar"
        peligro
        onConfirmar={async () => {
          await api.delete(`/categorias/${aBorrar.id}/`);
          aviso(`${aBorrar.nombre} eliminada.`);
          setRecarga((n) => n + 1);
        }}
        onCerrar={() => setABorrar(null)}
      />
    </div>
  );
}

import { useState } from "react";
import { api } from "../../api/client";
import { useAviso } from "../../components/avisos";
import Formulario from "../../components/Formulario";
import ModalConfirmacion from "../../components/ModalConfirmacion";
import Tabla from "../../components/Tabla";
import Timbre from "../../components/Timbre";
import { fecha } from "../../utils/formato";

const CAMPOS_OBRA = [
  { nombre: "nombre", etiqueta: "Nombre de la obra", requerido: true, maxLength: 120 },
  { nombre: "direccion", etiqueta: "Dirección", maxLength: 200 },
  { nombre: "responsable_nombre", etiqueta: "Responsable de obra", requerido: true, maxLength: 100 },
  { nombre: "responsable_rut", etiqueta: "RUT del responsable", requerido: true, maxLength: 12, ayuda: "Ej: 12.345.678-5" },
  { nombre: "fecha_inicio", etiqueta: "Inicio", tipo: "date" },
  { nombre: "fecha_fin", etiqueta: "Término", tipo: "date" },
];

/** Obras del contratista: tabla, alta en línea, activar/inactivar y eliminar (409 si tiene préstamos). */
export default function Obras({ contratista, puedeEscribir, onCambio }) {
  const aviso = useAviso();
  const [creando, setCreando] = useState(false);
  const [aBorrar, setABorrar] = useState(null);
  const [cambiando, setCambiando] = useState(null);
  const bloqueado = contratista.estado === "BLOQUEADO";

  async function alternarActiva(obra) {
    setCambiando(obra.id);
    try {
      await api.patch(`/obras/${obra.id}/`, { activa: !obra.activa });
      aviso(`${obra.nombre} ${obra.activa ? "marcada como inactiva" : "reactivada"}.`);
      await onCambio();
    } catch (e) {
      aviso(e.message, "error");
    } finally {
      setCambiando(null);
    }
  }

  const columnas = [
    { clave: "nombre", titulo: "Obra", render: (o) => <span className="font-semibold">{o.nombre}</span> },
    { clave: "direccion", titulo: "Dirección", render: (o) => o.direccion || "—" },
    {
      clave: "responsable_nombre",
      titulo: "Responsable",
      render: (o) => (
        <>
          {o.responsable_nombre} <span className="folio text-xs">{o.responsable_rut}</span>
        </>
      ),
    },
    { clave: "periodo", titulo: "Periodo", render: (o) => `${fecha(o.fecha_inicio)} → ${fecha(o.fecha_fin)}` },
    { clave: "activa", titulo: "Estado", render: (o) => <Timbre estado={o.activa ? "ACTIVO" : "CERRADO"} texto={o.activa ? "Activa" : "Inactiva"} /> },
  ];
  if (puedeEscribir) {
    columnas.push({
      // Sin "accion: true": en celular la celda flotante de Tabla tapa la primera fila de la ficha,
      // así que las acciones van como una fila más ("Acciones") al final de cada ficha.
      clave: "acciones",
      titulo: "Acciones",
      render: (o) => (
        <div className="flex justify-end gap-1">
          <button type="button" className="btn btn-sm btn-secundario" disabled={cambiando === o.id} onClick={() => alternarActiva(o)}>
            {o.activa ? "Inactivar" : "Reactivar"}
          </button>
          <button type="button" className="btn btn-sm btn-secundario" onClick={() => setABorrar(o)} aria-label={`Eliminar obra ${o.nombre}`}>
            <i className="bi bi-trash" aria-hidden="true"></i>
            <span className="max-sm:sr-only">Eliminar</span>
          </button>
        </div>
      ),
    });
  }

  return (
    <section className="hoja" aria-labelledby="titulo-obras">
      <div className="hoja-cabeza flex flex-wrap items-center justify-between gap-3">
        <h2 id="titulo-obras" className="text-[1.02rem] font-bold">
          Obras <span className="font-normal text-texto-2">({contratista.obras.length})</span>
        </h2>
        {puedeEscribir && !creando && (
          <button
            type="button"
            className="btn btn-primario"
            onClick={() => setCreando(true)}
            disabled={bloqueado}
            title={bloqueado ? "El contratista está bloqueado: no se le pueden asignar obras nuevas." : undefined}
          >
            <i className="bi bi-plus-lg" aria-hidden="true"></i> Nueva obra
          </button>
        )}
      </div>

      <div className="hoja-cuerpo grid gap-4">
        {creando && (
          <div className="rounded border border-linea p-4">
            <h3 className="mb-3 font-bold">Nueva obra para {contratista.razon_social}</h3>
            <Formulario
              campos={CAMPOS_OBRA}
              textoEnviar="Crear obra"
              onCancelar={() => setCreando(false)}
              onEnviar={async (valores) => {
                const obra = await api.post("/obras/", { ...valores, contratista: contratista.id, activa: true });
                aviso(`Obra ${obra.nombre} creada.`);
                setCreando(false);
                await onCambio();
              }}
            />
          </div>
        )}

        <Tabla titulo={`Obras de ${contratista.razon_social}`} columnas={columnas} filas={contratista.obras} vacio="Este contratista aún no tiene obras." />
      </div>

      <ModalConfirmacion
        abierto={!!aBorrar}
        titulo="Eliminar obra"
        mensaje={aBorrar ? `¿Eliminar la obra ${aBorrar.nombre}? Esta acción no se puede deshacer.` : ""}
        textoConfirmar="Eliminar"
        peligro
        onConfirmar={async () => {
          await api.delete(`/obras/${aBorrar.id}/`); // 409 si tiene préstamos: el modal lo muestra
          aviso(`Obra ${aBorrar.nombre} eliminada.`);
          await onCambio();
        }}
        onCerrar={() => setABorrar(null)}
      />
    </section>
  );
}

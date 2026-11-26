import { CLASES_ESTADO } from "../utils/estados";

/**
 * Timbre de estado: badge con borde, SIEMPRE con texto (el estado nunca se comunica solo con color).
 * <Timbre estado="DISPONIBLE" texto="Disponible" />  ·  <Timbre estado="BLOQUEADO" grande nuevo />
 * `nuevo` activa la animación de timbrado (úsala solo cuando el estado acaba de cambiar).
 */


const legible = (estado) => String(estado ?? "").replaceAll("_", " ").toLowerCase();

export default function Timbre({ estado, texto, grande = false, nuevo = false, className = "" }) {
  const clase = CLASES_ESTADO[String(estado ?? "").toUpperCase()] || "info";
  return (
    <span className={`timbre timbre-${clase} ${grande ? "timbre-lg" : ""} ${nuevo ? "timbre-nuevo" : ""} ${className}`}>
      {texto || legible(estado) || "sin estado"}
    </span>
  );
}

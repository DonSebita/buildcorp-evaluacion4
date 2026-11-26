import { useState } from "react";
import { urlFoto } from "./comun";

/**
 * Foto del activo. Con S3 la URL es prefirmada y expira (900 s): si la imagen falla,
 * se llama a onRefrescar() para pedir el activo de nuevo (trae una URL firmada nueva).
 * Se reintenta una sola vez por URL para no entrar en un bucle si la foto de verdad no existe.
 */
export default function FotoActivo({ activo, onRefrescar }) {
  const url = urlFoto(activo);
  const [fallida, setFallida] = useState(null); // URL que ya falló dos veces
  const [reintentada, setReintentada] = useState(null); // URL que motivó el último refresco

  if (!url || fallida === url) {
    return (
      <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-linea bg-papel text-texto-2">
        <i className="bi bi-image text-2xl" aria-hidden="true"></i>
        <span className="text-sm">{url ? "No se pudo cargar la foto" : "Sin foto"}</span>
      </div>
    );
  }

  return (
    <img
      key={url}
      src={url}
      alt={`Foto de ${activo.codigo} · ${activo.nombre}`}
      className="aspect-[4/3] w-full rounded-lg border border-linea bg-papel object-cover"
      onError={async () => {
        if (reintentada === url) {
          setFallida(url);
          return;
        }
        setReintentada(url);
        const nueva = await onRefrescar?.().catch(() => null);
        // Si el backend devolvió la misma URL, no hay nada más que intentar.
        if (!nueva || urlFoto(nueva) === url) setFallida(url);
      }}
    />
  );
}

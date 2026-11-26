/** Indicador de carga accesible. */
export default function Cargando({ texto = "Cargando…", pantallaCompleta = false }) {
  return (
    <div
      role="status"
      className={`flex items-center justify-center gap-2 text-texto-2 ${pantallaCompleta ? "min-h-screen" : "py-10"}`}
    >
      <span className="size-4 animate-spin rounded-full border-2 border-linea border-t-tinta" aria-hidden="true"></span>
      <span>{texto}</span>
    </div>
  );
}

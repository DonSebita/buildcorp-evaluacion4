import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <main className="grid min-h-[60vh] place-items-center px-4">
      <div className="text-center">
        <div className="folio text-5xl">404</div>
        <h1 className="mt-2 text-2xl font-extrabold">Esta página no existe</h1>
        <p className="mt-1 text-texto-2">Revisa la dirección o vuelve al inicio.</p>
        <Link to="/dashboard" className="btn btn-primario mt-5">
          <i className="bi bi-house" aria-hidden="true"></i>
          Ir al inicio
        </Link>
      </div>
    </main>
  );
}

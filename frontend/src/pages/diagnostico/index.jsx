import { useEffect, useRef, useState } from "react";
import RutaProtegida from "../../auth/RutaProtegida";
import { ADMIN } from "../../auth/roles";
import { API_URL, renovarAccess, tokens } from "../../api/client";
import { Aviso } from "../../components/Aviso";

/**
 * Diagnóstico del rate limit de API Gateway (solo Administrador).
 *
 * Dispara N solicitudes GET con el token del usuario contra un endpoint del API y muestra,
 * por cada una, el código HTTP y los milisegundos que tardó, más un resumen de 200 / 429.
 * Sirve como evidencia del throttling configurado en el stage (rate 2 / burst 5).
 *
 * Usa fetch directo (no api.solicitar) a propósito: aquí interesa ver cada código tal cual,
 * sin el reintento automático del 401 ni la conversión de errores del cliente.
 */

const ENDPOINTS = ["/contratistas/", "/activos/", "/dashboard/resumen/", "/auth/me/"];
const MAX_SOLICITUDES = 100;

export default function Diagnostico() {
  return (
    <RutaProtegida roles={[ADMIN]}>
      <PruebaRateLimit />
    </RutaProtegida>
  );
}

function esApiGateway(url) {
  return /\.execute-api\.[a-z0-9-]+\.amazonaws\.com/i.test(url);
}

function claseCodigo(codigo) {
  if (codigo >= 200 && codigo < 300) return "timbre-ok";
  if (codigo === 429) return "timbre-crit";
  if (codigo === 0) return "timbre-baja";
  return "timbre-warn";
}

async function unaSolicitud(numero, url, signal) {
  const inicio = performance.now();
  const cabeceras = { Accept: "application/json" };
  const access = tokens.getAccess();
  if (access) cabeceras.Authorization = `Bearer ${access}`;
  try {
    const resp = await fetch(url, { method: "GET", headers: cabeceras, signal, cache: "no-store" });
    // Se consume el cuerpo para medir la respuesta completa y liberar la conexión.
    await resp.arrayBuffer().catch(() => null);
    return { numero, codigo: resp.status, ms: Math.round(performance.now() - inicio), nota: resp.statusText || "" };
  } catch (e) {
    if (e?.name === "AbortError") throw e;
    // Un 429 de API Gateway sin cabeceras CORS llega al navegador como error de red.
    return { numero, codigo: 0, ms: Math.round(performance.now() - inicio), nota: "Sin respuesta legible (red o CORS)" };
  }
}

function PruebaRateLimit() {
  const [endpoint, setEndpoint] = useState(ENDPOINTS[0]);
  const [cantidad, setCantidad] = useState(20);
  const [modo, setModo] = useState("simultaneas");
  const [filas, setFilas] = useState([]);
  const [corriendo, setCorriendo] = useState(false);
  const [error, setError] = useState("");
  const [duracion, setDuracion] = useState(null);
  const [urlUsada, setUrlUsada] = useState("");
  const controlador = useRef(null);

  useEffect(() => () => controlador.current?.abort(), []);

  const viaGateway = esApiGateway(API_URL);
  const total = filas.length;
  const ok = filas.filter((f) => f.codigo >= 200 && f.codigo < 300).length;
  const limitadas = filas.filter((f) => f.codigo === 429).length;
  const sinRespuesta = filas.filter((f) => f.codigo === 0).length;
  const otras = total - ok - limitadas - sinRespuesta;

  async function ejecutar(e) {
    e.preventDefault();
    setError("");
    const n = Math.min(MAX_SOLICITUDES, Math.max(1, Number(cantidad) || 1));
    const ruta = endpoint.trim().startsWith("/") ? endpoint.trim() : `/${endpoint.trim()}`;
    const url = API_URL + ruta;

    // Asegura un access vigente antes de la ráfaga (vive solo en memoria y dura poco).
    if (!tokens.getAccess() && !(await renovarAccess())) {
      setError("No hay un token válido. Vuelve a iniciar sesión.");
      return;
    }

    controlador.current?.abort();
    const ctrl = new AbortController();
    controlador.current = ctrl;
    setFilas([]);
    setUrlUsada(url);
    setDuracion(null);
    setCorriendo(true);
    const inicio = performance.now();
    const agregar = (fila) => setFilas((lista) => [...lista, fila].sort((a, b) => a.numero - b.numero));

    try {
      if (modo === "simultaneas") {
        await Promise.all(Array.from({ length: n }, (_, i) => unaSolicitud(i + 1, url, ctrl.signal).then(agregar)));
      } else {
        for (let i = 1; i <= n; i++) agregar(await unaSolicitud(i, url, ctrl.signal));
      }
      setDuracion(Math.round(performance.now() - inicio));
    } catch (err) {
      if (err?.name !== "AbortError") setError("La prueba se interrumpió por un error inesperado.");
    } finally {
      if (controlador.current === ctrl) setCorriendo(false);
    }
  }

  function detener() {
    controlador.current?.abort();
    setCorriendo(false);
  }

  return (
    <div className="grid gap-4">
      <section className="hoja">
        <div className="hoja-cabeza">
          <h1 className="text-[1.02rem] font-bold">Diagnóstico del rate limit</h1>
          <span className={`timbre ${viaGateway ? "timbre-ok" : "timbre-warn"}`}>
            {viaGateway ? "API Gateway" : "Directo (sin Gateway)"}
          </span>
        </div>
        <div className="hoja-cuerpo grid gap-4">
          <p className="max-w-3xl text-texto-2">
            El stage de API Gateway tiene throttling con <strong className="text-texto">rate 2</strong> (solicitudes por
            segundo sostenidas) y <strong className="text-texto">burst 5</strong> (cuántas puede absorber de golpe). Al
            superar esos valores, Gateway responde <span className="folio">429 Too Many Requests</span> sin llegar al
            backend. AWS aplica estos límites como objetivo y no de forma exacta: es normal que pasen algunas más o menos
            de 5 en una ráfaga, o que el resultado cambie entre una prueba y otra.
          </p>

          <div className="text-sm">
            <span className="font-semibold">URL base: </span>
            <code className="break-all">{API_URL}</code>
          </div>
          {!viaGateway && (
            <Aviso tipo="warning">
              Esta compilación no apunta a API Gateway, así que el throttling no aplica. Define VITE_API_URL con la
              Invoke URL del Gateway y vuelve a compilar (npm run build).
            </Aviso>
          )}

          <form className="grid gap-4 sm:grid-cols-[2fr_1fr_1.4fr_auto] sm:items-end" onSubmit={ejecutar}>
            <div>
              <label className="etiqueta" htmlFor="diag-endpoint">Endpoint</label>
              <input
                id="diag-endpoint"
                className="campo"
                list="diag-endpoints"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                required
                disabled={corriendo}
              />
              <datalist id="diag-endpoints">
                {ENDPOINTS.map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="etiqueta" htmlFor="diag-cantidad">Solicitudes</label>
              <input
                id="diag-cantidad"
                className="campo num"
                type="number"
                min="1"
                max={MAX_SOLICITUDES}
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                required
                disabled={corriendo}
              />
            </div>
            <fieldset disabled={corriendo}>
              <legend className="etiqueta">Modo</legend>
              <div className="flex min-h-[44px] flex-wrap items-center gap-4">
                <label className="inline-flex items-center gap-2">
                  <input type="radio" name="modo" value="simultaneas" checked={modo === "simultaneas"} onChange={() => setModo("simultaneas")} />
                  Simultáneas
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="radio" name="modo" value="serie" checked={modo === "serie"} onChange={() => setModo("serie")} />
                  En serie
                </label>
              </div>
            </fieldset>
            {corriendo ? (
              <button type="button" className="btn btn-secundario" onClick={detener}>
                <i className="bi bi-stop-circle" aria-hidden="true"></i> Detener
              </button>
            ) : (
              <button type="submit" className="btn btn-primario">
                <i className="bi bi-lightning-charge" aria-hidden="true"></i> Disparar
              </button>
            )}
          </form>
          {error && <Aviso tipo="error">{error}</Aviso>}
        </div>
      </section>

      {(total > 0 || corriendo) && (
        <section className="hoja">
          <div className="hoja-cabeza">
            <h2>Resultado</h2>
            <span className="text-sm text-texto-2" aria-live="polite">
              {corriendo ? `Enviando… ${total} respondidas` : duracion !== null ? `${total} solicitudes en ${duracion} ms` : `${total} solicitudes`}
            </span>
          </div>
          <div className="hoja-cuerpo grid gap-3 border-b border-linea-suave sm:grid-cols-4">
            <Cifra titulo="200 OK" valor={ok} clase="text-ok" />
            <Cifra titulo="429 limitadas" valor={limitadas} clase="text-folio" />
            <Cifra titulo="Otros códigos" valor={otras} clase="text-warn" />
            <Cifra titulo="Sin respuesta" valor={sinRespuesta} clase="text-baja" />
            <p className="text-sm text-texto-2 sm:col-span-4">
              URL usada: <code className="break-all">{urlUsada}</code>
              {sinRespuesta > 0 && " · Las solicitudes sin respuesta suelen ser 429 del Gateway sin cabeceras CORS."}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="tabla">
              <caption className="sr-only">Resultado de cada solicitud</caption>
              <thead>
                <tr>
                  <th scope="col" className="num">#</th>
                  <th scope="col">Código HTTP</th>
                  <th scope="col" className="num">Milisegundos</th>
                  <th scope="col">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.numero}>
                    <td data-label="#" className="num">{f.numero}</td>
                    <td data-label="Código HTTP">
                      <span className={`timbre ${claseCodigo(f.codigo)}`}>{f.codigo || "—"}</span>
                    </td>
                    <td data-label="Milisegundos" className="num">{f.ms}</td>
                    <td data-label="Detalle" className="text-texto-2">{f.nota || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function Cifra({ titulo, valor, clase }) {
  return (
    <div>
      <div className="text-[0.72rem] font-bold tracking-[0.06em] text-texto-2 uppercase">{titulo}</div>
      <div className={`num text-3xl font-bold ${clase}`}>{valor}</div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { api, resultados } from "../../api/client";
import { useAuth } from "../../auth/contexto";
import { Aviso } from "../../components/Aviso";
import { useAviso } from "../../components/avisos";
import Cargando from "../../components/Cargando";
import Formulario from "../../components/Formulario";
import { puedeEscribir } from "./comun";

const TIPOS_FOTO = ["image/jpeg", "image/png", "image/webp"];
const MAX_FOTO_MB = 5;

/**
 * Crear (POST /activos/) o editar (PATCH /activos/{id}/) un activo. Solo Bodeguero y Administrador.
 * El código lo asigna el backend según el prefijo de la categoría, por eso la categoría no se cambia al editar.
 * La foto (opcional) se sube aparte en multipart con PATCH, una vez guardado el activo.
 */
export default function FormActivo() {
  const { id } = useParams();
  const editando = Boolean(id);
  const { rol } = useAuth();
  const navegar = useNavigate();
  const aviso = useAviso();

  const [activo, setActivo] = useState(null);
  const [categorias, setCategorias] = useState([]);
  const [bodegas, setBodegas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [foto, setFoto] = useState(null);
  const [errorFoto, setErrorFoto] = useState("");

  useEffect(() => {
    const control = new AbortController();
    const opciones = { params: { page_size: 500 }, signal: control.signal };
    Promise.all([
      api.get("/categorias/", opciones),
      api.get("/bodegas/", opciones),
      editando ? api.get(`/activos/${id}/`, { signal: control.signal }) : Promise.resolve(null),
    ])
      .then(([c, b, a]) => {
        setCategorias(resultados(c).filas);
        setBodegas(resultados(b).filas);
        setActivo(a);
      })
      .catch((e) => {
        if (e?.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!control.signal.aborted) setCargando(false);
      });
    return () => control.abort();
  }, [id, editando]);

  if (!puedeEscribir(rol)) return <Navigate to={editando ? `/activos/${id}` : "/activos"} replace />;
  if (cargando) return <Cargando />;

  const campos = [
    { nombre: "nombre", etiqueta: "Nombre", requerido: true, maxLength: 120, ancho: "completo" },
    {
      nombre: "categoria",
      etiqueta: "Categoría",
      tipo: "select",
      requerido: true,
      deshabilitado: editando,
      ayuda: editando ? "No se cambia: define el código del activo." : "Define el prefijo del código (p. ej. RTM-0005).",
      opciones: categorias.map((c) => ({ valor: String(c.id), texto: `${c.nombre} (${c.prefijo_codigo})` })),
    },
    {
      nombre: "bodega_actual",
      etiqueta: "Bodega",
      tipo: "select",
      opciones: bodegas.map((b) => ({ valor: String(b.id), texto: b.nombre })),
    },
    { nombre: "marca", etiqueta: "Marca", maxLength: 60 },
    { nombre: "modelo", etiqueta: "Modelo", maxLength: 60 },
    { nombre: "numero_serie", etiqueta: "N.º de serie", maxLength: 60 },
    { nombre: "fecha_adquisicion", etiqueta: "Fecha de adquisición", tipo: "date" },
    { nombre: "valor_compra", etiqueta: "Valor de compra (CLP)", tipo: "number", min: 0, step: 1, inputMode: "numeric" },
  ];

  const iniciales = activo
    ? {
        ...activo,
        categoria: activo.categoria != null ? String(activo.categoria) : "",
        bodega_actual: activo.bodega_actual != null ? String(activo.bodega_actual) : "",
      }
    : undefined;

  function elegirFoto(e) {
    const archivo = e.target.files?.[0] || null;
    setErrorFoto("");
    if (archivo && !TIPOS_FOTO.includes(archivo.type)) {
      setErrorFoto("Usa una imagen JPG, PNG o WebP.");
      e.target.value = "";
      return setFoto(null);
    }
    if (archivo && archivo.size > MAX_FOTO_MB * 1024 * 1024) {
      setErrorFoto(`La foto no puede superar ${MAX_FOTO_MB} MB.`);
      e.target.value = "";
      return setFoto(null);
    }
    setFoto(archivo);
  }

  async function guardar(valores) {
    const cuerpo = {
      ...valores,
      categoria: valores.categoria ? Number(valores.categoria) : null,
      bodega_actual: valores.bodega_actual ? Number(valores.bodega_actual) : null,
    };
    if (editando) delete cuerpo.categoria;
    const guardado = editando ? await api.patch(`/activos/${id}/`, cuerpo) : await api.post("/activos/", cuerpo);

    if (foto) {
      const datos = new FormData();
      datos.append("foto", foto);
      try {
        const conFoto = await api.patch(`/activos/${guardado.id}/`, datos);
        // Si el serializer no acepta "foto" como campo escribible, DRF la ignora y responde 200 igual.
        if (!conFoto?.foto_url) aviso("El activo se guardó, pero el servidor no registró la foto.", "warning");
      } catch (e) {
        aviso(`El activo se guardó, pero la foto no se pudo subir: ${e.message}`, "warning");
      }
    }
    aviso(editando ? `${guardado.codigo} actualizado.` : `Activo ${guardado.codigo} creado.`);
    navegar(`/activos/${guardado.id}`);
  }

  return (
    <div className="grid gap-5">
      <nav className="text-sm" aria-label="Ruta">
        <Link to="/activos">Activos</Link>
        {editando && activo && (
          <>
            {" / "}
            <Link to={`/activos/${id}`}>{activo.codigo}</Link>
          </>
        )}
        <span className="text-texto-2"> / {editando ? "Editar" : "Nuevo"}</span>
      </nav>
      <section className="hoja">
        <div className="hoja-cabeza">
          <h1 className="text-[1.02rem] font-bold">
            {editando ? (
              <>
                Editar <span className="folio">{activo?.codigo}</span>
              </>
            ) : (
              "Nuevo activo"
            )}
          </h1>
        </div>
        <div className="hoja-cuerpo">
          {error ? (
            <Aviso tipo="error">{error}</Aviso>
          ) : (
            <Formulario
              campos={campos}
              valoresIniciales={iniciales}
              textoEnviar={editando ? "Guardar cambios" : "Crear activo"}
              onEnviar={guardar}
              onCancelar={() => navegar(editando ? `/activos/${id}` : "/activos")}
            >
              <div>
                <label className="etiqueta" htmlFor="campo-foto">
                  Foto <span className="font-normal text-texto-2">(opcional)</span>
                </label>
                <input
                  id="campo-foto"
                  type="file"
                  accept={TIPOS_FOTO.join(",")}
                  className="campo"
                  onChange={elegirFoto}
                  aria-invalid={errorFoto ? "true" : undefined}
                  aria-describedby="campo-foto-ayuda"
                />
                <div id="campo-foto-ayuda" className="ayuda-campo">
                  JPG, PNG o WebP, hasta {MAX_FOTO_MB} MB.{editando ? " Si eliges una, reemplaza la actual." : ""}
                </div>
                {errorFoto && <div className="error-campo">{errorFoto}</div>}
              </div>
            </Formulario>
          )}
        </div>
      </section>
    </div>
  );
}

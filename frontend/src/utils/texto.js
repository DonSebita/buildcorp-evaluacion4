/**
 * Quita las barras "/" del final de una URL o ruta.
 * Recorre el texto en vez de usar /\/+$/ (esa regex retrocede de forma cuadrática
 * con entradas como "////…x", hallazgo de SonarQube S8786).
 */
export function sinBarrasFinales(texto) {
  let fin = texto.length;
  while (fin > 0 && texto[fin - 1] === "/") fin -= 1;
  return texto.slice(0, fin);
}

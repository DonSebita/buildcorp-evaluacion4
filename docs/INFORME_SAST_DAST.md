# Informe SAST / DAST · BuildCorp (Evaluación 4)

> Criterio P5 y objetivo O1. Evidencias en [docs/evidencias/](evidencias/INDICE.md) (E16–E21).
> Las secciones marcadas con **[COMPLETAR]** se llenan después de desplegar en AWS.

## 1. Alcance

| | SAST (SonarQube) | DAST (OWASP ZAP) |
|---|---|---|
| Objetivo | Código fuente: `apps/`, `buildcorp/`, `frontend/src/` | Frontend Vite en la EC2 y API REST detrás de API Gateway |
| Versión analizada | Código del repositorio a la fecha del análisis | App desplegada en AWS Academy (entorno propio) |
| Herramienta | SonarQube Community (`sonarqube:community`) + `sonarsource/sonar-scanner-cli` | `ghcr.io/zaproxy/zaproxy:stable` (`zap-baseline.py`, `zap-api-scan.py`) |
| Configuración | [`sonar-project.properties`](../sonar-project.properties) | [`scripts/zap/zap_baseline.sh`](../scripts/zap/zap_baseline.sh), [`scripts/zap/zap_api.sh`](../scripts/zap/zap_api.sh) |
| Excluido | migraciones, `staticfiles/`, `media/`, `graphify-out/`, `node_modules/`, `dist/` | Servicios administrados de AWS (RDS, S3, consola) |

Autorización: ambos escaneos se hacen solo contra recursos propios del laboratorio AWS Academy del estudiante.

## 2. Ejecución

### 2.1 SonarQube (local)

```bash
# 1. Levantar el servidor (la primera vez tarda ~1 min)
docker run -d --name sonarqube -p 9000:9000 sonarqube:community
# En Linux, si Elasticsearch no arranca:  sudo sysctl -w vm.max_map_count=524288

# 2. Entrar a http://localhost:9000 (admin / admin, pide cambiarla)
#    My Account → Security → Generate Token (tipo "Global Analysis Token")
export SONAR_TOKEN="<token>"        # no lo guardes en el repositorio

# 3. (Opcional) cobertura para que Sonar la muestre
pip install coverage
coverage run manage.py test && coverage xml -o coverage.xml

# 4. Escanear desde la raíz del proyecto
docker run --rm --network host \
  -e SONAR_HOST_URL=http://localhost:9000 -e SONAR_TOKEN \
  -v "$PWD":/usr/src sonarsource/sonar-scanner-cli
# En Windows/Mac usa -e SONAR_HOST_URL=http://host.docker.internal:9000 en vez de --network host
```

Resultado en `http://localhost:9000/dashboard?id=buildcorp`. Capturar *Summary* y *Issues → Security* antes y después de corregir.

**Primera corrida (antes), 2026-11-25** · hecha por la IA en un contenedor propio, sobre el código del momento (aún sin `frontend/src`, por eso se analizaron `apps, buildcorp, static/js, templates`):

| Métrica | Valor |
|---|---|
| Líneas de código | 5.376 |
| Quality Gate | Passed (gate por defecto, solo mira código nuevo) |
| Seguridad | 12 vulnerabilidades · nota **E** (por 1 Blocker) |
| Confiabilidad | 5 bugs · nota C |
| Mantenibilidad | 5 code smells · nota A |
| Security Hotspots | 0 |
| Cobertura | 0 % (no se generó `coverage.xml`) |

Archivos: [capturas y JSON](evidencias/sonarqube/) (`E16_sonarqube_antes_*.png`, `issues_antes.json`, `medidas_antes.json`).

### 2.2 OWASP ZAP (contra AWS) [COMPLETAR]

```bash
# Baseline del frontend (pasivo: spider + reglas pasivas)
bash scripts/zap/zap_baseline.sh http://<IP_FRONTEND> antes

# API scan (activo) usando el esquema OpenAPI a través de API Gateway
export ZAP_TOKEN="<access JWT de un usuario de prueba>"
bash scripts/zap/zap_api.sh https://<id>.execute-api.us-east-1.amazonaws.com antes
```

Reportes en `docs/evidencias/zap/`. Throttling: API Gateway está en 2 req/s, ráfaga 5. El script baja ZAP a 1 hilo y 400 ms entre peticiones; si igual aparecen muchos 429, anotar aquí si se subió el límite temporalmente y a cuánto: **[COMPLETAR]**.

| Escaneo | Fecha | URL | Alertas Alta / Media / Baja / Info |
|---|---|---|---|
| Baseline frontend (antes) | | | |
| API scan (antes) | | | |
| Baseline frontend (después) | | | |
| API scan (después) | | | |

## 3. Hallazgos

### 3.1 SAST: reportados por SonarQube

| # | Severidad | Regla | Archivo:línea | Descripción |
|---|---|---|---|---|
| S1 | Blocker | secrets:S6698 | `buildcorp/settings/base.py:83` | Contraseña de PostgreSQL en el default de `DATABASE_URL` (`postgres://buildcorp:buildcorp@...`) |
| S2 | Major | javascript:S2068 | `templates/registration/login.html:82` | Contraseña demo `buildcorp2026` escrita en el JS del login |
| S3 | Minor ×10 | Web:S5725 | `templates/base.html:12,13,85`, `templates/registration/login.html:12`, `apps/activos/templates/activos/escanear.html:14`, `apps/dashboard/templates/dashboard/inicio.html:59`, `apps/mantenimiento/templates/mantenimiento/registrar.html:42`, `apps/prestamos/templates/prestamos/devolver.html:62`, `entregar.html:43,44` | Recursos de CDN (Bootstrap, iconos, librerías) sin `integrity` (SRI) ni `crossorigin` |
| S4 | Major ×5 (bug) | Web:S5256 | `paquetes.html:20`, `cobro.html:24`, `comprobante.html:46`, `detalle.html:68`, `devolver.html:49` | Tablas sin `<th>` (accesibilidad, no seguridad) |
| S5 | Blocker (smell) | python:S1845 | `apps/prestamos/models.py:70` | Método `en_terreno` choca con la constante `EN_TERRENO` (legibilidad) |

### 3.2 SAST: revisión manual (no todo lo detecta Sonar Community)

Líneas verificadas el 2026-11-25. Pueden moverse si cambian los archivos.

| # | Archivo:línea | Hallazgo | ¿Sonar lo vio? | Corrección sugerida |
|---|---|---|---|---|
| M1 | `buildcorp/settings/base.py:12` | `SECRET_KEY` con default `"dev-inseguro-cambiar-en-produccion"`: si falta en el `.env` de producción, Django arranca con una clave conocida (firma de sesiones, CSRF, tokens de reseteo y JWT si usa la misma clave) | No | Sin default en `prod.py`: `SECRET_KEY = env("SECRET_KEY")`, que falle si no existe. Mantener el default solo en `dev.py`. |
| M2 | `buildcorp/settings/base.py:18` | `MOSTRAR_CREDENCIALES_DEMO` | No | Ya corregido a `default=False` durante la migración (T1). Verificar que el `.env` de la EC2 no lo active. |
| M3 | `apps/usuarios/management/commands/cargar_demo.py:25` (uso en 88 y 121) | Clave demo fija `buildcorp2026` para todos los usuarios demo, y se imprime en consola | No | Leerla de `env("CLAVE_DEMO")` o generarla con `secrets.token_urlsafe()` y mostrarla una vez. Alternativa: justificar (solo datos demo, nunca en producción real) y obligar cambio de clave. |
| M4 | `templates/registration/login.html:41` y `:82` | La clave demo aparece en el HTML del login (protegido por `mostrar_credenciales_demo`, pero el texto queda en el código) | Parcial (S2068 en :82) | Pasar la clave desde el contexto solo cuando el flag esté activo, o quitar el bloque en la versión desplegada. |
| M5 | `buildcorp/settings/base.py:83` | = S1: credencial por defecto de la BD | Sí | `env.db("DATABASE_URL")` sin default en prod; el default sin contraseña solo en `dev.py`. |
| M6 | `buildcorp/settings/prod.py:16-19` | `SESSION_COOKIE_SECURE`, `SECURE_SSL_REDIRECT` en False y `SECURE_HSTS_SECONDS=0` por defecto | No | Al servir por API Gateway (HTTPS), activar `*_COOKIE_SECURE=True` en el `.env`. HSTS solo si todo el sitio va por HTTPS. |
| M7 | `deploy/nginx_buildcorp.conf:11-13` | `/media/` servido por Nginx sin autenticación (fotos de activos, firmas de préstamos) a quien conozca la URL | No | Con S3: bucket privado + URL prefirmada (Paso 6 del plan). Retirar el `location /media/`. |
| M8 | `deploy/nginx_buildcorp.conf` | Sin `server_tokens off` ni cabeceras de seguridad (CSP, nosniff, etc.) | No (es configuración) | Ya resuelto en las plantillas nuevas `deploy/backend/nginx_backend.conf` y `deploy/frontend/nginx_frontend.conf` (T4). ZAP debe confirmarlo. |
| M9 | `static/js/*.js`, plantillas con `innerHTML` | Construcción de HTML con template strings | No (Community no analiza XSS) | Revisado: los datos pasan por `esc()`. Riesgo bajo; en Vite/React el escape es automático (evitar `dangerouslySetInnerHTML`). |

### 3.3 DAST: OWASP ZAP [COMPLETAR]

Alertas típicas esperadas y su estado:

| Alerta ZAP | Riesgo | Dónde | Estado / corrección |
|---|---|---|---|
| Content Security Policy (CSP) Header Not Set | Medio | Frontend | Plantilla `nginx_frontend.conf` agrega CSP; verificar |
| Missing Anti-clickjacking Header | Medio | Frontend / API | `X-Frame-Options DENY` en Nginx y Django |
| X-Content-Type-Options Header Missing | Bajo | Frontend / API | `nosniff` en Nginx |
| Server Leaks Version Information | Bajo | Frontend / API | `server_tokens off` |
| Strict-Transport-Security Header Not Set | Bajo | API Gateway (HTTPS) | API Gateway termina TLS; el frontend en la EC2 va por HTTP (justificar) |
| Cookie No HttpOnly / Secure Flag | Bajo | Admin de Django | `SESSION_COOKIE_SECURE=True` tras HTTPS |
| 429 Too Many Requests | Info | API | Esperado por el throttling: evidencia de que funciona |

## 4. Corrección o justificación

Regla: al menos una corrección SAST y una DAST con captura antes, commit y captura después.

| Hallazgo | Decisión | Commit | Antes | Después |
|---|---|---|---|---|
| S1 / M5 credencial BD por defecto | Corregir **[COMPLETAR]** | | E16 | E17 |
| M1 `SECRET_KEY` con default | Corregir **[COMPLETAR]** | | | |
| M3 clave demo fija | Justificar o corregir **[COMPLETAR]** | | | |
| S3 recursos CDN sin SRI | Desaparece al pasar a Vite (dependencias empaquetadas por npm) | | | |
| S4 / S5 | Fuera de alcance de seguridad; se aceptan | | | |
| Cabeceras ZAP (CSP, nosniff, Server) | Corregir en Nginx y re-escanear **[COMPLETAR]** | | E18 | E21 |

## 5. Comparación SAST vs DAST

| | SAST (SonarQube) | DAST (OWASP ZAP) |
|---|---|---|
| Qué analiza | Código fuente, sin ejecutarlo (caja blanca) | La aplicación en ejecución, desde fuera, como un atacante (caja negra) |
| Cuándo se usa | Temprano, en cada commit o PR | Con la app desplegada en un entorno de prueba |
| Qué detecta | Secretos en el código, malas prácticas, patrones inseguros, bugs, código duplicado | Cabeceras de seguridad faltantes, cookies inseguras, configuración del servidor, XSS reflejado, errores expuestos |
| En este proyecto | Contraseña de BD por defecto, clave demo en el login, CDN sin SRI | **[COMPLETAR]** con lo que encuentre ZAP |
| Límites | Falsos positivos; no ve la configuración real del servidor (Nginx, API Gateway, `.env`); la edición Community no rastrea inyecciones/XSS; no vio el `SECRET_KEY` con default (M1) | No ve el código; solo prueba las rutas que encuentra o que están en el OpenAPI; el throttling y la autenticación limitan la cobertura; no encuentra secretos en el repositorio |
| Conclusión | Se complementan: SAST encontró secretos en código que ZAP nunca vería, y ZAP encuentra configuración del servidor que no está en el código. |

## 6. Conclusiones [COMPLETAR]

- Hallazgos corregidos: …
- Hallazgos justificados: …
- Lección aprendida: …

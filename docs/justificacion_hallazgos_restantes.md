# Hallazgos restantes tras la corrección (SAST/DAST)

## OWASP ZAP (E19 → E21)

Bajó de 9 a 4 alertas: las 2 de riesgo medio desaparecieron (CSP no configurada y CSP `style-src 'unsafe-inline'`), al igual que la alerta informativa de caché. Las que quedan son falsos positivos o respuestas que genera AWS API Gateway, no la aplicación.

| Alerta | URL | Justificación |
|---|---|---|
| Inyección SQL (Alto, confianza media) | `GET /api/v1/cobros/10 AND 1=1 -- ` | **Falso positivo.** La respuesta que ZAP comparó es un `429 Too Many Requests` de API Gateway (`{"message":"Too Many Requests"}`): el rate limit cortó el escaneo y las respuestas iguales parecieron una condición booleana. Probado con un token válido: `/cobros/10/`, `/cobros/10 AND 1=1 -- /` y `/cobros/10 OR 1=1 -- /` responden **404**. El id se resuelve con el ORM de Django (consultas parametrizadas), que nunca arma SQL con ese texto. |
| Strict-Transport-Security no establecido (Bajo) | `GET /sitemap.xml` | Es el `404 {"message":"Not Found"}` que **API Gateway (HTTP API)** genera para rutas fuera de `/api/*`; la petición no llega a la aplicación. El HTTP API no permite agregar cabeceras a sus respuestas propias. Todas las respuestas de la aplicación (`/api/...`) ya envían HSTS, CSP y `Cache-Control: no-store`. |
| Petición de autenticación identificada (Informativo) | `POST /api/v1/auth/token/` | Informativo: ZAP solo detecta el login JWT. Responde 401 con credenciales inválidas, como se espera. |
| Respuesta de gestión de sesión identificada (Informativo) | `POST /api/v1/auth/token/` | Informativo: ZAP detecta el token `access` del JWT. Es el comportamiento esperado. |

## SonarQube Cloud (E16 → E17)

Bajó de 86 a 12 issues. Reliability y Maintainability quedaron en **A** (0 bugs, 0 code smells). Los 12 restantes son la regla `shell:S5332` ("uso de protocolo en texto claro") en los scripts de despliegue y se marcaron como **Accepted**:

- La EC2 backend no tiene TLS propio y solo es alcanzable por API Gateway, que agrega la cabecera secreta `X-Origin-Verify`. Sin ella, Nginx responde 403.
- Los clientes usan siempre HTTPS: API Gateway y el frontend con Let's Encrypt, que además envía HSTS.
- Las URL `http://` que quedan corresponden a mensajes de consola, a la IP interna en `ALLOWED_HOSTS`/`CSRF_TRUSTED_ORIGINS` y al respaldo sin dominio del script de instalación.

Las correcciones están en los commits `c0c5b25` (DAST) y `6634ad1` (SAST) del repositorio (evidencia E20).

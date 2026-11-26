# Paso a paso para la presentación · BuildCorp (Evaluación 4)

Guía para la defensa, ordenada por criterio de la pauta (P1–P8). En cada paso dice **qué mostrar en vivo** y **qué evidencia lo respalda** (rutas relativas a `docs/evidencias/`). Índice completo: [evidencias/INDICE.md](evidencias/INDICE.md).

## Antes de empezar (5 min antes)

1. Iniciar el laboratorio de AWS Academy y comprobar en EC2 que `buildcorp-backend` y `buildcorp_frontend` están **En ejecución**. Si cambiaron las IP, el dominio `sslip.io` cambia también (ver `deploy/frontend/README.md`).
2. Abrir estas pestañas:
   - App: https://buildcorp.184-197-126-20.sslip.io
   - Swagger vía API Gateway: https://f5nr8vmiu8.execute-api.us-east-1.amazonaws.com/api/docs/
   - Consola AWS: EC2, RDS, S3, API Gateway, CloudWatch, SNS, Lambda.
   - Repositorio: https://github.com/DonSebita/buildcorp-evaluacion4
3. Tener a mano el diagrama [E12_diagrama_arquitectura.png](evidencias/E12_diagrama_arquitectura.png) y el informe [INFORME_SAST_DAST.md](INFORME_SAST_DAST.md).

**Usuarios demo** (misma clave para todos, la del README): `admin` (Administrador), `bodeguero` (Bodeguero), `encargado` (Encargado de entrega), `ventas` (Ventas).

## 0. Introducción y arquitectura (1–2 min)

- Mostrar el diagrama **E12** y recorrer una petición: navegador → HTTPS al frontend (Nginx + SPA Vite) → `fetch` a API Gateway con JWT → API Gateway agrega `X-Origin-Verify` → EC2 backend (Nginx + Gunicorn + Django REST) → RDS por SSL y S3 con URLs prefirmadas.
- Mencionar el despliegue continuo: cada `git push` a `main` se publica solo en unos 2 minutos (timers systemd que hacen `git pull` en las dos EC2).

## P1 · API REST con autenticación JWT

| Paso | Qué mostrar en vivo | Evidencia |
|---|---|---|
| 1 | Swagger UI con los endpoints agrupados por módulo | `terminal/E01_swagger_ui.png` |
| 2 | En Swagger: `POST /api/v1/auth/token/` con `admin` → devuelve `access` y `refresh` | `terminal/E02_login_jwt.*` |
| 3 | Botón **Authorize** con el token y un CRUD (crear, ver, editar, borrar) con sus códigos 201/200/204/400 | `terminal/E03_crud_codigos_http.*` |

## P2 · Frontend Vite integrado con la API

| Paso | Qué mostrar en vivo | Evidencia |
|---|---|---|
| 1 | Entrar a la app como `admin`, abrir **Trabajadores** y crear o editar uno; también un activo o contratista | En vivo (E06) |
| 2 | DevTools → Network: la petición a API Gateway con `Authorization: Bearer …` y su respuesta JSON | En vivo (E07) |
| 3 | Entrar como `bodeguero` o `ventas` para mostrar que el menú cambia según el rol | En vivo |

> E06–E08 no tienen captura guardada: se muestran en vivo.

## P3 · Infraestructura en AWS

| Paso | Qué mostrar en vivo | Evidencia |
|---|---|---|
| 1 | EC2: instancias frontend y backend en ejecución | `aws/E09_ec2_en_ejecucion.png` |
| 2 | RDS `buildcorp-db`: disponible y **Accesible públicamente: No** | `aws/E10_rds_sin_acceso_publico.png`, `aws/E10a…E10c` |
| 3 | S3: bucket `buildcorp-sebastian-assets` | `aws/E11_s3_bucket.png` |
| 4 | Diagrama de arquitectura | `E12_diagrama_arquitectura.png` |

## P4 · Seguridad de la aplicación

| Paso | Qué mostrar | Evidencia |
|---|---|---|
| 1 | Petición sin token → **401** | `terminal/E04_sin_token_401.*` |
| 2 | Usuario con rol sin permiso (p. ej. `ventas` intentando gestionar trabajadores) → **403** | `terminal/E05_rol_sin_permiso_403.*` |
| 3 | Contraseñas guardadas con hash Argon2 | `terminal/E13_hash_argon2.*` |
| 4 | `make_password` con salt: mismo texto, hash distinto | `terminal/E14_make_password_salt.*` |
| 5 | `.env` del backend con permisos 600 (sin mostrar valores) | `terminal/E15_env_permisos_600.*` |

## P5 · Análisis SAST y DAST

| Paso | Qué mostrar | Evidencia |
|---|---|---|
| 1 | SonarQube **antes**: issues de seguridad, confiabilidad y mantenibilidad | `sonarqube/E16_*`, `sonarqube/E17b…E17f` |
| 2 | Corrección aplicada: commits `c0c5b25` (ZAP) y `6634ad1` (SonarQube) en GitHub | E20 |
| 3 | SonarQube **después**: Quality Gate **Passed**, 0 issues | `sonarqube/E17_sonarqube_despues_gate_passed.png`, `sonarqube/E17g_*` |
| 4 | Falso positivo justificado (mensajes de validación con la palabra "password") | `sonarqube/E17a_falso_positivo_password.png`, `justificacion_hallazgos_restantes.md` |
| 5 | ZAP API scan autenticado vía API Gateway y re-escaneo después | `zap/E19_zap_api_autenticada.html`, `zap/E21_zap_despues.html` |
| 6 | Resumen de hallazgos y correcciones | [INFORME_SAST_DAST.md](INFORME_SAST_DAST.md) |

## P6 · API Gateway y protección del backend

| Paso | Qué mostrar | Evidencia |
|---|---|---|
| 1 | API Gateway `buildcorp-api`: integración HTTP hacia el backend | `aws/E22_apigw_integracion.png`, `aws/E22a_apigw_resumen.png` |
| 2 | Throttling: 2 req/s y ráfaga 5 | `aws/E23_apigw_throttling.png` |
| 3 | Prueba de carga que recibe **429** | `terminal/E24_carga_429.*` |
| 4 | Llamar directo a la IP de la EC2 backend → **403** (falta `X-Origin-Verify`) | `terminal/E25_ec2_directo_403.*` |
| 5 | Access logs y métricas 4xx en CloudWatch | `aws/E26a_apigw_access_logs.png`, `aws/E26_E34_dashboard_metricas_ec2_rds_4xx.png` |

## P7 · Seguridad de datos (RDS y S3)

| Paso | Qué mostrar | Evidencia |
|---|---|---|
| 1 | RDS con cifrado habilitado (clave KMS `aws/rds`) | `aws/E27_rds_cifrado_kms.png`, `aws/E27a…E27b` |
| 2 | `buildcorp-sg-rds`: 5432 solo desde `sg-backend` | `aws/E28_sg_rds_5432_desde_sg_backend.png` |
| 3 | Conexión a RDS por SSL | `terminal/E29_rds_ssl.*`, `aws/E29a_rds_certificado_puerto.png` |
| 4 | S3: Block Public Access, cifrado SSE y política que exige HTTPS | `aws/E30_*`, `aws/E31_*`, `aws/E32_*` |
| 5 | URL prefirmada que funciona y luego expira (403) | `terminal/E33_url_prefirmada.*` |

## P8 · Monitoreo y respaldos

| Paso | Qué mostrar | Evidencia |
|---|---|---|
| 1 | Dashboard de CloudWatch con CPU de las EC2, RDS y 4xx | `aws/E35_dashboard.png`, `aws/E26_E34_dashboard_metricas_ec2_rds_4xx.png` |
| 2 | Alarma `buildcorp-backend-cpu-alta` conectada al tema SNS con suscripción por correo confirmada | `aws/E36a…E36d` |
| 3 | Backups automáticos de RDS (retención 7 días) | `aws/E37a_rds_backups_config.png` |
| 4 | Snapshot manual de RDS | `aws/E38_snapshot_manual.png` |
| 5 | Lambda `buildcorp-snapshot-7h`: variables y ejecución de prueba que creó un snapshot | `aws/E39a_lambda_variables.png`, `aws/E39b_lambda_test_ok.png` |

> E40 (restaurar un snapshot en una instancia nueva) **no se realizó**; el respaldo se demuestra con el snapshot manual (E38) y el snapshot creado por la Lambda (E39b).

## Cierre (1 min)

- Repositorio privado con despliegue automático por `git push`.
- Funciones de administrador: gestión de trabajadores (crear, editar, asignar rol, activar o desactivar, restablecer clave), categorías, alertas, cobros y parámetros.
- Pendiente declarado: E40 (restauración).

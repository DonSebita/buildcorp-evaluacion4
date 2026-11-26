# Índice de evidencias · Evaluación 4

Cada captura debe mostrar la configuración **y** el resultado, no solo el nombre del servicio.
Los archivos están agrupados por origen: `terminal/` (salidas reales), `aws/` (consola de AWS), `sonarqube/` y `zap/` (SAST/DAST). El nombre de cada archivo empieza con su número de evidencia.
Guía para la defensa, ordenada por criterio P1–P8: [PASO_A_PASO_PRESENTACION.md](../PASO_A_PASO_PRESENTACION.md). Diagrama: [E12](E12_diagrama_arquitectura.png).
Estados: Pendiente · Lista · Revisar.

| # | Evidencia | Criterio | Archivo | Estado |
|---|---|---|---|---|
| E01 | Swagger UI (`/api/docs/`) con los endpoints documentados | P1, P4 | `terminal/E01_swagger_ui.png` | Lista |
| E02 | Login JWT: `POST /api/token/` devuelve access y refresh | P1, P4 | `terminal/E02_login_jwt.png`, `terminal/E02_login_jwt.txt` | Lista |
| E03 | CRUD completo con códigos HTTP (201, 200, 204, 400) | P1, P4 | `terminal/E03_crud_codigos_http.png`, `terminal/E03_crud_codigos_http.txt` | Lista |
| E04 | Petición sin token responde 401 | P1, P4 | `terminal/E04_sin_token_401.png`, `terminal/E04_sin_token_401.txt` | Lista |
| E05 | Petición con rol sin permiso responde 403 | P1, P4 | `terminal/E05_rol_sin_permiso_403.png`, `terminal/E05_rol_sin_permiso_403.txt` | Lista |
| E06 | Operación (crear/editar) desde el frontend Vite | P2 |  | Pendiente |
| E07 | DevTools → Network con la petición y su respuesta | P2 |  | Pendiente |
| E08 | La fila creada/editada vista en RDS (psql o Admin) | P2 |  | Pendiente |
| E09 | Instancias EC2 (frontend y backend) en ejecución | P3 | `aws/E09_ec2_en_ejecucion.png` | Lista |
| E10 | RDS sin acceso público | P3 | `aws/E10_rds_sin_acceso_publico.png` | Lista |
| E11 | Bucket S3 del proyecto | P3 | `aws/E11_s3_bucket.png` | Lista |
| E12 | Diagrama de arquitectura | P3 | `E12_diagrama_arquitectura.png` (también `.svg` y el script `E12_diagrama_arquitectura_fuente.py`) | Lista |
| E13 | Hash Argon2/PBKDF2 en la tabla de usuarios | P4 | `terminal/E13_hash_argon2.png`, `terminal/E13_hash_argon2.txt` | Lista |
| E14 | `make_password` con salt (mismo texto, hash distinto) | P4 | `terminal/E14_make_password_salt.png`, `terminal/E14_make_password_salt.txt` | Lista |
| E15 | `.env` con permisos 600 (sin mostrar valores) | P4 | `terminal/E15_env_permisos_600.png`, `terminal/E15_env_permisos_600.txt` | Lista |
| E16 | SonarQube antes de corregir | P5 | `sonarqube/E16_sonarqube_antes_resumen.png`, `sonarqube/E16_sonarqube_antes_seguridad.png` | Lista (repetir en tu equipo para la defensa) |
| E17 | SonarQube después de corregir | P5 | `sonarqube/E17_sonarqube_despues_gate_passed.png` (Quality Gate Passed, 0 issues), `sonarqube/E17a_falso_positivo_password.png` … `sonarqube/E17g_despues_correccion_12_issues.png`, `../justificacion_hallazgos_restantes.md` | Lista |
| E18 | ZAP baseline del frontend (antes) | P5 |  | Pendiente |
| E19 | ZAP API scan con OpenAPI vía API Gateway | P5 | `zap/E19_zap_api_autenticada.html` | Lista |
| E20 | Corrección aplicada (diff o commit) | P5 | commits `c0c5b25` (DAST/ZAP) y `6634ad1` (SAST/SonarQube), `../INFORME_SAST_DAST.md` | Lista |
| E21 | ZAP re-escaneo después de la corrección | P5 | `zap/E21_zap_despues.html` | Lista |
| E22 | API Gateway: integración HTTP con el backend | P6 | `aws/E22_apigw_integracion.png` | Lista |
| E23 | API Gateway: throttling 2 req/s, ráfaga 5 | P6 | `aws/E23_apigw_throttling.png` | Lista |
| E24 | Prueba de carga que recibe 429 | P6 | `terminal/E24_carga_429.png`, `terminal/E24_carga_429.txt` | Lista |
| E25 | 403 al llamar directo a la EC2 (sin cabecera de origen) | P6 | `terminal/E25_ec2_directo_403.png`, `terminal/E25_ec2_directo_403.txt` | Lista |
| E26 | Métricas 4xx de API Gateway en CloudWatch | P6 | `aws/E26_E34_dashboard_metricas_ec2_rds_4xx.png`, `aws/E26a_apigw_access_logs.png` | Lista |
| E27 | RDS cifrado con KMS | P7 | `aws/E27_rds_cifrado_kms.png` (cifrado habilitado, clave aws/rds), `aws/E27a_rds_cifrado_kms_config.png`, `aws/E27b_rds_kms_insights.png` | Lista |
| E28 | Security Group: 5432 solo desde sg-backend | P7 | `aws/E28_sg_rds_5432_desde_sg_backend.png` | Lista |
| E29 | Conexión SSL activa a RDS | P7 | `terminal/E29_rds_ssl.png`, `terminal/E29_rds_ssl.txt` | Lista |
| E30 | S3 Block Public Access activado | P7 | `aws/E30_s3_block_public_access.png` | Lista |
| E31 | S3 cifrado del lado del servidor (SSE) | P7 | `aws/E31_s3_cifrado_sse.png` | Lista |
| E32 | Política del bucket que exige HTTPS | P7 | `aws/E32_s3_politica_https.png` | Lista |
| E33 | URL prefirmada funcionando (y expirada) | P7 | `terminal/E33_url_prefirmada.png`, `terminal/E33_url_prefirmada.txt` | Lista |
| E34 | Métricas de las EC2 en CloudWatch | P8 | `aws/E26_E34_dashboard_metricas_ec2_rds_4xx.png` | Lista |
| E35 | Dashboard de CloudWatch | P8 | `aws/E35_dashboard.png` | Lista |
| E36 | Alarma de CloudWatch + notificación SNS recibida | P8 | `aws/E36a_sns_suscripcion_confirmada.png`, `aws/E36b_sns_tema_suscripcion.png`, `aws/E36c_alarma_creada.png`, `aws/E36d_sns_suscripcion.png` | Lista |
| E37 | Backups automáticos de RDS (retención) | P8 | `aws/E37a_rds_backups_config.png` | Lista |
| E38 | Snapshot manual de RDS | P8 | `aws/E38_snapshot_manual.png` | Lista |
| E39 | Lambda + EventBridge Scheduler `rate(7 hours)` | P8 | `aws/E39a_lambda_variables.png`, `aws/E39b_lambda_test_ok.png` | Lista (Lambda probada con snapshot real; el disparo programado se muestra en la consola) |
| E40 | Restauración desde snapshot (instancia nueva, conteo de filas) | P8 |  | No realizada (se presenta el snapshot manual E38 como respaldo restaurable) |

Carpetas: `aws/` (capturas de la consola de AWS), `terminal/` (E01–E05, E13–E15, E24, E25, E29, E33: salida real en .txt y captura .png, generadas el 2026-11-26), `sonarqube/` (E16–E17), `zap/` (E18–E21, reportes HTML de `scripts/zap/`).
Informe asociado: [INFORME_SAST_DAST.md](../INFORME_SAST_DAST.md).

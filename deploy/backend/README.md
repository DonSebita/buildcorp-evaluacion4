# Despliegue de la EC2 backend (Evaluación 4)

Nginx + Gunicorn + Django REST Framework en una EC2 Ubuntu 24.04, conectada a **RDS PostgreSQL** (con TLS) y a **S3**. No instala PostgreSQL local: reemplaza a `deploy/setup_ec2.sh`, que se mantiene solo como referencia de la versión de una sola EC2.

## Archivos

| Archivo | Qué hace |
|---|---|
| `setup_backend.sh` | Instalación completa (idempotente: se puede volver a correr) |
| `parametros.env.example` | Plantilla de parámetros (RDS, bucket, frontend, API Gateway, secreto) |
| `nginx_backend.conf` | Plantilla de Nginx: `server_tokens off`, cabeceras de seguridad y regla de la cabecera `X-Origin-Verify` |
| `gunicorn.service` | Servicio systemd, se instala como `buildcorp.service` |
| `crontab.txt` | Revisión diaria de morosidad (06:00) y mantenciones (06:10), hora de Chile |
| `../frontend/actualizar_ips.sh` | Script compartido para cuando AWS Academy cambie las IP |

## Antes de empezar (en la consola de AWS)

1. RDS creada (sin acceso público, con `sg-rds` que solo acepta 5432 desde `sg-backend`) y con la base `buildcorp` creada.
2. Bucket S3 creado.
3. EC2 lanzada con `sg-backend` y el perfil **LabInstanceProfile** (da acceso a S3 sin llaves).
4. Un secreto generado con `openssl rand -hex 24` (será `ORIGIN_SECRET` aquí y en API Gateway).

## Orden de ejecución

```bash
# 1. Conectarse y clonar
ssh -i buildcorp-key.pem ubuntu@<IP_BACKEND>
git clone <URL_DEL_REPO> /home/ubuntu/BuildCorp && cd /home/ubuntu/BuildCorp
git checkout eva4            # si se trabaja en esa rama

# 2. Completar parámetros (fuera del repo, permiso 600)
cp deploy/backend/parametros.env.example ~/buildcorp-backend.env
nano ~/buildcorp-backend.env
chmod 600 ~/buildcorp-backend.env

# 3. Instalar
sudo bash deploy/backend/setup_backend.sh ~/buildcorp-backend.env
```

Si `FRONTEND_ORIGIN` o `API_GATEWAY_HOST` todavía no existen, se puede poner un valor provisorio y después corregirlo con `actualizar_ips.sh --frontend ... --api-host ...` (no hace falta reinstalar).

El script:

1. Instala Python, Nginx, git y **solo el cliente** `psql`; deja la zona horaria en `America/Santiago`.
2. Descarga el bundle TLS de RDS a `/etc/ssl/certs/rds-global-bundle.pem`.
3. Arma `DATABASE_URL` con `sslmode=require` (o `verify-full` + `sslrootcert` si `DB_SSLMODE=verify-full`) y prueba la conexión mostrando `ssl=t`.
4. Crea el `.venv` e instala `requirements.txt`.
5. Escribe `.env` con permiso **600** (`DEBUG=False`, `SECRET_KEY` aleatoria que se conserva al re-ejecutar, `ALLOWED_HOSTS` con la IP/DNS de la EC2 y el host de API Gateway, `CORS_ALLOWED_ORIGINS`, `USE_S3`, bucket, `MOSTRAR_CREDENCIALES_DEMO=False`).
6. `migrate`, `collectstatic` (sube a S3 si `USE_S3=True`), `cargar_roles` y `cargar_demo`.
7. Instala Gunicorn (`buildcorp.service`), Nginx con el secreto y el cron.
8. Opcional (`AUTODESPLIEGUE=1`): activa el timer `buildcorp-actualizar` (despliega desde `origin/main`).
9. Comprueba que `/api/v1/` responda **403** sin la cabecera y 401/200 con ella.

## Comprobaciones (evidencias)

```bash
curl -I http://localhost/api/v1/                                         # 403: falta X-Origin-Verify
curl -I -H "X-Origin-Verify: <ORIGIN_SECRET>" http://localhost/api/v1/   # 401: falta token
curl -I http://<IP_BACKEND>/api/v1/                                      # 403 desde fuera (no se salta API Gateway)
sudo -u ubuntu bash -c 'cd ~/BuildCorp && .venv/bin/python manage.py dbshell -- -c "SELECT ssl, version FROM pg_stat_ssl WHERE pid = pg_backend_pid();"'
ls -l /home/ubuntu/BuildCorp/.env                                         # -rw------- ubuntu
```

## Django Admin

`/admin/` también exige la cabecera, salvo que se entre desde la propia EC2. Para usarlo desde tu PC, abre un túnel SSH y entra a `http://localhost:8080/admin/`:

```bash
ssh -i buildcorp-key.pem -L 8080:localhost:80 ubuntu@<IP_BACKEND>
```

## Notas

- El secreto queda en `/etc/nginx/sites-available/buildcorp-backend` (640, root) y en `/etc/buildcorp/backend.conf` (600, root); Nginx lo borra antes de pasar la petición a Django.
- Las variables `USE_S3`, `AWS_STORAGE_BUCKET_NAME`, `AWS_S3_REGION_NAME` y `CORS_ALLOWED_ORIGINS` las lee la configuración de la tarea T1. Si se corre antes de que T1 esté en el repositorio, Django las ignora y los archivos quedan locales.
- Los usuarios demo tienen la clave conocida `buildcorp2026`: cámbiala después de la presentación o usa `CARGAR_DEMO=0`.
- El autodespliegue usa `deploy/actualizar.sh`, que sigue la rama `main`.
- Logs: `journalctl -u buildcorp -f`, `/var/log/nginx/error.log`, `~/buildcorp-cron.log`.

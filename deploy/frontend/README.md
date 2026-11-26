# Despliegue de la EC2 frontend (Evaluación 4)

Nginx sirviendo el build de **Vite** (`frontend/dist/`) en una EC2 Ubuntu 24.04. El navegador habla con la API **solo a través de API Gateway** (`VITE_API_URL`), nunca con la IP de la EC2 backend.

## Archivos

| Archivo | Qué hace |
|---|---|
| `setup_frontend.sh` | Instala Nginx y Node 20, hace `npm ci && npm run build` con `VITE_API_URL` y copia `dist/` a `/var/www/buildcorp` |
| `nginx_frontend.conf` | Plantilla de Nginx: `try_files` para el SPA, caché larga de `/assets/`, `server_tokens off` y cabeceras de seguridad con CSP |
| `actualizar_ips.sh` | Para cuando AWS Academy cambie las IP (sirve en las dos EC2; detecta cuál es) |

## Antes de empezar

1. EC2 lanzada con `sg-frontend` (80 abierto, 22 solo desde tu IP). No necesita perfil IAM.
2. API Gateway ya creado: necesitas su **Invoke URL** (`https://xxxx.execute-api.us-east-1.amazonaws.com`).
3. El proyecto Vite (`frontend/`, tarea T3) subido al repositorio, idealmente con `package-lock.json`.

## Orden de ejecución

```bash
# 1. Conectarse y clonar
ssh -i buildcorp-key.pem ubuntu@<IP_FRONTEND>
git clone <URL_DEL_REPO> /home/ubuntu/BuildCorp && cd /home/ubuntu/BuildCorp
git checkout eva4            # si se trabaja en esa rama

# 2. Construir y publicar (la URL termina en /api/v1)
sudo bash deploy/frontend/setup_frontend.sh https://xxxx.execute-api.us-east-1.amazonaws.com/api/v1
#    segundo parámetro opcional: región del bucket S3 para la CSP de imágenes (por defecto us-east-1)

# 3. En la EC2 BACKEND, autorizar el origen del frontend (CORS)
sudo bash deploy/frontend/actualizar_ips.sh --frontend http://<IP_FRONTEND>
```

En una t2.micro (1 GB de RAM) el script crea un swap de 1 GB para que el build de Vite no se quede sin memoria.

## Content-Security-Policy

```
default-src 'self'; script-src 'self';
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com;
img-src 'self' data: blob: https://*.s3.amazonaws.com https://*.s3.<región>.amazonaws.com;
connect-src 'self' https://xxxx.execute-api.us-east-1.amazonaws.com;
object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
```

`connect-src` limita `fetch` a la página y a API Gateway; si alguien inyecta un script, no puede enviar datos a otro servidor. `'unsafe-inline'` solo está en `style-src` por los atributos `style` de React; los scripts no lo tienen. Las fuentes de Google se permiten porque `DESIGN.md` usa la tipografía Archivo.

Comprobar: `curl -I http://<IP_FRONTEND>/` debe mostrar las cabeceras y **no** la versión de Nginx (`Server: nginx`).

## Cuando AWS Academy cambie las IP

Si no usas Elastic IP, al volver a iniciar el laboratorio:

```bash
# EC2 backend: toma su IP/DNS nuevos de los metadatos y actualiza .env (ALLOWED_HOSTS, CSRF, CORS)
sudo bash deploy/frontend/actualizar_ips.sh --frontend http://<IP_NUEVA_FRONTEND>
# EC2 frontend: no hace falta reconstruir (la URL de API Gateway no cambia). Solo si cambió:
sudo bash deploy/frontend/actualizar_ips.sh --api-url https://yyyy.execute-api.us-east-1.amazonaws.com/api/v1
```

Y en la consola: API Gateway → Integrations → cambiar la URL a `http://<DNS_NUEVO_BACKEND>/api/{proxy}` (el script del backend la imprime).

## Despliegue automático (push a `main`)

`/home/ubuntu/BuildCorp` es un clon de GitHub (llave de despliegue de solo lectura en `~/.ssh/buildcorp_deploy`).
El timer `buildcorp-actualizar-front.timer` revisa `origin/main` cada 2 minutos y, si cambió algo en `frontend/`,
ejecuta `deploy/frontend/actualizar_frontend.sh`: `npm ci` (si cambió el lock), build con la `VITE_API_URL` de
`/etc/buildcorp/frontend.conf` y `rsync` a `/var/www/buildcorp`. No toca Nginx ni el certificado HTTPS.

```bash
sudo cp deploy/frontend/buildcorp-actualizar-front.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now buildcorp-actualizar-front.timer
sudo bash deploy/frontend/actualizar_frontend.sh --forzar   # reconstruir a mano
tail -f /home/ubuntu/buildcorp-deploy.log
```

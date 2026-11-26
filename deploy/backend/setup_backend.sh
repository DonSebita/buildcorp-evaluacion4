#!/usr/bin/env bash
# Instalación de la EC2 BACKEND de BuildCorp (Evaluación 4): Nginx + Gunicorn + Django REST
# Framework conectado a RDS PostgreSQL y S3. NO instala PostgreSQL local.
#
# Uso (desde el repositorio ya clonado en /home/ubuntu/BuildCorp):
#   cp deploy/backend/parametros.env.example ~/buildcorp-backend.env   # completar y chmod 600
#   sudo bash deploy/backend/setup_backend.sh ~/buildcorp-backend.env
# También acepta las variables por entorno; lo que falte lo pregunta (claves sin eco).
# Se puede volver a correr: no borra datos, conserva la SECRET_KEY y actualiza el resto.
set -euo pipefail

APP_DIR="/home/ubuntu/BuildCorp"
USUARIO="ubuntu"
CONF_DIR="/etc/buildcorp"
RDS_BUNDLE="/etc/ssl/certs/rds-global-bundle.pem"
RDS_BUNDLE_URL="https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem"
DIR_SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

[[ "$(id -u)" -eq 0 ]] || { echo "Ejecuta con sudo: sudo bash $0 [archivo_parametros]"; exit 1; }
[[ -f "$APP_DIR/manage.py" ]] || { echo "No encuentro $APP_DIR/manage.py: clona el repositorio en $APP_DIR"; exit 1; }

# ---------------------------------------------------------------------------
# 1. Parámetros
# ---------------------------------------------------------------------------
if [[ $# -ge 1 ]]; then
  [[ -f "$1" ]] || { echo "No existe el archivo de parámetros $1"; exit 1; }
  set -a
  # shellcheck disable=SC1090
  source "$1"
  set +a
fi

preguntar() {  # preguntar VARIABLE "texto" [secreto]
  local var="$1" texto="$2" secreto="${3:-}" valor
  if [[ -z "${!var:-}" ]]; then
    if [[ -n "$secreto" ]]; then read -rsp "$texto: " valor; echo; else read -rp "$texto: " valor; fi
    printf -v "$var" '%s' "$valor"
  fi
  [[ -n "${!var}" ]] || { echo "Falta $var"; exit 1; }
}

DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-buildcorp}"
DB_SSLMODE="${DB_SSLMODE:-require}"
AWS_S3_REGION_NAME="${AWS_S3_REGION_NAME:-us-east-1}"
USE_S3="${USE_S3:-True}"
CARGAR_DEMO="${CARGAR_DEMO:-1}"
AUTODESPLIEGUE="${AUTODESPLIEGUE:-0}"
ZONA_HORARIA="${ZONA_HORARIA:-America/Santiago}"

if [[ -z "${DATABASE_URL:-}" ]]; then
  preguntar DB_HOST "Endpoint de RDS"
  preguntar DB_USER "Usuario de RDS"
  preguntar DB_PASSWORD "Clave de RDS" secreto
fi
if [[ "$USE_S3" = "True" ]]; then preguntar AWS_STORAGE_BUCKET_NAME "Nombre del bucket S3"; fi
preguntar FRONTEND_ORIGIN "Origen del frontend (p. ej. https://buildcorp.IP-CON-GUIONES.sslip.io)"
preguntar API_GATEWAY_HOST "Host de API Gateway (xxxx.execute-api.us-east-1.amazonaws.com)"
preguntar ORIGIN_SECRET "ORIGIN_SECRET (openssl rand -hex 24)" secreto

FRONTEND_ORIGIN="${FRONTEND_ORIGIN%/}"
API_GATEWAY_HOST="${API_GATEWAY_HOST#https://}"; API_GATEWAY_HOST="${API_GATEWAY_HOST%%/*}"
[[ "$FRONTEND_ORIGIN" =~ ^https?://[^/]+$ ]] || { echo "FRONTEND_ORIGIN debe ser http(s)://host, sin ruta"; exit 1; }
# El secreto va dentro de la configuración de Nginx: solo caracteres seguros y largo mínimo
[[ "$ORIGIN_SECRET" =~ ^[A-Za-z0-9_-]{24,}$ ]] || { echo "ORIGIN_SECRET debe tener ≥ 24 caracteres [A-Za-z0-9_-] (usa openssl rand -hex 24)"; exit 1; }
[[ "$DB_SSLMODE" =~ ^(require|verify-ca|verify-full)$ ]] || { echo "DB_SSLMODE debe ser require, verify-ca o verify-full"; exit 1; }

# IP y DNS públicos de esta EC2 (IMDSv2), para ALLOWED_HOSTS y para la integración de API Gateway
imds() {
  local token
  token=$(curl -sf -m 2 -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 60") || return 0
  curl -sf -m 2 -H "X-aws-ec2-metadata-token: $token" "http://169.254.169.254/latest/meta-data/$1" || true
}
IP_PUBLICA="${IP_PUBLICA:-$(imds public-ipv4)}"
DNS_PUBLICO="${DNS_PUBLICO:-$(imds public-hostname)}"
[[ -n "$IP_PUBLICA" ]] || preguntar IP_PUBLICA "IP pública de esta EC2 (no se pudo leer de los metadatos)"

# ---------------------------------------------------------------------------
# 2. Paquetes del sistema (sin servidor PostgreSQL: solo el cliente psql para probar RDS)
# ---------------------------------------------------------------------------
echo "==> Paquetes del sistema"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y python3-venv python3-pip python3-dev nginx git curl openssl postgresql-client
timedatectl set-timezone "$ZONA_HORARIA" || true

echo "==> Bundle TLS de RDS ($RDS_BUNDLE)"
curl --proto "=https" --tlsv1.2 -fsSL "$RDS_BUNDLE_URL" -o "$RDS_BUNDLE.tmp"
grep -q "BEGIN CERTIFICATE" "$RDS_BUNDLE.tmp" || { echo "El bundle descargado no es un certificado"; exit 1; }
mv "$RDS_BUNDLE.tmp" "$RDS_BUNDLE"; chmod 644 "$RDS_BUNDLE"

# ---------------------------------------------------------------------------
# 3. DATABASE_URL hacia RDS con TLS
# ---------------------------------------------------------------------------
if [[ -z "${DATABASE_URL:-}" ]]; then
  CLAVE_URL=$(python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=""))' "$DB_PASSWORD")
  USUARIO_URL=$(python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=""))' "$DB_USER")
  DATABASE_URL="postgres://${USUARIO_URL}:${CLAVE_URL}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
fi
if [[ "$DATABASE_URL" != *sslmode=* ]]; then
  SEP='?'; [[ "$DATABASE_URL" == *\?* ]] && SEP='&'
  DATABASE_URL="${DATABASE_URL}${SEP}sslmode=${DB_SSLMODE}"
  if [[ "$DB_SSLMODE" != "require" ]]; then DATABASE_URL="${DATABASE_URL}&sslrootcert=${RDS_BUNDLE}"; fi
fi

echo "==> Probando conexión TLS a RDS"
if ! psql "$DATABASE_URL" -tAc "SELECT 'ssl=' || ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid();"; then
  echo "No se pudo conectar a RDS. Revisa: endpoint, usuario/clave, que exista la base '${DB_NAME}'"
  echo "y que sg-rds permita 5432 desde sg-backend."
  exit 1
fi

# ---------------------------------------------------------------------------
# 4. Entorno virtual y dependencias
# ---------------------------------------------------------------------------
echo "==> Entorno virtual y dependencias"
[[ -d "$APP_DIR/.venv" ]] || sudo -u "$USUARIO" python3 -m venv "$APP_DIR/.venv"
sudo -u "$USUARIO" "$APP_DIR/.venv/bin/pip" install -q --upgrade pip
sudo -u "$USUARIO" "$APP_DIR/.venv/bin/pip" install -q -r "$APP_DIR/requirements.txt"

# ---------------------------------------------------------------------------
# 5. .env de producción (permiso 600). Conserva SECRET_KEY si ya existe.
# ---------------------------------------------------------------------------
echo "==> Escribiendo $APP_DIR/.env"
ENV_FILE="$APP_DIR/.env"
touch "$ENV_FILE"; chown "$USUARIO":"$USUARIO" "$ENV_FILE"; chmod 600 "$ENV_FILE"

set_env() {  # set_env CLAVE valor  → reemplaza o agrega la línea CLAVE=valor
  local clave="$1" valor="$2" tmp
  tmp=$(mktemp)
  grep -v "^${clave}=" "$ENV_FILE" > "$tmp" || true
  printf '%s=%s\n' "$clave" "$valor" >> "$tmp"
  cat "$tmp" > "$ENV_FILE"; rm -f "$tmp"
}

grep -q '^SECRET_KEY=' "$ENV_FILE" || set_env SECRET_KEY "$(openssl rand -hex 32)"
HOSTS="${IP_PUBLICA},${API_GATEWAY_HOST},localhost,127.0.0.1"
[[ -n "$DNS_PUBLICO" ]] && HOSTS="${DNS_PUBLICO},${HOSTS}"
CSRF="https://${API_GATEWAY_HOST},http://${IP_PUBLICA},${FRONTEND_ORIGIN}"
[[ -n "$DNS_PUBLICO" ]] && CSRF="${CSRF},http://${DNS_PUBLICO}"

set_env DEBUG False
set_env DATABASE_URL "$DATABASE_URL"
set_env ALLOWED_HOSTS "$HOSTS"
set_env CSRF_TRUSTED_ORIGINS "$CSRF"
set_env CORS_ALLOWED_ORIGINS "$FRONTEND_ORIGIN"
set_env USE_S3 "$USE_S3"
set_env AWS_STORAGE_BUCKET_NAME "${AWS_STORAGE_BUCKET_NAME:-}"
set_env AWS_S3_REGION_NAME "$AWS_S3_REGION_NAME"
set_env MOSTRAR_CREDENCIALES_DEMO False
set_env SITE_URL "http://${IP_PUBLICA}"

# Parámetros que necesita actualizar_ips.sh (solo root)
install -d -m 700 "$CONF_DIR"
umask 077
cat > "$CONF_DIR/backend.conf" <<EOF
ROL=backend
ORIGIN_SECRET=${ORIGIN_SECRET}
API_GATEWAY_HOST=${API_GATEWAY_HOST}
FRONTEND_ORIGIN=${FRONTEND_ORIGIN}
EOF
umask 022

# ---------------------------------------------------------------------------
# 6. Migraciones, estáticos y datos
# ---------------------------------------------------------------------------
echo "==> Migraciones, estáticos y datos"
cd "$APP_DIR"
como_app() { sudo -u "$USUARIO" -H env DJANGO_SETTINGS_MODULE=buildcorp.settings.prod "$@"; }
como_app .venv/bin/python manage.py check --deploy || true   # solo informa
como_app .venv/bin/python manage.py migrate --noinput
como_app .venv/bin/python manage.py collectstatic --noinput   # con USE_S3=True sube a S3
como_app .venv/bin/python manage.py cargar_roles
if [[ "$CARGAR_DEMO" = "1" ]]; then como_app .venv/bin/python manage.py cargar_demo || true; fi
mkdir -p "$APP_DIR/media" && chown -R "$USUARIO":www-data "$APP_DIR/media" && chmod -R 775 "$APP_DIR/media"
chmod 755 /home/ubuntu

# ---------------------------------------------------------------------------
# 7. Gunicorn (systemd). Mismo nombre de unidad que antes: buildcorp.service
# ---------------------------------------------------------------------------
echo "==> Gunicorn (systemd)"
cp "$DIR_SCRIPT/gunicorn.service" /etc/systemd/system/buildcorp.service
systemctl daemon-reload
systemctl enable buildcorp
systemctl restart buildcorp

# ---------------------------------------------------------------------------
# 8. Nginx con la regla de la cabecera secreta
# ---------------------------------------------------------------------------
echo "==> Nginx"
DESTINO=/etc/nginx/sites-available/buildcorp-backend
sed "s/__ORIGIN_SECRET__/${ORIGIN_SECRET}/g" "$DIR_SCRIPT/nginx_backend.conf" > "$DESTINO"
chown root:root "$DESTINO"; chmod 640 "$DESTINO"
ln -sf "$DESTINO" /etc/nginx/sites-enabled/buildcorp-backend
rm -f /etc/nginx/sites-enabled/default /etc/nginx/sites-enabled/buildcorp
nginx -t && systemctl reload nginx

# ---------------------------------------------------------------------------
# 9. Cron (morosidad y mantenciones) y autodespliegue opcional
# ---------------------------------------------------------------------------
echo "==> Cron"
crontab -u "$USUARIO" "$DIR_SCRIPT/crontab.txt"

if [[ "$AUTODESPLIEGUE" = "1" ]]; then
  echo "==> Autodespliegue desde origin/main cada 2 minutos"
  cp "$APP_DIR/deploy/buildcorp-actualizar.service" "$APP_DIR/deploy/buildcorp-actualizar.timer" /etc/systemd/system/
  systemctl daemon-reload
  systemctl enable --now buildcorp-actualizar.timer
fi

# ---------------------------------------------------------------------------
# 10. Comprobación
# ---------------------------------------------------------------------------
sleep 2
SIN=$(curl -s -o /dev/null -w '%{http_code}' http://localhost/api/v1/ || true)
CON=$(curl -s -o /dev/null -w '%{http_code}' -H "X-Origin-Verify: ${ORIGIN_SECRET}" http://localhost/api/v1/ || true)
echo
echo "Comprobación: /api/v1/ sin cabecera -> ${SIN} (esperado 403) · con cabecera -> ${CON} (esperado 401 o 200)"
echo
echo "Listo. Datos para la consola de AWS:"
echo "  Integración de API Gateway: http://${DNS_PUBLICO:-$IP_PUBLICA}/api/{proxy}"
echo "  Parameter mapping:          append header.X-Origin-Verify = (tu ORIGIN_SECRET)"
echo "  Logs: journalctl -u buildcorp -f   ·   /var/log/nginx/error.log"

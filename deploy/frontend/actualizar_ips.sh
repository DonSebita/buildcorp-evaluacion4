#!/usr/bin/env bash
# Actualiza la configuración cuando AWS Academy cambia las IP públicas al reiniciar el laboratorio
# (no hace falta si usaste Elastic IP). Detecta solo en qué EC2 corre.
#
# En la EC2 BACKEND:
#   sudo bash deploy/frontend/actualizar_ips.sh [--frontend http://NUEVA_IP_FRONTEND] [--api-host xxxx.execute-api.us-east-1.amazonaws.com]
#   → actualiza ALLOWED_HOSTS, CSRF_TRUSTED_ORIGINS, CORS_ALLOWED_ORIGINS y SITE_URL del .env
#     con la IP/DNS nuevos de esta EC2 y reinicia Gunicorn.
#
# En la EC2 FRONTEND:
#   sudo bash deploy/frontend/actualizar_ips.sh [--api-url https://xxxx.execute-api.us-east-1.amazonaws.com/api/v1]
#   → muestra la IP nueva; si cambió la URL de API Gateway, reconstruye el frontend.
set -euo pipefail

APP_DIR="/home/ubuntu/BuildCorp"
CONF_DIR="/etc/buildcorp"
DIR_SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

[ "$(id -u)" -eq 0 ] || { echo "Ejecuta con sudo"; exit 1; }

NUEVO_FRONTEND="" NUEVO_API_HOST="" NUEVA_API_URL=""
while [ $# -gt 0 ]; do
  case "$1" in
    --frontend) NUEVO_FRONTEND="${2:?falta valor}"; shift 2 ;;
    --api-host) NUEVO_API_HOST="${2:?falta valor}"; shift 2 ;;
    --api-url)  NUEVA_API_URL="${2:?falta valor}"; shift 2 ;;
    -h|--help)  sed -n '2,14p' "$0"; exit 0 ;;
    *) echo "Opción desconocida: $1"; exit 1 ;;
  esac
done

imds() {
  local token
  token=$(curl -sf -m 2 -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 60") || return 0
  curl -sf -m 2 -H "X-aws-ec2-metadata-token: $token" "http://169.254.169.254/latest/meta-data/$1" || true
}
IP_PUBLICA=$(imds public-ipv4)
DNS_PUBLICO=$(imds public-hostname)
[ -n "$IP_PUBLICA" ] || { echo "No pude leer la IP pública de los metadatos de la EC2"; exit 1; }

if [ -f "$CONF_DIR/backend.conf" ]; then
  # ------------------------------- BACKEND -------------------------------
  # shellcheck disable=SC1091
  source "$CONF_DIR/backend.conf"
  [ -n "$NUEVO_FRONTEND" ] && FRONTEND_ORIGIN="${NUEVO_FRONTEND%/}"
  if [ -n "$NUEVO_API_HOST" ]; then
    API_GATEWAY_HOST="${NUEVO_API_HOST#https://}"; API_GATEWAY_HOST="${API_GATEWAY_HOST%%/*}"
  fi
  [[ "$FRONTEND_ORIGIN" =~ ^https?://[^/]+$ ]] || { echo "Origen de frontend inválido: $FRONTEND_ORIGIN"; exit 1; }

  ENV_FILE="$APP_DIR/.env"
  [ -f "$ENV_FILE" ] || { echo "No existe $ENV_FILE: corre primero deploy/backend/setup_backend.sh"; exit 1; }
  set_env() {
    local clave="$1" valor="$2" tmp
    tmp=$(mktemp)
    grep -v "^${clave}=" "$ENV_FILE" > "$tmp" || true
    printf '%s=%s\n' "$clave" "$valor" >> "$tmp"
    cat "$tmp" > "$ENV_FILE"; rm -f "$tmp"
  }
  HOSTS="${IP_PUBLICA},${API_GATEWAY_HOST},localhost,127.0.0.1"
  [ -n "$DNS_PUBLICO" ] && HOSTS="${DNS_PUBLICO},${HOSTS}"
  CSRF="https://${API_GATEWAY_HOST},http://${IP_PUBLICA},${FRONTEND_ORIGIN}"
  [ -n "$DNS_PUBLICO" ] && CSRF="${CSRF},http://${DNS_PUBLICO}"
  set_env ALLOWED_HOSTS "$HOSTS"
  set_env CSRF_TRUSTED_ORIGINS "$CSRF"
  set_env CORS_ALLOWED_ORIGINS "$FRONTEND_ORIGIN"
  set_env SITE_URL "http://${IP_PUBLICA}"

  umask 077
  cat > "$CONF_DIR/backend.conf" <<EOF
ROL=backend
ORIGIN_SECRET=${ORIGIN_SECRET}
API_GATEWAY_HOST=${API_GATEWAY_HOST}
FRONTEND_ORIGIN=${FRONTEND_ORIGIN}
EOF
  systemctl restart buildcorp
  echo "Backend actualizado: IP ${IP_PUBLICA} · CORS ${FRONTEND_ORIGIN} · API Gateway ${API_GATEWAY_HOST}"
  echo "Pendiente en la consola: API Gateway → Integrations → cambiar la URL a"
  echo "  http://${DNS_PUBLICO:-$IP_PUBLICA}/api/{proxy}"

elif [ -f "$CONF_DIR/frontend.conf" ]; then
  # ------------------------------- FRONTEND ------------------------------
  # shellcheck disable=SC1091
  source "$CONF_DIR/frontend.conf"
  if [ -n "$NUEVA_API_URL" ] && [ "${NUEVA_API_URL%/}" != "$VITE_API_URL" ]; then
    echo "La URL de API Gateway cambió: reconstruyendo el frontend"
    bash "$DIR_SCRIPT/setup_frontend.sh" "$NUEVA_API_URL" "${S3_REGION:-us-east-1}"
  else
    echo "El frontend no depende de su propia IP (Nginx usa server_name _): no hay que reconstruir."
  fi
  echo "IP nueva del frontend: http://${IP_PUBLICA}/"
  echo "Pendiente en la EC2 backend:"
  echo "  sudo bash deploy/frontend/actualizar_ips.sh --frontend http://${IP_PUBLICA}"
else
  echo "Esta EC2 no tiene $CONF_DIR/backend.conf ni frontend.conf: corre antes setup_backend.sh o setup_frontend.sh"
  exit 1
fi

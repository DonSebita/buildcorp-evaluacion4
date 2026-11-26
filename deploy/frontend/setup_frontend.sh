#!/usr/bin/env bash
# Instalación de la EC2 FRONTEND de BuildCorp (Evaluación 4): Nginx sirviendo el build de Vite.
#
# Uso (desde el repositorio ya clonado en /home/ubuntu/BuildCorp):
#   sudo bash deploy/frontend/setup_frontend.sh https://abc123.execute-api.us-east-1.amazonaws.com/api/v1
# El parámetro es VITE_API_URL: la URL de API Gateway (nunca la IP de la EC2 backend).
# Se puede volver a correr para reconstruir (p. ej. si cambia la URL de API Gateway).
set -euo pipefail

APP_DIR="/home/ubuntu/BuildCorp"
FRONT_DIR="$APP_DIR/frontend"
WEB_DIR="/var/www/buildcorp"
USUARIO="ubuntu"
CONF_DIR="/etc/buildcorp"
NODE_MAYOR=20
DIR_SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

[ "$(id -u)" -eq 0 ] || { echo "Ejecuta con sudo: sudo bash $0 <VITE_API_URL>"; exit 1; }
VITE_API_URL="${1:?Indica VITE_API_URL, p. ej. https://xxxx.execute-api.us-east-1.amazonaws.com/api/v1}"
S3_REGION="${2:-us-east-1}"
VITE_API_URL="${VITE_API_URL%/}"
[[ "$VITE_API_URL" =~ ^https?://[^/]+(/.*)?$ ]] || { echo "VITE_API_URL debe empezar con https://"; exit 1; }
[[ "$VITE_API_URL" == https://* ]] || echo "AVISO: VITE_API_URL no usa https; API Gateway siempre entrega https://"
[[ "$S3_REGION" =~ ^[a-z0-9-]+$ ]] || { echo "Región inválida: $S3_REGION"; exit 1; }
# Origen (esquema + host) para la CSP: connect-src solo admite ese origen
API_ORIGIN=$(echo "$VITE_API_URL" | sed -E 's#^(https?://[^/]+).*#\1#')

[ -f "$FRONT_DIR/package.json" ] || { echo "No encuentro $FRONT_DIR/package.json: falta el proyecto Vite en el repositorio"; exit 1; }

echo "==> Paquetes del sistema"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y nginx curl git ca-certificates rsync

echo "==> Node.js ${NODE_MAYOR}"
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt "$NODE_MAYOR" ]; then
  TMP_NODE=$(mktemp)
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAYOR}.x" -o "$TMP_NODE"
  bash "$TMP_NODE"; rm -f "$TMP_NODE"
  apt-get install -y nodejs
fi
echo "node $(node -v) · npm $(npm -v)"

# Una t2.micro tiene 1 GB de RAM y el build de Vite puede quedarse sin memoria: swap de 1 GB
MEM_MB=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
if [ "$MEM_MB" -lt 1800 ] && ! swapon --show | grep -q /swapfile; then
  echo "==> Creando swap de 1 GB (RAM: ${MEM_MB} MB)"
  fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "==> Build de Vite con VITE_API_URL=${VITE_API_URL}"
cd "$FRONT_DIR"
if [ -f package-lock.json ]; then
  sudo -u "$USUARIO" -H npm ci --no-audit --no-fund
else
  echo "AVISO: no hay package-lock.json, se usa npm install (conviene subir el lock al repositorio)"
  sudo -u "$USUARIO" -H npm install --no-audit --no-fund
fi
sudo -u "$USUARIO" -H env VITE_API_URL="$VITE_API_URL" npm run build
[ -f dist/index.html ] || { echo "El build no generó dist/index.html"; exit 1; }

echo "==> Publicando dist/ en ${WEB_DIR}"
mkdir -p "$WEB_DIR"
rsync -a --delete dist/ "$WEB_DIR"/
chown -R root:www-data "$WEB_DIR"
find "$WEB_DIR" -type d -exec chmod 755 {} +
find "$WEB_DIR" -type f -exec chmod 644 {} +

echo "==> Nginx"
DESTINO=/etc/nginx/sites-available/buildcorp-frontend
sed -e "s#__API_ORIGIN__#${API_ORIGIN}#" -e "s#__S3_REGION__#${S3_REGION}#" "$DIR_SCRIPT/nginx_frontend.conf" > "$DESTINO"
ln -sf "$DESTINO" /etc/nginx/sites-enabled/buildcorp-frontend
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx
systemctl reload nginx || systemctl restart nginx

# Guardar la URL para actualizar_ips.sh
install -d -m 755 "$CONF_DIR"
cat > "$CONF_DIR/frontend.conf" <<EOF
ROL=frontend
VITE_API_URL=${VITE_API_URL}
S3_REGION=${S3_REGION}
EOF

# IP pública (IMDSv2) para el mensaje final
TOKEN=$(curl -sf -m 2 -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 60" || true)
IP=$(curl -sf -m 2 -H "X-aws-ec2-metadata-token: ${TOKEN}" http://169.254.169.254/latest/meta-data/public-ipv4 || echo "<IP_FRONTEND>")

echo
echo "Listo: http://${IP}/"
echo "En la EC2 backend, CORS_ALLOWED_ORIGINS debe ser http://${IP}"
echo "  (sudo bash deploy/frontend/actualizar_ips.sh --frontend http://${IP})"

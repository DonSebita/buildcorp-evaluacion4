#!/usr/bin/env bash
# Despliegue automático del FRONTEND de BuildCorp: si hay commits nuevos en origin/main,
# actualiza el código, reconstruye Vite (con la VITE_API_URL guardada en /etc/buildcorp/frontend.conf)
# y publica dist/ en /var/www/buildcorp. No toca la configuración de Nginx (HTTPS de certbot incluido).
# Lo ejecuta como root el timer buildcorp-actualizar-front.timer cada 2 minutos.
# A mano:  sudo bash deploy/frontend/actualizar_frontend.sh   (--forzar reconstruye aunque no haya cambios)
set -euo pipefail

APP_DIR="/home/ubuntu/BuildCorp"
FRONT_DIR="$APP_DIR/frontend"
WEB_DIR="/var/www/buildcorp"
USUARIO="ubuntu"
RAMA="main"
LOG="/home/ubuntu/buildcorp-deploy.log"
CONF="/etc/buildcorp/frontend.conf"

exec 9>/run/buildcorp-actualizar-front.lock
flock -n 9 || exit 0

cd "$APP_DIR"
como_app() { sudo -u "$USUARIO" -H "$@"; }
log() { echo "$(date '+%F %T') [front] $*" | tee -a "$LOG"; }

[[ -f "$CONF" ]] || { log "ERROR: falta $CONF (corre antes setup_frontend.sh)"; exit 1; }
VITE_API_URL=$(grep '^VITE_API_URL=' "$CONF" | cut -d= -f2-)
[[ -n "$VITE_API_URL" ]] || { log "ERROR: $CONF no tiene VITE_API_URL"; exit 1; }

como_app git fetch -q origin "$RAMA"
ACTUAL=$(como_app git rev-parse HEAD)
NUEVO=$(como_app git rev-parse "origin/$RAMA")
[[ "$ACTUAL" = "$NUEVO" ]] && [[ "${1:-}" != "--forzar" ]] && exit 0

trap 'log "ERROR: el despliegue de ${NUEVO:0:7} falló (revisa journalctl -u buildcorp-actualizar-front)"' ERR

CAMBIADOS=$(como_app git diff --name-only "$ACTUAL" "$NUEVO")
como_app git merge -q --ff-only "origin/$RAMA"

# Solo reconstruir si cambió algo del frontend
if [[ "${1:-}" != "--forzar" ]] && ! grep -q '^frontend/' <<<"$CAMBIADOS"; then
  log "${NUEVO:0:7}: sin cambios en frontend/, no se reconstruye"
  exit 0
fi

log "Desplegando ${ACTUAL:0:7} -> ${NUEVO:0:7}: $(como_app git log -1 --format=%s "$NUEVO")"
cd "$FRONT_DIR"
if [[ ! -d node_modules ]] || grep -qE '^frontend/package(-lock)?\.json$' <<<"$CAMBIADOS"; then
  como_app npm ci --no-audit --no-fund
fi
como_app env VITE_API_URL="$VITE_API_URL" npm run build
[[ -f dist/index.html ]] || { log "ERROR: el build no generó dist/index.html"; exit 1; }

rsync -a --delete dist/ "$WEB_DIR"/
chown -R root:www-data "$WEB_DIR"
find "$WEB_DIR" -type d -exec chmod 755 {} +
find "$WEB_DIR" -type f -exec chmod 644 {} +

log "OK: ${NUEVO:0:7} publicado en $WEB_DIR"

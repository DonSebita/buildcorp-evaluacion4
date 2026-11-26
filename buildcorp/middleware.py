"""Cabeceras de seguridad para las respuestas de la API (hallazgos OWASP ZAP).

Va primero en MIDDLEWARE (antes de CorsMiddleware) para cubrir también las respuestas
que CorsMiddleware corta temprano, como el preflight OPTIONS de /api/v1/auth/token/,
que ZAP reportó sin Content-Security-Policy.

Solo toca rutas /api/: la interfaz Django Templates y el Admin quedan igual.
"""

# La API solo entrega JSON: no necesita cargar nada, ni ser enmarcada.
CSP_API = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"

# Swagger UI (/api/docs/): vista "split" sin scripts inline; los assets vienen de jsdelivr.
CSP_DOCS = (
    "default-src 'none'; script-src 'self' https://cdn.jsdelivr.net; "
    "style-src 'self' https://cdn.jsdelivr.net; img-src 'self' data: https://cdn.jsdelivr.net; "
    "connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
)

# Los clientes llegan a la API solo por API Gateway, que siempre es HTTPS.
HSTS = "max-age=31536000; includeSubDomains"


class CabecerasSeguridadAPI:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if not request.path.startswith("/api/"):
            return response
        csp = CSP_DOCS if request.path.startswith("/api/docs/") else CSP_API
        response.headers.setdefault("Content-Security-Policy", csp)
        response.headers.setdefault("Strict-Transport-Security", HSTS)
        # Las respuestas llevan tokens y datos internos: ningún caché (navegador ni proxy) las guarda.
        response.headers.setdefault("Cache-Control", "no-store")
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        return response

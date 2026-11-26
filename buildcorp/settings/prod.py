from .base import *  # noqa: F401,F403

DEBUG = False

# En producción la SECRET_KEY es obligatoria: sin ella Django no arranca
# (ImproperlyConfigured) en vez de usar la clave insegura de desarrollo.
SECRET_KEY = env("SECRET_KEY")  # noqa: F405
# Igual con la base de datos: sin DATABASE_URL en el .env, no arranca.
DATABASES = {"default": env.db("DATABASE_URL")}  # noqa: F405

# Nginx y API Gateway están delante de Gunicorn: se confía en sus cabeceras para
# saber si la petición original fue HTTPS y cuál era el host.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
USE_X_FORWARDED_HOST = True

# La EC2 de AWS Academy se publica por HTTP (puerto 80). Si se agrega HTTPS,
# cambiar estas variables a True en el .env.
SESSION_COOKIE_SECURE = env.bool("SESSION_COOKIE_SECURE", default=False)  # noqa: F405
CSRF_COOKIE_SECURE = env.bool("CSRF_COOKIE_SECURE", default=False)  # noqa: F405
SECURE_SSL_REDIRECT = env.bool("SECURE_SSL_REDIRECT", default=False)  # noqa: F405
SECURE_HSTS_SECONDS = env.int("SECURE_HSTS_SECONDS", default=0)  # noqa: F405
SESSION_COOKIE_HTTPONLY = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": "WARNING"},
}

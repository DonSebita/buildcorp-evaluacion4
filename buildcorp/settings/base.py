"""Configuración común a todos los entornos."""
from datetime import timedelta
from pathlib import Path

import environ
from django.core.management.utils import get_random_secret_key

BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env(DEBUG=(bool, False))
environ.Env.read_env(BASE_DIR / ".env")

# Sin valor por defecto en el código (hallazgo SonarQube). En desarrollo, si el .env
# no la define, se genera una aleatoria por proceso; settings.prod la exige.
SECRET_KEY = env("SECRET_KEY", default="") or get_random_secret_key()
DEBUG = env("DEBUG")
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])
CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS", default=[])
# Botón «?» en el login con las credenciales de la demo. Apagado por defecto:
# solo se enciende a mano en el .env para una prueba local.
MOSTRAR_CREDENCIALES_DEMO = env.bool("MOSTRAR_CREDENCIALES_DEMO", default=False)

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.humanize",
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "drf_spectacular",
    "storages",
    "django_filters",
    "apps.usuarios",
    "apps.activos",
    "apps.contratistas",
    "apps.prestamos",
    "apps.mantenimiento",
    "apps.alertas",
    "apps.dashboard",
]

MIDDLEWARE = [
    # CorsMiddleware va lo más arriba posible (antes de CommonMiddleware) para
    # responder también las peticiones OPTIONS (preflight) del frontend Vite.
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "buildcorp.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
                "apps.usuarios.context_processors.rol",
            ],
            "builtins": ["apps.usuarios.templatetags.buildcorp"],
        },
    },
]

WSGI_APPLICATION = "buildcorp.wsgi.application"

# DATABASE_URL admite parámetros extra en la query string, que django-environ
# pasa a OPTIONS. Para RDS con SSL obligatorio:
#   postgres://usuario:clave@host.rds.amazonaws.com:5432/buildcorp?sslmode=require
# Sin credenciales en el código (hallazgo SonarQube): DATABASE_URL va en el .env
# (ver .env.example). Sin ella, se usa PostgreSQL local con usuario y clave de
# PGUSER/PGPASSWORD del entorno.
DATABASES = {
    "default": env.db("DATABASE_URL", default="postgres://localhost:5432/buildcorp")
}

AUTH_USER_MODEL = "usuarios.Usuario"

# Argon2 primero: las contraseñas nuevas (y las antiguas al iniciar sesión) se
# guardan con Argon2. PBKDF2 queda después para verificar los hashes existentes.
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.Argon2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher",
]

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "es-cl"
TIME_ZONE = "America/Santiago"
USE_I18N = True
USE_TZ = True
USE_THOUSAND_SEPARATOR = True

STATIC_URL = "/static/"
STATICFILES_DIRS = [BASE_DIR / "static"]
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# --- Almacenamiento: local (como hasta ahora) o S3 ---------------------------
# Con USE_S3=True los archivos subidos y los estáticos van a un bucket privado.
# No se configuran llaves: boto3 toma las credenciales del rol de la EC2
# (LabInstanceProfile en AWS Academy). Las URL salen prefirmadas y caducan en 15 min.
USE_S3 = env.bool("USE_S3", default=False)

if USE_S3:
    _S3_OPCIONES = {
        "bucket_name": env("AWS_STORAGE_BUCKET_NAME"),
        "region_name": env("AWS_S3_REGION_NAME", default="us-east-1"),
        "querystring_auth": True,
        "querystring_expire": 900,
        "default_acl": None,
        "file_overwrite": False,
        # Firma v4: obligatoria para URL prefirmadas en buckets cifrados con KMS y regiones nuevas.
        "signature_version": "s3v4",
    }
    STORAGES = {
        "default": {
            "BACKEND": "storages.backends.s3.S3Storage",
            "OPTIONS": {**_S3_OPCIONES, "location": "media"},
        },
        "staticfiles": {
            "BACKEND": "storages.backends.s3.S3Storage",
            "OPTIONS": {**_S3_OPCIONES, "location": "static"},
        },
    }
else:
    STORAGES = {
        "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"
        },
    }

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

LOGIN_URL = "login"
LOGIN_REDIRECT_URL = "dashboard:inicio"
LOGOUT_REDIRECT_URL = "login"

# --- API REST ----------------------------------------------------------------
REST_FRAMEWORK = {
    # JWT primero (frontend Vite, Postman, ZAP); sesión después (plantillas Django,
    # API navegable y Admin siguen funcionando igual que antes).
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
        "apps.usuarios.permissions.PermisoPorRol",
    ],
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_PAGINATION_CLASS": "apps.usuarios.paginacion.Paginacion",
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "COERCE_DECIMAL_TO_STRING": False,
}

# Throttling de aplicación (opcional, defensa en profundidad). El límite principal
# lo pone API Gateway; este solo se activa si el .env define alguna tasa,
# por ejemplo DRF_THROTTLE_ANON=20/min y DRF_THROTTLE_USER=300/min.
_TASA_ANON = env("DRF_THROTTLE_ANON", default="")
_TASA_USER = env("DRF_THROTTLE_USER", default="")
if _TASA_ANON or _TASA_USER:
    REST_FRAMEWORK["DEFAULT_THROTTLE_CLASSES"] = []
    REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"] = {}
    if _TASA_ANON:
        REST_FRAMEWORK["DEFAULT_THROTTLE_CLASSES"].append(
            "rest_framework.throttling.AnonRateThrottle"
        )
        REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["anon"] = _TASA_ANON
    if _TASA_USER:
        REST_FRAMEWORK["DEFAULT_THROTTLE_CLASSES"].append(
            "rest_framework.throttling.UserRateThrottle"
        )
        REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["user"] = _TASA_USER

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=1),
    # Cada refresh entrega un refresh nuevo y el anterior queda en la lista negra.
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# CORS: solo el origen del frontend Vite (en AWS, la URL de la EC2 frontend).
CORS_ALLOWED_ORIGINS = env.list(
    "CORS_ALLOWED_ORIGINS", default=["http://localhost:5173"]
)
# El frontend lee Retry-After de las respuestas 429 (página Diagnóstico).
CORS_EXPOSE_HEADERS = ["Retry-After"]

SPECTACULAR_SETTINGS = {
    "TITLE": "BuildCorp API",
    "DESCRIPTION": (
        "API interna de BuildCorp: activos, contratistas, préstamos, mantenimiento "
        "y alertas. Autenticación con JWT (POST /api/v1/auth/token/) y permisos por rol."
    ),
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
}

# URL base que se imprime dentro de los QR. Si queda vacía se usa el host de la petición.
SITE_URL = env("SITE_URL", default="")

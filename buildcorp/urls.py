from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerSplitView

from apps.usuarios.api_urls import usuarios_urlpatterns

admin.site.site_header = "BuildCorp – Administración"
admin.site.site_title = "BuildCorp"
admin.site.index_title = "Panel de administración"

api_v1 = [
    path("auth/", include("apps.usuarios.api_urls")),
    path("", include(usuarios_urlpatterns)),
    path("", include("apps.activos.api_urls")),
    path("", include("apps.contratistas.api_urls")),
    path("", include("apps.prestamos.api_urls")),
    path("", include("apps.mantenimiento.api_urls")),
    path("", include("apps.alertas.api_urls")),
    path("", include("apps.dashboard.api_urls")),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include(api_v1)),
    # Documentación OpenAPI (drf-spectacular): esquema y Swagger UI.
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    # Vista "split": el JS de arranque va en un archivo aparte (sin script inline), compatible con la CSP.
    path("api/docs/", SpectacularSwaggerSplitView.as_view(url_name="schema"), name="swagger-ui"),
    path("", include("apps.usuarios.urls")),
    path("", include("apps.dashboard.urls")),
    path("activos/", include("apps.activos.urls")),
    path("contratistas/", include("apps.contratistas.urls")),
    path("prestamos/", include("apps.prestamos.urls")),
    path("mantenimiento/", include("apps.mantenimiento.urls")),
    path("alertas/", include("apps.alertas.urls")),
]

if settings.DEBUG and not settings.USE_S3:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

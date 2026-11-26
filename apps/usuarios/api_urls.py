from django.urls import path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .api import LoginView, LogoutView, MeView, UsuarioViewSet

urlpatterns = [
    path("token/", LoginView.as_view(), name="auth-token"),
    path("token/refresh/", TokenRefreshView.as_view(), name="auth-token-refresh"),
    path("logout/", LogoutView.as_view(), name="auth-logout"),
    path("me/", MeView.as_view(), name="auth-me"),
]

# Gestión de trabajadores: /api/v1/usuarios/ (se monta aparte, fuera de /auth/).
router = DefaultRouter()
router.register("usuarios", UsuarioViewSet, basename="usuario")
usuarios_urlpatterns = router.urls

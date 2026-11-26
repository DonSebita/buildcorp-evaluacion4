"""Endpoints de autenticación JWT: login, refresh, logout y usuario actual."""
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenBlacklistView, TokenObtainPairView

from .serializers import TokenConRolSerializer, UsuarioActualSerializer


class LoginView(TokenObtainPairView):
    """POST usuario y contraseña → {access, refresh}. El access incluye el claim 'rol'."""

    serializer_class = TokenConRolSerializer


class LogoutView(TokenBlacklistView):
    """POST {refresh} → el refresh queda en la lista negra y ya no sirve para renovar."""


class MeView(APIView):
    """Datos del usuario autenticado (para que el frontend arme el menú según rol)."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses=UsuarioActualSerializer)
    def get(self, request):
        return Response(UsuarioActualSerializer(request.user).data)

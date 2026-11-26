"""Endpoints de autenticación JWT y gestión de trabajadores (solo Administrador)."""
from django.db.models import Q
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.views import TokenBlacklistView, TokenObtainPairView

from .models import Usuario
from .roles import ADMIN, TODOS
from .serializers import (
    RestablecerClaveSerializer,
    TokenConRolSerializer,
    UsuarioActualSerializer,
    UsuarioSerializer,
)


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


def cerrar_sesiones(usuario):
    """Pone en la lista negra todos los refresh vigentes del usuario (lo saca de todas sus sesiones)."""
    for token in OutstandingToken.objects.filter(user=usuario):
        BlacklistedToken.objects.get_or_create(token=token)


class UsuarioViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """Trabajadores: solo el Administrador lista, crea, edita, asigna rol, activa/desactiva y
    restablece claves. No se borran (quedan en el historial de préstamos y firmas): se desactivan.

    Filtros: ?rol=Ventas · ?is_active=true|false · ?search=texto
    """

    queryset = Usuario.objects.prefetch_related("groups").order_by("-is_active", "first_name", "last_name", "username")
    serializer_class = UsuarioSerializer
    roles_lectura = ()  # () = solo Administrador
    roles_escritura = ()
    search_fields = ["username", "first_name", "last_name", "email", "rut", "cargo"]
    filterset_fields = ["is_active"]
    ordering_fields = ["username", "first_name", "last_name", "last_login", "date_joined"]

    def get_queryset(self):
        qs = super().get_queryset()
        rol = self.request.query_params.get("rol")
        if rol == ADMIN:
            qs = qs.filter(Q(is_superuser=True) | Q(groups__name=ADMIN)).distinct()
        elif rol in TODOS:
            qs = qs.filter(groups__name=rol, is_superuser=False).distinct()
        elif rol == "sin_rol":
            qs = qs.filter(is_superuser=False).exclude(groups__name__in=TODOS)
        return qs

    def perform_update(self, serializer):
        antes = serializer.instance.is_active
        usuario = serializer.save()
        if antes and not usuario.is_active:
            cerrar_sesiones(usuario)

    def _cambiar_activo(self, request, activo):
        usuario = self.get_object()
        if usuario.pk == request.user.pk and not activo:
            return Response({"detail": "No puedes desactivar tu propia cuenta."}, status=status.HTTP_400_BAD_REQUEST)
        if usuario.is_superuser and not request.user.is_superuser:
            return Response({"detail": "Solo un superusuario puede modificar a otro superusuario."}, status=status.HTTP_403_FORBIDDEN)
        usuario.is_active = activo
        usuario.save(update_fields=["is_active"])
        if not activo:
            cerrar_sesiones(usuario)
        return Response(self.get_serializer(usuario).data)

    @extend_schema(request=None, responses=UsuarioSerializer)
    @action(detail=True, methods=["post"])
    def desactivar(self, request, pk=None):
        """Bloquea el acceso del trabajador y cierra sus sesiones abiertas."""
        return self._cambiar_activo(request, False)

    @extend_schema(request=None, responses=UsuarioSerializer)
    @action(detail=True, methods=["post"])
    def activar(self, request, pk=None):
        return self._cambiar_activo(request, True)

    @extend_schema(request=RestablecerClaveSerializer, responses={204: None})
    @action(detail=True, methods=["post"], url_path="restablecer-clave")
    def restablecer_clave(self, request, pk=None):
        """Define una clave nueva (el Admin se la entrega al trabajador) y cierra sus sesiones."""
        usuario = self.get_object()
        if usuario.is_superuser and not request.user.is_superuser:
            return Response({"detail": "Solo un superusuario puede modificar a otro superusuario."}, status=status.HTTP_403_FORBIDDEN)
        datos = RestablecerClaveSerializer(data=request.data, context={"usuario": usuario})
        datos.is_valid(raise_exception=True)
        usuario.set_password(datos.validated_data["password"])
        usuario.save(update_fields=["password"])
        cerrar_sesiones(usuario)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(responses=serializers.ListSerializer(child=serializers.CharField()))
    @action(detail=False)
    def roles(self, request):
        """Roles disponibles para el selector del formulario."""
        return Response(list(TODOS))

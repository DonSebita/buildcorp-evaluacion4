from django.db.models import ProtectedError
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.activos.api import como_drf
from apps.usuarios.roles import VENTAS

from . import services
from .models import Contratista, Obra
from .serializers import ContratistaSerializer, ObraSerializer


class BorradoProtegidoMixin:
    """DELETE de un registro con préstamos asociados (on_delete=PROTECT): 409 con mensaje legible, no 500."""

    mensaje_protegido = "No se puede eliminar {obj}: tiene {n} préstamo(s) asociado(s)."

    def destroy(self, request, *args, **kwargs):
        obj = self.get_object()
        try:
            obj.delete()
        except ProtectedError as e:
            n = len(e.protected_objects)
            return Response(
                {"detail": self.mensaje_protegido.format(obj=obj, n=n)},
                status=status.HTTP_409_CONFLICT,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)


class ContratistaViewSet(BorradoProtegidoMixin, viewsets.ModelViewSet):
    queryset = Contratista.objects.prefetch_related("obras")
    serializer_class = ContratistaSerializer
    roles_escritura = (VENTAS,)
    roles_por_accion = {"desbloquear": (), "solicitar_desbloqueo": (VENTAS,)}
    filterset_fields = ["estado"]
    search_fields = ["rut", "razon_social", "contacto"]
    mensaje_protegido = (
        "No se puede eliminar {obj}: tiene {n} préstamo(s) en el historial. "
        "Si ya no trabaja con BuildCorp, déjalo sin obras activas en vez de borrarlo."
    )

    @action(detail=True, methods=["post"])
    def desbloquear(self, request, pk=None):
        c = self.get_object()
        como_drf(lambda: services.desbloquear(c, request.user, request.data.get("motivo", "")))
        return Response(self.get_serializer(c).data)

    @action(detail=True, methods=["post"], url_path="solicitar-desbloqueo")
    def solicitar_desbloqueo(self, request, pk=None):
        c = self.get_object()
        como_drf(lambda: services.solicitar_desbloqueo(c, request.user, request.data.get("motivo", "")))
        return Response({"detail": "Solicitud enviada al Administrador."})


class ObraViewSet(BorradoProtegidoMixin, viewsets.ModelViewSet):
    queryset = Obra.objects.select_related("contratista")
    serializer_class = ObraSerializer
    roles_escritura = (VENTAS,)
    filterset_fields = ["contratista", "activa"]
    search_fields = ["nombre", "responsable_nombre"]
    mensaje_protegido = (
        "No se puede eliminar la obra {obj}: tiene {n} préstamo(s) asociado(s). "
        "Márcala como inactiva en vez de borrarla."
    )

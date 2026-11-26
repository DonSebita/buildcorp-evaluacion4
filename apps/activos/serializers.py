from django.conf import settings
from rest_framework import serializers

from apps.activos import services

from .models import Activo, Bodega, CategoriaActivo, HistorialEstado, ItemPaquete, PaqueteMaquinaria, Traslado


class CategoriaSerializer(serializers.ModelSerializer):
    class Meta:
        model = CategoriaActivo
        fields = "__all__"
        read_only_fields = ["ultimo_correlativo"]

    def _tarifa_positiva(self, value):
        if value is None or value <= 0:
            raise serializers.ValidationError("La tarifa debe ser mayor que 0.")
        return value

    def validate_tarifa_diaria(self, value):
        return self._tarifa_positiva(value)

    def validate_tarifa_mensual(self, value):
        return self._tarifa_positiva(value)


class BodegaSerializer(serializers.ModelSerializer):
    tipo_display = serializers.CharField(source="get_tipo_display", read_only=True)

    class Meta:
        model = Bodega
        fields = ["id", "nombre", "tipo", "tipo_display", "direccion", "obra", "encargado"]


class ActivoSerializer(serializers.ModelSerializer):
    categoria_nombre = serializers.CharField(source="categoria.nombre", read_only=True)
    bodega_nombre = serializers.CharField(source="bodega_actual.nombre", read_only=True, default=None)
    estado_display = serializers.CharField(source="get_estado_display", read_only=True)
    mantencion = serializers.SerializerMethodField()
    url = serializers.CharField(source="get_absolute_url", read_only=True)
    foto_url = serializers.SerializerMethodField()

    class Meta:
        model = Activo
        fields = [
            "id", "codigo", "nombre", "categoria", "categoria_nombre", "marca", "modelo", "numero_serie",
            "fecha_adquisicion", "valor_compra", "estado", "estado_display", "bodega_actual", "bodega_nombre",
            "horas_uso_totales", "usos_totales", "usos_desde_mantencion", "activo", "mantencion", "url",
            "foto", "foto_url",
        ]
        read_only_fields = ["codigo", "estado", "horas_uso_totales", "usos_totales", "usos_desde_mantencion"]
        # La foto se sube en multipart (PATCH) y se lee por foto_url (prefirmada con S3).
        extra_kwargs = {"foto": {"write_only": True, "required": False, "allow_null": True}}

    FOTO_MAX_MB = 5

    def validate_foto(self, value):
        if value and value.size > self.FOTO_MAX_MB * 1024 * 1024:
            raise serializers.ValidationError(f"La foto no puede superar {self.FOTO_MAX_MB} MB.")
        return value

    def get_mantencion(self, obj):
        plan = getattr(obj, "plan", None)
        if plan is None:
            return None
        return {"situacion": plan.situacion, "criterio": plan.criterio}

    def get_foto_url(self, obj):
        """URL completa de la foto, o None si el activo no tiene.

        Con USE_S3=True el storage ya devuelve una URL prefirmada absoluta (caduca
        según AWS_QUERYSTRING_EXPIRE). En local devuelve /media/..., que se completa
        con el host de la petición para que el frontend Vite (otro origen) la pueda usar.
        """
        if not obj.foto:
            return None
        url = obj.foto.url
        request = self.context.get("request")
        if not getattr(settings, "USE_S3", False) and request is not None:
            url = request.build_absolute_uri(url)
        return url

    def create(self, validated_data):
        return services.crear_activo(self.context["request"].user, **validated_data)


class HistorialSerializer(serializers.ModelSerializer):
    usuario = serializers.StringRelatedField()

    class Meta:
        model = HistorialEstado
        fields = ["fecha", "estado_anterior", "estado_nuevo", "usuario", "motivo", "referencia"]


class TrasladoSerializer(serializers.ModelSerializer):
    activo_codigo = serializers.CharField(source="activo.codigo", read_only=True)
    bodega_origen = serializers.StringRelatedField()
    bodega_destino = serializers.StringRelatedField()
    usuario = serializers.StringRelatedField()

    class Meta:
        model = Traslado
        fields = ["fecha", "activo_codigo", "bodega_origen", "bodega_destino", "usuario", "observacion"]


class ItemPaqueteSerializer(serializers.ModelSerializer):
    categoria_nombre = serializers.CharField(source="categoria.nombre", read_only=True)

    class Meta:
        model = ItemPaquete
        fields = ["id", "categoria", "categoria_nombre", "cantidad"]


class PaqueteSerializer(serializers.ModelSerializer):
    items = ItemPaqueteSerializer(many=True)

    class Meta:
        model = PaqueteMaquinaria
        fields = ["id", "codigo", "nombre", "descripcion", "tarifa_diaria", "tarifa_mensual", "activo", "items"]

    def create(self, validated_data):
        items = validated_data.pop("items")
        paquete = PaqueteMaquinaria.objects.create(creado_por=self.context["request"].user, **validated_data)
        for item in items:
            ItemPaquete.objects.create(paquete=paquete, **item)
        return paquete

    def update(self, instance, validated_data):
        items = validated_data.pop("items", None)
        instance = super().update(instance, validated_data)
        if items is not None:
            instance.items.all().delete()
            for item in items:
                ItemPaquete.objects.create(paquete=instance, **item)
        return instance

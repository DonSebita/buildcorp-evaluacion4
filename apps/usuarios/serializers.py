"""Serializers de autenticación JWT."""
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import Usuario
from .roles import ADMIN, TODOS, asignar_rol, rol_de


class TokenConRolSerializer(TokenObtainPairSerializer):
    """Login JWT: agrega el rol y el nombre como claims del token.

    El frontend lee el rol del token solo para armar el menú; la autorización
    real la sigue haciendo PermisoPorRol en el backend con cada petición.
    """

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["rol"] = rol_de(user)
        token["username"] = user.username
        return token


class UsuarioActualSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    username = serializers.CharField(read_only=True)
    nombre = serializers.SerializerMethodField()
    rol = serializers.SerializerMethodField()

    def get_nombre(self, usuario) -> str:
        return usuario.get_full_name() or usuario.username

    def get_rol(self, usuario) -> str | None:
        return rol_de(usuario)


# ---------------------------------------------------------------- gestión de trabajadores (Administrador)

# Nombre del campo de la clave en la API. Los errores de validación se asocian a ese
# campo con _error_clave(); el texto del error nunca es una credencial.
CAMPO_CLAVE = "password"


def _error_clave(mensaje):
    return serializers.ValidationError({CAMPO_CLAVE: mensaje})

class UsuarioSerializer(serializers.ModelSerializer):
    """Trabajador del sistema. El rol se guarda como Grupo de Django (uno solo por usuario).

    - `password` solo se usa al crear (para cambiarla después: acción restablecer-clave).
    - `rol` es obligatorio al crear; un usuario sin rol no puede usar ninguna pantalla.
    """

    rol = serializers.ChoiceField(choices=[(r, r) for r in TODOS])
    nombre = serializers.SerializerMethodField()
    password = serializers.CharField(write_only=True, required=False, style={"input_type": "password"})

    class Meta:
        model = Usuario
        fields = [
            "id", "username", "first_name", "last_name", "nombre", "email", "rut", "telefono", "cargo",
            "rol", "is_active", "is_superuser", "last_login", "date_joined", "password",
        ]
        read_only_fields = ["is_superuser", "last_login", "date_joined"]
        extra_kwargs = {"first_name": {"required": True, "allow_blank": False}}

    def get_nombre(self, usuario) -> str:
        return usuario.get_full_name() or usuario.username

    def to_representation(self, usuario):
        datos = super().to_representation(usuario)
        datos["rol"] = rol_de(usuario)
        return datos

    def validate_rut(self, valor):
        from apps.contratistas.serializers import validar_rut

        valor = (valor or "").strip()
        return validar_rut(valor) if valor else ""

    def validate_username(self, valor):
        qs = Usuario.objects.filter(username__iexact=valor)
        if self.instance is not None:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Ya existe un trabajador con ese nombre de usuario.")
        return valor

    def validate(self, datos):
        clave = datos.get(CAMPO_CLAVE)
        if self.instance is None and not clave:
            raise _error_clave("Define una clave inicial para el trabajador.")
        if self.instance is not None and CAMPO_CLAVE in datos:
            raise _error_clave("Para cambiar la clave usa «Restablecer clave».")
        if clave:
            candidato = Usuario(**{k: v for k, v in datos.items() if k not in ("rol", CAMPO_CLAVE)})
            try:
                validate_password(clave, candidato)
            except DjangoValidationError as e:
                raise _error_clave(list(e.messages)) from e

        solicitante = self.context["request"].user
        if self.instance is not None and self.instance.pk == solicitante.pk:
            if datos.get("is_active") is False:
                raise serializers.ValidationError({"is_active": "No puedes desactivar tu propia cuenta."})
            if "rol" in datos and datos["rol"] != ADMIN and not self.instance.is_superuser:
                raise serializers.ValidationError({"rol": "No puedes quitarte el rol de Administrador a ti mismo."})
        if self.instance is not None and self.instance.is_superuser and not solicitante.is_superuser:
            raise serializers.ValidationError("Solo un superusuario puede modificar a otro superusuario.")
        return datos

    @transaction.atomic
    def create(self, datos):
        rol = datos.pop("rol")
        clave = datos.pop("password")
        usuario = Usuario(**datos)
        usuario.set_password(clave)
        usuario.save()
        asignar_rol(usuario, rol)
        return usuario

    @transaction.atomic
    def update(self, usuario, datos):
        rol = datos.pop("rol", None)
        usuario = super().update(usuario, datos)
        if rol:
            asignar_rol(usuario, rol)
        return usuario


class RestablecerClaveSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True, style={"input_type": "password"})

    def validate_password(self, valor):
        try:
            validate_password(valor, self.context.get("usuario"))
        except DjangoValidationError as e:
            raise serializers.ValidationError(list(e.messages)) from e
        return valor

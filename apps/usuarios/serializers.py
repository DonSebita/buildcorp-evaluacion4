"""Serializers de autenticación JWT."""
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .roles import rol_de


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

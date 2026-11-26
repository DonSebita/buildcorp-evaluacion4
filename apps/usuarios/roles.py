"""Roles del sistema. Se implementan como Grupos de Django."""

ADMIN = "Administrador"
BODEGUERO = "Bodeguero"
ENCARGADO = "Encargado E/R"
VENTAS = "Ventas"

TODOS = (ADMIN, BODEGUERO, ENCARGADO, VENTAS)

# Clave corta para CSS y plantillas.
CLAVES = {ADMIN: "admin", BODEGUERO: "bodega", ENCARGADO: "terreno", VENTAS: "ventas"}


def rol_de(usuario):
    if not usuario or not usuario.is_authenticated:
        return None
    if usuario.is_superuser:
        return ADMIN
    nombres = set(usuario.groups.values_list("name", flat=True))
    for rol in TODOS:
        if rol in nombres:
            return rol
    return None


def tiene_rol(usuario, *permitidos):
    rol = rol_de(usuario)
    return rol is not None and (rol == ADMIN or rol in permitidos)


def asignar_rol(usuario, rol):
    """Deja al usuario con un solo rol (Grupo). Los grupos que no son roles no se tocan."""
    from django.contrib.auth.models import Group

    if rol not in TODOS:
        raise ValueError(f"Rol desconocido: {rol}")
    usuario.groups.remove(*Group.objects.filter(name__in=TODOS).exclude(name=rol))
    usuario.groups.add(Group.objects.get_or_create(name=rol)[0])

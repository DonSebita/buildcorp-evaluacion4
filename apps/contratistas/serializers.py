import re

from rest_framework import serializers

from .models import Contratista, Obra

RUT_RE = re.compile(r"^(\d{7,8})-?([\dK])$")


def digito_verificador(cuerpo):
    """Dígito verificador de un RUT chileno (módulo 11)."""
    suma, factor = 0, 2
    for d in reversed(str(cuerpo)):
        suma += int(d) * factor
        factor = factor + 1 if factor < 7 else 2
    resto = 11 - suma % 11
    return {11: "0", 10: "K"}.get(resto, str(resto))


def normalizar_rut(valor):
    """'12345678k' o '12.345.678-K' -> '12.345.678-K'. Devuelve None si el formato no es válido."""
    limpio = re.sub(r"[.\s]", "", str(valor or "")).upper()
    m = RUT_RE.match(limpio)
    if not m:
        return None
    cuerpo, dv = m.groups()
    return f"{int(cuerpo):,}".replace(",", ".") + f"-{dv}"


def validar_rut(valor):
    """Normaliza el RUT y revisa formato y dígito verificador. Lanza ValidationError de DRF."""
    rut = normalizar_rut(valor)
    if rut is None:
        raise serializers.ValidationError("Formato de RUT inválido. Usa el formato 12.345.678-5.")
    cuerpo, dv = rut.replace(".", "").split("-")
    if digito_verificador(cuerpo) != dv:
        raise serializers.ValidationError("El dígito verificador del RUT no es válido.")
    return rut


class ObraSerializer(serializers.ModelSerializer):
    contratista_nombre = serializers.CharField(source="contratista.razon_social", read_only=True)

    class Meta:
        model = Obra
        fields = "__all__"
        extra_kwargs = {
            "nombre": {"error_messages": {"blank": "El nombre de la obra es obligatorio."}},
            "responsable_nombre": {"error_messages": {"blank": "Indica el responsable de la obra."}},
        }

    def validate_nombre(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("El nombre de la obra es obligatorio.")
        return value

    def validate(self, attrs):
        inst = self.instance
        inicio = attrs.get("fecha_inicio", inst.fecha_inicio if inst else None)
        fin = attrs.get("fecha_fin", inst.fecha_fin if inst else None)
        if inicio and fin and fin < inicio:
            raise serializers.ValidationError(
                {"fecha_fin": "La fecha de término no puede ser anterior a la fecha de inicio."}
            )

        # No se crean obras (ni se traspasan) a un contratista bloqueado.
        contratista = attrs.get("contratista")
        cambia_contratista = contratista is not None and (inst is None or inst.contratista_id != contratista.pk)
        if cambia_contratista and contratista.bloqueado:
            raise serializers.ValidationError(
                {"contratista": f"{contratista} está bloqueado: no se le pueden asignar obras nuevas."}
            )
        return attrs


class ContratistaSerializer(serializers.ModelSerializer):
    obras = ObraSerializer(many=True, read_only=True)
    estado_display = serializers.CharField(source="get_estado_display", read_only=True)

    class Meta:
        model = Contratista
        fields = [
            "id", "rut", "razon_social", "contacto", "email", "telefono", "estado", "estado_display",
            "fecha_bloqueo", "motivo_bloqueo", "obras",
        ]
        read_only_fields = ["estado", "fecha_bloqueo", "motivo_bloqueo"]
        extra_kwargs = {
            # La unicidad se revisa en validate_rut, sobre el RUT ya normalizado.
            "rut": {"validators": [], "error_messages": {"blank": "El RUT es obligatorio."}},
            "razon_social": {"error_messages": {"blank": "La razón social no puede estar vacía."}},
            "email": {"error_messages": {"invalid": "Ingresa un correo electrónico válido."}},
        }

    def validate_rut(self, value):
        # Al editar sin cambiar el RUT se acepta tal cual (hay datos antiguos con otro formato).
        if self.instance and normalizar_rut(value) == normalizar_rut(self.instance.rut):
            return self.instance.rut
        rut = validar_rut(value)
        repetidos = Contratista.objects.filter(rut=rut)
        if self.instance:
            repetidos = repetidos.exclude(pk=self.instance.pk)
        if repetidos.exists():
            raise serializers.ValidationError(f"Ya existe un contratista con el RUT {rut}.")
        return rut

    def validate_razon_social(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("La razón social no puede estar vacía.")
        return value

    def validate_email(self, value):
        return value.strip().lower()

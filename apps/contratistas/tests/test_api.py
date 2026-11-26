"""Tests del CRUD de Contratistas y Obras por la API (rúbrica: serializers, validaciones y códigos HTTP)."""
from datetime import date

from django.contrib.auth.models import Group
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.activos.serializers import CategoriaSerializer
from apps.contratistas.models import Contratista, Obra
from apps.contratistas.serializers import digito_verificador, normalizar_rut
from apps.prestamos.models import Prestamo
from apps.usuarios.models import Usuario
from apps.usuarios.roles import BODEGUERO, TODOS, VENTAS

URL_C = "/api/v1/contratistas/"
URL_O = "/api/v1/obras/"


class BaseAPITest(TestCase):
    def setUp(self):
        for rol in TODOS:
            Group.objects.get_or_create(name=rol)
        self.ventas = Usuario.objects.create_user("ventas", password="x")
        self.ventas.groups.add(Group.objects.get(name=VENTAS))
        self.bodeguero = Usuario.objects.create_user("bodeguero", password="x")
        self.bodeguero.groups.add(Group.objects.get(name=BODEGUERO))

        self.api = APIClient()
        self.api.force_authenticate(self.ventas)

        self.c = Contratista.objects.create(rut="76.123.456-0", razon_social="Constructora Andes Sur SpA")
        self.obra = Obra.objects.create(
            nombre="Edificio Los Robles", contratista=self.c, responsable_nombre="Luis Herrera",
            responsable_rut="12.345.678-5", fecha_inicio=date(2026, 1, 1),
        )

    def crear_prestamo(self, contratista, obra):
        hoy = timezone.localdate()
        return Prestamo.objects.create(
            codigo="PR-TEST-1", contratista=contratista, obra=obra, fecha_entrega=hoy,
            fecha_devolucion_pactada=hoy, creado_por=self.ventas,
        )


class RutTests(TestCase):
    def test_digito_verificador(self):
        self.assertEqual(digito_verificador("12345678"), "5")
        self.assertEqual(digito_verificador("78222333"), "K")
        self.assertEqual(digito_verificador("76123456"), "0")

    def test_normaliza_formatos(self):
        self.assertEqual(normalizar_rut("12345678-5"), "12.345.678-5")
        self.assertEqual(normalizar_rut("12.345.678-5"), "12.345.678-5")
        self.assertEqual(normalizar_rut("78222333k"), "78.222.333-K")
        self.assertEqual(normalizar_rut("1234567-4"), "1.234.567-4")
        self.assertIsNone(normalizar_rut("abc"))


class ContratistaCRUDTests(BaseAPITest):
    def test_list_200(self):
        r = self.api.get(URL_C)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["count"], 1)

    def test_create_201_normaliza_rut(self):
        r = self.api.post(URL_C, {"rut": "78222333k", "razon_social": "Ingeniería Cordillera SpA",
                                  "email": "Contacto@Cordillera.CL"}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["rut"], "78.222.333-K")
        self.assertEqual(r.data["email"], "contacto@cordillera.cl")

    def test_put_200(self):
        r = self.api.put(f"{URL_C}{self.c.pk}/", {"rut": self.c.rut, "razon_social": "Andes Sur Ltda.",
                                                  "contacto": "Ana", "email": "", "telefono": ""}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["razon_social"], "Andes Sur Ltda.")

    def test_put_rut_antiguo_sin_cambios_se_acepta(self):
        # Datos antiguos con DV inválido no impiden editar otros campos.
        viejo = Contratista.objects.create(rut="77.654.321-K", razon_social="Montajes Pacífico")
        r = self.api.put(f"{URL_C}{viejo.pk}/", {"rut": "77.654.321-K", "razon_social": "Montajes Pacífico Ltda."},
                         format="json")
        self.assertEqual(r.status_code, 200, r.data)

    def test_patch_200(self):
        r = self.api.patch(f"{URL_C}{self.c.pk}/", {"telefono": "+56 9 1234 5678"}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["telefono"], "+56 9 1234 5678")

    def test_delete_204(self):
        r = self.api.delete(f"{URL_C}{self.c.pk}/")
        self.assertEqual(r.status_code, 204)
        self.assertFalse(Contratista.objects.filter(pk=self.c.pk).exists())

    def test_rut_dv_invalido_400(self):
        r = self.api.post(URL_C, {"rut": "12.345.678-9", "razon_social": "X"}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("dígito verificador", str(r.data["rut"]))

    def test_rut_formato_invalido_400(self):
        r = self.api.post(URL_C, {"rut": "hola", "razon_social": "X"}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("Formato de RUT", str(r.data["rut"]))

    def test_rut_repetido_400_aunque_cambie_formato(self):
        r = self.api.post(URL_C, {"rut": "761234560", "razon_social": "Copia"}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("Ya existe un contratista", str(r.data["rut"]))

    def test_razon_social_vacia_400(self):
        r = self.api.post(URL_C, {"rut": "12.345.678-5", "razon_social": "   "}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("razón social", str(r.data["razon_social"]))

    def test_email_invalido_400(self):
        r = self.api.post(URL_C, {"rut": "12.345.678-5", "razon_social": "X", "email": "no-es-correo"},
                          format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("correo", str(r.data["email"]))

    def test_delete_con_prestamos_409(self):
        self.crear_prestamo(self.c, self.obra)
        r = self.api.delete(f"{URL_C}{self.c.pk}/")
        self.assertEqual(r.status_code, 409)
        self.assertIn("préstamo", r.data["detail"])
        self.assertTrue(Contratista.objects.filter(pk=self.c.pk).exists())
        self.assertTrue(Obra.objects.filter(pk=self.obra.pk).exists())

    def test_bodeguero_no_escribe_403(self):
        self.api.force_authenticate(self.bodeguero)
        self.assertEqual(self.api.get(URL_C).status_code, 200)
        r = self.api.post(URL_C, {"rut": "12.345.678-5", "razon_social": "X"}, format="json")
        self.assertEqual(r.status_code, 403)
        self.assertEqual(self.api.patch(f"{URL_C}{self.c.pk}/", {"telefono": "1"}, format="json").status_code, 403)
        self.assertEqual(self.api.delete(f"{URL_C}{self.c.pk}/").status_code, 403)

    def test_sin_autenticar_rechaza(self):
        self.api.force_authenticate(None)
        self.assertIn(self.api.get(URL_C).status_code, (401, 403))


class ObraCRUDTests(BaseAPITest):
    def datos(self, **extra):
        d = {"nombre": "Paso superior Ruta 68", "contratista": self.c.pk, "responsable_nombre": "Paula Castro",
             "responsable_rut": "15.678.901-1", "fecha_inicio": "2026-03-01", "fecha_fin": "2026-12-31"}
        d.update(extra)
        return d

    def test_list_200(self):
        r = self.api.get(URL_O)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["count"], 1)

    def test_create_201(self):
        r = self.api.post(URL_O, self.datos(), format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["contratista_nombre"], self.c.razon_social)

    def test_put_200(self):
        r = self.api.put(f"{URL_O}{self.obra.pk}/", self.datos(nombre="Los Robles II"), format="json")
        self.assertEqual(r.status_code, 200, r.data)

    def test_patch_200(self):
        r = self.api.patch(f"{URL_O}{self.obra.pk}/", {"activa": False}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertFalse(r.data["activa"])

    def test_delete_204(self):
        self.assertEqual(self.api.delete(f"{URL_O}{self.obra.pk}/").status_code, 204)

    def test_fechas_incoherentes_400(self):
        r = self.api.post(URL_O, self.datos(fecha_inicio="2026-06-01", fecha_fin="2026-05-01"), format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("fecha_fin", r.data)

    def test_patch_fecha_fin_antes_de_inicio_guardado_400(self):
        r = self.api.patch(f"{URL_O}{self.obra.pk}/", {"fecha_fin": "2025-12-31"}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("fecha_fin", r.data)

    def test_contratista_bloqueado_no_recibe_obras_400(self):
        Contratista.objects.filter(pk=self.c.pk).update(estado=Contratista.Estado.BLOQUEADO)
        r = self.api.post(URL_O, self.datos(), format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("bloqueado", str(r.data["contratista"]))

    def test_obra_existente_de_bloqueado_se_puede_editar(self):
        Contratista.objects.filter(pk=self.c.pk).update(estado=Contratista.Estado.BLOQUEADO)
        r = self.api.patch(f"{URL_O}{self.obra.pk}/", {"activa": False}, format="json")
        self.assertEqual(r.status_code, 200, r.data)

    def test_delete_con_prestamos_409(self):
        self.crear_prestamo(self.c, self.obra)
        r = self.api.delete(f"{URL_O}{self.obra.pk}/")
        self.assertEqual(r.status_code, 409)
        self.assertIn("préstamo", r.data["detail"])

    def test_bodeguero_no_escribe_403(self):
        self.api.force_authenticate(self.bodeguero)
        self.assertEqual(self.api.post(URL_O, self.datos(), format="json").status_code, 403)


class CategoriaSerializerTests(TestCase):
    def datos(self, **extra):
        d = {"nombre": "Rotomartillo", "prefijo_codigo": "RTM", "tarifa_diaria": 15000, "tarifa_mensual": 300000}
        d.update(extra)
        return d

    def test_tarifas_validas(self):
        self.assertTrue(CategoriaSerializer(data=self.datos()).is_valid())

    def test_tarifas_en_cero_invalidas(self):
        s = CategoriaSerializer(data=self.datos(tarifa_diaria=0, tarifa_mensual=0))
        self.assertFalse(s.is_valid())
        self.assertIn("tarifa_diaria", s.errors)
        self.assertIn("tarifa_mensual", s.errors)

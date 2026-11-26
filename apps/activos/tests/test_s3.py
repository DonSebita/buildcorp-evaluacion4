"""Tests de archivos en S3 (T10): URL de la foto y manual con URL prefirmada.

No llaman a AWS: usan un almacenamiento local temporal (MEDIA_ROOT en un directorio
temporal) o mocks del storage para simular el comportamiento de S3.
"""
import shutil
import tempfile
from unittest import mock

from django.contrib.auth.models import Group
from django.core.files.base import ContentFile
from django.core.files.storage import FileSystemStorage, default_storage
from django.test import TestCase, override_settings
from rest_framework.test import APIClient, APIRequestFactory

from apps.activos import api
from apps.activos.models import Activo, CategoriaActivo
from apps.activos.serializers import ActivoSerializer
from apps.usuarios.models import Usuario
from apps.usuarios.roles import BODEGUERO, TODOS, VENTAS

PNG_1PX = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
    b"\x00\x00\x00\rIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
)


@override_settings(MEDIA_URL="/media/", USE_S3=False)
class BaseS3Test(TestCase):
    def setUp(self):
        # Cada test usa su propio MEDIA_ROOT temporal: no deja archivos en media/.
        media = tempfile.mkdtemp(prefix="buildcorp-test-media-")
        self.addCleanup(shutil.rmtree, media, ignore_errors=True)
        self.enterContext(override_settings(MEDIA_ROOT=media))
        for rol in TODOS:
            Group.objects.get_or_create(name=rol)
        self.ventas = Usuario.objects.create_user("ventas", password="x")
        self.ventas.groups.add(Group.objects.get(name=VENTAS))
        self.bodeguero = Usuario.objects.create_user("bodeguero", password="x")
        self.bodeguero.groups.add(Group.objects.get(name=BODEGUERO))
        self.api = APIClient()
        self.api.force_authenticate(self.ventas)

        cat = CategoriaActivo.objects.create(
            nombre="Rotomartillos", prefijo_codigo="RTM", tarifa_diaria=5000, tarifa_mensual=90000
        )
        self.activo = Activo.objects.create(codigo="RTM-0001", nombre="Rotomartillo Bosch", categoria=cat)

    def url_manual(self, activo=None):
        return f"/api/v1/activos/{(activo or self.activo).pk}/manual/"


class FotoUrlTest(BaseS3Test):
    def test_sin_foto_devuelve_none(self):
        r = self.api.get(f"/api/v1/activos/{self.activo.pk}/")
        self.assertEqual(r.status_code, 200)
        self.assertIsNone(r.json()["foto_url"])

    def test_con_foto_local_devuelve_url_absoluta(self):
        self.activo.foto.save("rtm.png", ContentFile(PNG_1PX), save=True)
        r = self.api.get(f"/api/v1/activos/{self.activo.pk}/")
        self.assertEqual(r.status_code, 200)
        url = r.json()["foto_url"]
        self.assertTrue(url.startswith("http://testserver/media/activos/"), url)
        self.assertTrue(url.endswith(".png"), url)

    @override_settings(USE_S3=True)
    def test_con_s3_usa_la_url_prefirmada_del_storage(self):
        firmada = "https://buildcorp-sebastian-assets.s3.amazonaws.com/media/activos/rtm.png?X-Amz-Signature=abc"
        self.activo.foto.name = "activos/rtm.png"
        request = APIRequestFactory().get("/")
        with mock.patch.object(FileSystemStorage, "url", return_value=firmada):
            data = ActivoSerializer(self.activo, context={"request": request}).data
        self.assertEqual(data["foto_url"], firmada)


class ManualTest(BaseS3Test):
    def test_sin_manual_responde_404(self):
        r = self.api.get(self.url_manual())
        self.assertEqual(r.status_code, 404)

    def test_activo_inexistente_responde_404(self):
        r = self.api.get("/api/v1/activos/999999/manual/")
        self.assertEqual(r.status_code, 404)

    def test_con_manual_devuelve_url_y_expiracion(self):
        default_storage.save("manuales/RTM-0001.pdf", ContentFile(b"%PDF-1.4 prueba"))
        r = self.api.get(self.url_manual())
        self.assertEqual(r.status_code, 200)
        datos = r.json()
        self.assertEqual(datos["expira_en"], 300)
        self.assertEqual(datos["url"], "http://testserver/media/manuales/RTM-0001.pdf")

    def test_sin_autenticacion_responde_401(self):
        r = APIClient().get(self.url_manual())
        self.assertEqual(r.status_code, 401)

    @override_settings(USE_S3=True)
    def test_con_s3_pide_url_prefirmada_de_5_minutos(self):
        storage = mock.Mock()
        storage.exists.return_value = True
        storage.url.return_value = "https://bucket.s3.amazonaws.com/media/manuales/RTM-0001.pdf?X-Amz-Expires=300"
        with mock.patch.object(api, "default_storage", storage):
            r = self.api.get(self.url_manual())
        self.assertEqual(r.status_code, 200)
        storage.exists.assert_called_once_with("manuales/RTM-0001.pdf")
        storage.url.assert_called_once_with("manuales/RTM-0001.pdf", expire=300)
        self.assertEqual(r.json(), {"url": storage.url.return_value, "expira_en": 300})

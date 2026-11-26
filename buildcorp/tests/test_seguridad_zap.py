"""Pruebas de las correcciones de los hallazgos de OWASP ZAP (Evaluación 4)."""
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.test import override_settings
from rest_framework.test import APITestCase

from apps.usuarios.roles import BODEGUERO
from buildcorp.middleware import CSP_API

ORIGEN = "http://frontend.test"


@override_settings(CORS_ALLOWED_ORIGINS=[ORIGEN])
class CabecerasApiTests(APITestCase):
    def assert_cabeceras(self, r):
        self.assertEqual(r["Content-Security-Policy"], CSP_API)
        self.assertIn("max-age=", r["Strict-Transport-Security"])
        self.assertEqual(r["Cache-Control"], "no-store")

    def test_preflight_cors_lleva_csp(self):
        r = self.client.options(
            "/api/v1/auth/token/",
            HTTP_ORIGIN=ORIGEN,
            HTTP_ACCESS_CONTROL_REQUEST_METHOD="POST",
        )
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r["Access-Control-Allow-Origin"], ORIGEN)
        self.assert_cabeceras(r)

    def test_401_lleva_csp(self):
        r = self.client.get("/api/v1/auth/me/")
        self.assertEqual(r.status_code, 401)
        self.assert_cabeceras(r)

    def test_interfaz_django_no_cambia(self):
        r = self.client.get("/login/")
        self.assertNotIn("Content-Security-Policy", r.headers)


class PaginacionEstrictaTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.usuario = get_user_model().objects.create_user(username="bodega", password="x")
        cls.usuario.groups.add(Group.objects.get_or_create(name=BODEGUERO)[0])

    def setUp(self):
        self.client.force_authenticate(self.usuario)

    def test_page_con_expresion_da_400(self):
        r = self.client.get("/api/v1/activos/", {"page": "3-2", "page_size": "20"})
        self.assertEqual(r.status_code, 400)
        self.assertIn("page", r.json())

    def test_page_size_no_numerico_da_400(self):
        r = self.client.get("/api/v1/activos/", {"page_size": "20 OR 1=1"})
        self.assertEqual(r.status_code, 400)

    def test_paginas_validas_siguen_funcionando(self):
        self.assertEqual(self.client.get("/api/v1/activos/", {"page": "1", "page_size": "20"}).status_code, 200)
        self.assertEqual(self.client.get("/api/v1/activos/", {"page": "last"}).status_code, 200)
        self.assertEqual(self.client.get("/api/v1/activos/").status_code, 200)

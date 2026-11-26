"""Pruebas de autenticación JWT: login, /me, endpoint protegido, refresh y logout."""
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import AccessToken

from apps.usuarios.roles import VENTAS

URL_TOKEN = "/api/v1/auth/token/"
URL_REFRESH = "/api/v1/auth/token/refresh/"
URL_LOGOUT = "/api/v1/auth/logout/"
URL_ME = "/api/v1/auth/me/"
URL_PROTEGIDA = "/api/v1/dashboard/resumen/"
CLAVE = "Bodega-Segura-2026"


class JWTTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.usuario = get_user_model().objects.create_user(
            username="vendedora", password=CLAVE, first_name="Ana", last_name="Pérez"
        )
        cls.usuario.groups.add(Group.objects.get_or_create(name=VENTAS)[0])

    def login(self):
        r = self.client.post(URL_TOKEN, {"username": "vendedora", "password": CLAVE}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        return r.json()

    def test_login_ok_entrega_tokens_con_rol(self):
        datos = self.login()
        self.assertIn("access", datos)
        self.assertIn("refresh", datos)
        self.assertEqual(AccessToken(datos["access"])["rol"], VENTAS)

    def test_login_malo_401(self):
        r = self.client.post(URL_TOKEN, {"username": "vendedora", "password": "mala"}, format="json")
        self.assertEqual(r.status_code, 401)

    def test_me_con_token(self):
        access = self.login()["access"]
        r = self.client.get(URL_ME, HTTP_AUTHORIZATION=f"Bearer {access}")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(
            r.json(),
            {"id": self.usuario.id, "username": "vendedora", "nombre": "Ana Pérez", "rol": VENTAS},
        )

    def test_me_sin_token_401(self):
        self.assertEqual(self.client.get(URL_ME).status_code, 401)

    def test_endpoint_protegido_sin_token_401(self):
        self.assertEqual(self.client.get(URL_PROTEGIDA).status_code, 401)

    def test_endpoint_protegido_con_token_200(self):
        access = self.login()["access"]
        r = self.client.get(URL_PROTEGIDA, HTTP_AUTHORIZATION=f"Bearer {access}")
        self.assertEqual(r.status_code, 200)

    def test_token_invalido_401(self):
        r = self.client.get(URL_ME, HTTP_AUTHORIZATION="Bearer no-es-un-token")
        self.assertEqual(r.status_code, 401)

    def test_refresh_rota_y_bloquea_el_anterior(self):
        refresh = self.login()["refresh"]
        r = self.client.post(URL_REFRESH, {"refresh": refresh}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertIn("access", r.json())
        self.assertNotEqual(r.json()["refresh"], refresh)
        # El refresh usado quedó en la lista negra (rotación + blacklist).
        r2 = self.client.post(URL_REFRESH, {"refresh": refresh}, format="json")
        self.assertEqual(r2.status_code, 401)

    def test_logout_invalida_el_refresh(self):
        refresh = self.login()["refresh"]
        r = self.client.post(URL_LOGOUT, {"refresh": refresh}, format="json")
        self.assertEqual(r.status_code, 200)
        r2 = self.client.post(URL_REFRESH, {"refresh": refresh}, format="json")
        self.assertEqual(r2.status_code, 401)

    def test_contrasena_se_guarda_con_argon2(self):
        self.assertTrue(self.usuario.password.startswith("argon2"))

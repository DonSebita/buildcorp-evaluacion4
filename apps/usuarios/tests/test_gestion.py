"""Gestión de trabajadores (/api/v1/usuarios/) y parámetros (/api/v1/parametros/)."""
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from rest_framework.test import APITestCase

from apps.prestamos.models import ParametroSistema
from apps.usuarios.roles import ADMIN, BODEGUERO, ENCARGADO, VENTAS

Usuario = get_user_model()
CLAVE = "Bodega-Segura-2026"
URL = "/api/v1/usuarios/"
URL_PARAMS = "/api/v1/parametros/"


def crear(username, rol=None, **extra):
    u = Usuario.objects.create_user(username=username, password=CLAVE, first_name=username.title(), **extra)
    if rol:
        u.groups.add(Group.objects.get_or_create(name=rol)[0])
    return u


class GestionUsuariosTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin = crear("jefa", ADMIN)
        cls.ventas = crear("vendedor", VENTAS)
        cls.bodega = crear("bodeguero", BODEGUERO)

    def token(self, username):
        r = self.client.post("/api/v1/auth/token/", {"username": username, "password": CLAVE}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        return r.json()

    def como(self, usuario):
        self.client.force_authenticate(usuario)

    # ---- permisos
    def test_sin_token_401(self):
        self.assertEqual(self.client.get(URL).status_code, 401)

    def test_otros_roles_403(self):
        for u in (self.ventas, self.bodega):
            self.como(u)
            self.assertEqual(self.client.get(URL).status_code, 403)
            self.assertEqual(self.client.post(URL, {}, format="json").status_code, 403)

    def test_admin_lista_y_filtra_por_rol(self):
        self.como(self.admin)
        r = self.client.get(URL, {"rol": VENTAS})
        self.assertEqual(r.status_code, 200)
        self.assertEqual([f["username"] for f in r.json()["results"]], ["vendedor"])
        self.assertEqual(r.json()["results"][0]["rol"], VENTAS)
        self.assertNotIn("password", r.json()["results"][0])

    # ---- crear / editar
    def test_admin_crea_trabajador_con_rol_y_puede_entrar(self):
        self.como(self.admin)
        r = self.client.post(URL, {
            "username": "terreno1", "first_name": "Luis", "last_name": "Soto", "rut": "12345678-5",
            "rol": ENCARGADO, "password": "Terreno-Seguro-2026", "is_active": True,
        }, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.json()["rol"], ENCARGADO)
        self.assertEqual(r.json()["rut"], "12.345.678-5")
        self.client.force_authenticate(None)
        r = self.client.post("/api/v1/auth/token/", {"username": "terreno1", "password": "Terreno-Seguro-2026"}, format="json")
        self.assertEqual(r.status_code, 200)

    def test_crear_valida_clave_rut_y_usuario_repetido(self):
        self.como(self.admin)
        r = self.client.post(URL, {"username": "Vendedor", "first_name": "X", "rol": VENTAS, "password": "123", "rut": "12345678-9"}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertTrue({"username", "rut"} <= set(r.json()))
        r = self.client.post(URL, {"username": "nuevo", "first_name": "X", "rol": VENTAS, "password": "123"}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("password", r.json())

    def test_cambiar_rol_deja_un_solo_rol(self):
        self.como(self.admin)
        r = self.client.patch(f"{URL}{self.bodega.id}/", {"rol": VENTAS}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(list(self.bodega.groups.values_list("name", flat=True)), [VENTAS])

    def test_editar_no_cambia_clave(self):
        self.como(self.admin)
        r = self.client.patch(f"{URL}{self.ventas.id}/", {"password": "Otra-Clave-2026"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_no_se_borran(self):
        self.como(self.admin)
        self.assertEqual(self.client.delete(f"{URL}{self.ventas.id}/").status_code, 405)

    # ---- protecciones sobre la propia cuenta
    def test_admin_no_se_quita_su_rol_ni_se_desactiva(self):
        self.como(self.admin)
        self.assertEqual(self.client.patch(f"{URL}{self.admin.id}/", {"rol": VENTAS}, format="json").status_code, 400)
        self.assertEqual(self.client.post(f"{URL}{self.admin.id}/desactivar/").status_code, 400)

    def test_admin_normal_no_toca_superusuario(self):
        su = Usuario.objects.create_superuser("root", "r@x.cl", CLAVE)
        self.como(self.admin)
        self.assertEqual(self.client.post(f"{URL}{su.id}/desactivar/").status_code, 403)
        self.assertEqual(self.client.patch(f"{URL}{su.id}/", {"cargo": "x"}, format="json").status_code, 400)

    # ---- desactivar / restablecer clave
    def test_desactivar_corta_el_acceso(self):
        tokens = self.token("vendedor")
        self.como(self.admin)
        r = self.client.post(f"{URL}{self.ventas.id}/desactivar/")
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.json()["is_active"])
        self.client.force_authenticate(None)
        # El access vigente deja de servir (usuario inactivo) y el refresh quedó en la lista negra.
        self.assertEqual(self.client.get("/api/v1/auth/me/", HTTP_AUTHORIZATION=f"Bearer {tokens['access']}").status_code, 401)
        self.assertEqual(self.client.post("/api/v1/auth/token/refresh/", {"refresh": tokens["refresh"]}, format="json").status_code, 401)
        # Reactivar
        self.como(self.admin)
        self.assertTrue(self.client.post(f"{URL}{self.ventas.id}/activar/").json()["is_active"])

    def test_restablecer_clave(self):
        tokens = self.token("bodeguero")
        self.como(self.admin)
        url = f"{URL}{self.bodega.id}/restablecer-clave/"
        self.assertEqual(self.client.post(url, {"password": "corta"}, format="json").status_code, 400)
        self.assertEqual(self.client.post(url, {"password": "Nueva-Clave-Bodega-26"}, format="json").status_code, 204)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.post("/api/v1/auth/token/refresh/", {"refresh": tokens["refresh"]}, format="json").status_code, 401)
        r = self.client.post("/api/v1/auth/token/", {"username": "bodeguero", "password": "Nueva-Clave-Bodega-26"}, format="json")
        self.assertEqual(r.status_code, 200)

    def test_roles_disponibles(self):
        self.como(self.admin)
        self.assertEqual(self.client.get(f"{URL}roles/").json(), [ADMIN, BODEGUERO, ENCARGADO, VENTAS])


class ParametrosTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin = crear("jefa", ADMIN)
        cls.ventas = crear("vendedor", VENTAS)
        cls.bodega = crear("bodeguero", BODEGUERO)

    def test_sin_token_401(self):
        self.assertEqual(self.client.get(URL_PARAMS).status_code, 401)

    def test_ventas_lee_pero_no_escribe(self):
        self.client.force_authenticate(self.ventas)
        self.assertEqual(self.client.get(URL_PARAMS).status_code, 200)
        self.assertEqual(self.client.patch(URL_PARAMS, {"dias_gracia": 9}, format="json").status_code, 403)

    def test_bodeguero_403(self):
        self.client.force_authenticate(self.bodega)
        self.assertEqual(self.client.get(URL_PARAMS).status_code, 403)

    def test_admin_actualiza_y_valida(self):
        self.client.force_authenticate(self.admin)
        r = self.client.patch(URL_PARAMS, {"dias_gracia": 5, "tasa_iva": "0.19"}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(ParametroSistema.actual().dias_gracia, 5)
        self.assertEqual(self.client.patch(URL_PARAMS, {"tasa_iva": "1.5"}, format="json").status_code, 400)


class CategoriaBorradoTests(APITestCase):
    def test_categoria_con_activos_409(self):
        from apps.activos.models import Activo, CategoriaActivo

        admin = crear("jefa", ADMIN)
        cat = CategoriaActivo.objects.create(nombre="Taladros", prefijo_codigo="TAL", tarifa_diaria=1000, tarifa_mensual=20000)
        campos = {f.name for f in Activo._meta.fields}
        datos = {"categoria": cat, "nombre": "Taladro 1"}
        if "codigo" in campos:
            datos["codigo"] = "TAL-0001"
        Activo.objects.create(**datos)
        self.client.force_authenticate(admin)
        self.assertEqual(self.client.delete(f"/api/v1/categorias/{cat.id}/").status_code, 409)

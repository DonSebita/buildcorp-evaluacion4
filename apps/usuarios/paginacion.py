from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination


def _entero_positivo(valor):
    return valor.isascii() and valor.isdigit() and int(valor) > 0


class Paginacion(PageNumberPagination):
    """Paginación estricta: `page` y `page_size` deben ser enteros positivos.

    Un valor como `page=3-2` antes se trataba igual que cualquier página inválida, y
    OWASP ZAP lo interpretó como posible inyección SQL (la consulta nunca se arma con
    ese texto: el ORM usa parámetros). Ahora se rechaza con 400 antes de consultar.
    """

    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 500

    def paginate_queryset(self, queryset, request, view=None):
        for param in (self.page_query_param, self.page_size_query_param):
            valor = request.query_params.get(param)
            if valor is None or valor == "":
                continue
            if param == self.page_query_param and valor in self.last_page_strings:
                continue
            if not _entero_positivo(valor):
                raise ValidationError({param: "Debe ser un número entero positivo."})
        return super().paginate_queryset(queryset, request, view)

from django.urls import path
from rest_framework.routers import DefaultRouter

from . import api

router = DefaultRouter()
router.register("prestamos", api.PrestamoViewSet)
router.register("cobros", api.CobroViewSet)

urlpatterns = router.urls + [
    path("parametros/", api.ParametrosView.as_view(), name="api-parametros"),
]

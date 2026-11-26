"""Tests de snapshot_rds.py sin AWS real (unittest.mock).

Correr desde deploy/lambda/:  python -m unittest -v
"""

import json
import os
import unittest
from datetime import datetime, timedelta, timezone
from unittest import mock

import snapshot_rds

AHORA = datetime(2026, 11, 25, 14, 0, tzinfo=timezone.utc)
ENV = {
    "DB_INSTANCE_ID": "buildcorp-db",
    "SNS_TOPIC_ARN": "arn:aws:sns:us-east-1:123456789012:buildcorp-alertas",
    "RETENCION_HORAS": "72",
}


class FalsoClientError(Exception):
    """Imita botocore.exceptions.ClientError (mismo atributo response)."""

    def __init__(self, codigo, mensaje="error simulado"):
        super().__init__(f"An error occurred ({codigo}): {mensaje}")
        self.response = {"Error": {"Code": codigo, "Message": mensaje}}


def snap(nombre, horas_atras, estado="available"):
    return {
        "DBSnapshotIdentifier": nombre,
        "SnapshotCreateTime": AHORA - timedelta(hours=horas_atras),
        "Status": estado,
    }


def crear_rds(snapshots):
    """Cliente RDS falso; el paginador filtra por SnapshotType como la API real."""
    rds = mock.MagicMock()

    def paginate(DBInstanceIdentifier, SnapshotType=None):
        datos = snapshots
        if SnapshotType == "manual":
            datos = [s for s in snapshots if not s["DBSnapshotIdentifier"].startswith("rds:")]
        # Dos páginas para comprobar que se recorre la paginación completa.
        mitad = len(datos) // 2
        return [{"DBSnapshots": datos[:mitad]}, {"DBSnapshots": datos[mitad:]}]

    rds.get_paginator.return_value.paginate.side_effect = paginate
    return rds


class SnapshotRdsTests(unittest.TestCase):
    def ejecutar(self, rds, env=ENV):
        sns = mock.MagicMock()
        with mock.patch.dict(os.environ, env, clear=True), mock.patch.object(
            snapshot_rds, "_crear_clientes", return_value=(rds, sns)
        ):
            resultado = snapshot_rds.lambda_handler({}, None, ahora=AHORA)
        return resultado, sns

    def ejecutar_con_error(self, rds, env=ENV, error=Exception):
        sns = mock.MagicMock()
        with mock.patch.dict(os.environ, env, clear=True), mock.patch.object(
            snapshot_rds, "_crear_clientes", return_value=(rds, sns)
        ):
            with self.assertRaises(error) as ctx:
                snapshot_rds.lambda_handler({}, None, ahora=AHORA)
        return ctx.exception, sns

    def mensaje_sns(self, sns):
        sns.publish.assert_called_once()
        kwargs = sns.publish.call_args.kwargs
        self.assertEqual(kwargs["TopicArn"], ENV["SNS_TOPIC_ARN"])
        self.assertLessEqual(len(kwargs["Subject"]), 100)
        return kwargs["Subject"], json.loads(kwargs["Message"])

    def test_crea_snapshot_con_nombre_y_tags(self):
        rds = crear_rds([])
        resultado, sns = self.ejecutar(rds)

        rds.create_db_snapshot.assert_called_once()
        kwargs = rds.create_db_snapshot.call_args.kwargs
        self.assertEqual(kwargs["DBSnapshotIdentifier"], "buildcorp-auto7h-20261125-1400")
        self.assertEqual(kwargs["DBInstanceIdentifier"], "buildcorp-db")
        tags = {t["Key"]: t["Value"] for t in kwargs["Tags"]}
        self.assertEqual(tags["Proyecto"], "BuildCorp")
        self.assertEqual(tags["Frecuencia"], "7h")
        self.assertEqual(tags["RetencionHoras"], "72")
        self.assertEqual(resultado["estado"], "ok")

        asunto, cuerpo = self.mensaje_sns(sns)
        self.assertIn("OK", asunto)
        self.assertEqual(cuerpo["snapshot"], "buildcorp-auto7h-20261125-1400")

    def test_borra_solo_los_propios_vencidos(self):
        rds = crear_rds([
            snap("buildcorp-auto7h-20261121-0700", 103),          # vencido -> se borra
            snap("buildcorp-auto7h-20261122-0900", 77),           # vencido -> se borra
            snap("buildcorp-auto7h-20261124-0000", 38),           # dentro de 72 h
            snap("buildcorp-auto7h-20261120-0000", 110, "creating"),  # no disponible
            snap("antes-de-migracion", 500),                      # manual ajeno
            snap("rds:buildcorp-db-2026-11-20-05-00", 200),       # backup automático
        ])
        resultado, _ = self.ejecutar(rds)

        borrados = [c.kwargs["DBSnapshotIdentifier"] for c in rds.delete_db_snapshot.call_args_list]
        # El snapshot en "creating" hace que esta ejecución no cree uno nuevo,
        # pero la limpieza de vencidos se hace igual.
        self.assertEqual(resultado["estado"], "omitido")
        rds.create_db_snapshot.assert_not_called()
        self.assertEqual(
            sorted(borrados),
            ["buildcorp-auto7h-20261121-0700", "buildcorp-auto7h-20261122-0900"],
        )

    def test_borrado_respeta_retencion_configurada(self):
        rds = crear_rds([
            snap("buildcorp-auto7h-20261124-0000", 38),
            snap("buildcorp-auto7h-20261125-0700", 7),
            snap("otro-manual", 300),
        ])
        resultado, _ = self.ejecutar(rds, env={**ENV, "RETENCION_HORAS": "24"})

        rds.delete_db_snapshot.assert_called_once_with(
            DBSnapshotIdentifier="buildcorp-auto7h-20261124-0000"
        )
        self.assertEqual(resultado["estado"], "ok")
        self.assertEqual(resultado["borrados"], ["buildcorp-auto7h-20261124-0000"])

    def test_retencion_por_defecto_72_horas(self):
        rds = crear_rds([snap("buildcorp-auto7h-20261122-1500", 71)])
        env = {k: v for k, v in ENV.items() if k != "RETENCION_HORAS"}
        resultado, _ = self.ejecutar(rds, env=env)

        self.assertEqual(resultado["retencion_horas"], 72)
        rds.delete_db_snapshot.assert_not_called()

    def test_omite_si_hay_snapshot_en_curso(self):
        rds = crear_rds([snap("rds:buildcorp-db-2026-11-25-13-55", 0, "creating")])
        resultado, sns = self.ejecutar(rds)

        rds.create_db_snapshot.assert_not_called()
        self.assertEqual(resultado["estado"], "omitido")
        asunto, cuerpo = self.mensaje_sns(sns)
        self.assertIn("omitido", asunto)
        self.assertIn("en curso", cuerpo["motivo"])

    def test_snapshot_ya_existe_no_es_error(self):
        rds = crear_rds([])
        rds.create_db_snapshot.side_effect = FalsoClientError("DBSnapshotAlreadyExists")
        resultado, sns = self.ejecutar(rds)

        self.assertEqual(resultado["estado"], "omitido")
        sns.publish.assert_called_once()

    def test_instancia_no_disponible_notifica_error(self):
        rds = crear_rds([])
        rds.create_db_snapshot.side_effect = FalsoClientError(
            "InvalidDBInstanceState", "Instance is currently backing-up"
        )
        exc, sns = self.ejecutar_con_error(rds, error=RuntimeError)

        self.assertIn("no está disponible", str(exc))
        asunto, cuerpo = self.mensaje_sns(sns)
        self.assertIn("ERROR", asunto)
        self.assertEqual(cuerpo["estado"], "error")
        self.assertIn("backing-up", cuerpo["detalle"])
        self.assertEqual(cuerpo["codigo_aws"], "InvalidDBInstanceState")

    def test_error_de_aws_inesperado_notifica_y_relanza(self):
        rds = crear_rds([])
        rds.create_db_snapshot.side_effect = FalsoClientError("SnapshotQuotaExceeded")
        _, sns = self.ejecutar_con_error(rds, error=FalsoClientError)

        _, cuerpo = self.mensaje_sns(sns)
        self.assertEqual(cuerpo["codigo_aws"], "SnapshotQuotaExceeded")

    def test_falla_un_borrado_pero_el_respaldo_sigue_ok(self):
        rds = crear_rds([snap("buildcorp-auto7h-20261120-0000", 110)])
        rds.delete_db_snapshot.side_effect = FalsoClientError("InvalidDBSnapshotState")
        resultado, sns = self.ejecutar(rds)

        self.assertEqual(resultado["estado"], "ok")
        self.assertEqual(resultado["borrados"], [])
        self.assertEqual(len(resultado["errores_borrado"]), 1)
        sns.publish.assert_called_once()

    def test_sin_db_instance_id_es_error(self):
        rds = crear_rds([])
        env = {k: v for k, v in ENV.items() if k != "DB_INSTANCE_ID"}
        exc, sns = self.ejecutar_con_error(rds, env=env, error=ValueError)

        self.assertIn("DB_INSTANCE_ID", str(exc))
        rds.create_db_snapshot.assert_not_called()
        sns.publish.assert_called_once()

    def test_retencion_invalida_es_error(self):
        rds = crear_rds([])
        self.ejecutar_con_error(rds, env={**ENV, "RETENCION_HORAS": "0"}, error=ValueError)
        rds.create_db_snapshot.assert_not_called()

    def test_sin_sns_solo_registra_en_logs(self):
        rds = crear_rds([])
        env = {k: v for k, v in ENV.items() if k != "SNS_TOPIC_ARN"}
        resultado, sns = self.ejecutar(rds, env=env)

        self.assertEqual(resultado["estado"], "ok")
        sns.publish.assert_not_called()

    def test_fallo_de_sns_no_rompe_el_respaldo(self):
        rds = crear_rds([])
        sns = mock.MagicMock()
        sns.publish.side_effect = FalsoClientError("AuthorizationError")
        with mock.patch.dict(os.environ, ENV, clear=True), mock.patch.object(
            snapshot_rds, "_crear_clientes", return_value=(rds, sns)
        ):
            resultado = snapshot_rds.lambda_handler({}, None, ahora=AHORA)
        self.assertEqual(resultado["estado"], "ok")


if __name__ == "__main__":
    unittest.main()

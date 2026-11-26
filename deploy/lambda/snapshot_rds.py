"""Lambda de respaldo de BuildCorp: snapshot manual de RDS cada 7 horas.

Qué hace en cada ejecución (la dispara EventBridge Scheduler con rate(7 hours)):
1. Si ya hay un snapshot de la instancia en estado "creating", no crea otro.
2. Crea un snapshot manual llamado buildcorp-auto7h-AAAAMMDD-HHMM (hora UTC) con tags.
3. Borra los snapshots buildcorp-auto7h-* más antiguos que RETENCION_HORAS.
4. Publica el resultado (éxito, omitido o error con detalle) en el tópico SNS.

Variables de entorno:
    DB_INSTANCE_ID   identificador de la instancia RDS (obligatoria), ej. buildcorp-db
    SNS_TOPIC_ARN    ARN del tópico SNS para avisos (opcional: sin él solo escribe logs)
    RETENCION_HORAS  horas que se conservan los snapshots automáticos (default 72)

boto3 viene incluido en el runtime Python 3.12 de Lambda, por eso se importa
solo al crear los clientes: así los tests corren sin boto3 ni AWS.
"""

import json
import logging
import os
from datetime import datetime, timedelta, timezone

PREFIJO = "buildcorp-auto7h-"
RETENCION_DEFAULT = 72

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def _crear_clientes():
    """Devuelve (cliente_rds, cliente_sns). Los tests reemplazan esta función."""
    import boto3  # disponible en el runtime de Lambda

    return boto3.client("rds"), boto3.client("sns")


def _codigo_error(exc):
    """Código de un botocore ClientError (o None si es otro tipo de error)."""
    while exc is not None:
        respuesta = getattr(exc, "response", None) or {}
        codigo = respuesta.get("Error", {}).get("Code")
        if codigo:
            return codigo
        exc = exc.__cause__  # errores envueltos con "raise ... from exc"
    return None


def _leer_retencion():
    valor = os.environ.get("RETENCION_HORAS", "").strip()
    if not valor:
        return RETENCION_DEFAULT
    horas = int(valor)
    if horas <= 0:
        raise ValueError("RETENCION_HORAS debe ser un entero mayor que 0")
    return horas


def _listar_snapshots_manuales(rds, instancia):
    """Todos los snapshots manuales de la instancia (recorre la paginación)."""
    paginador = rds.get_paginator("describe_db_snapshots")
    snapshots = []
    for pagina in paginador.paginate(DBInstanceIdentifier=instancia, SnapshotType="manual"):
        snapshots.extend(pagina.get("DBSnapshots", []))
    return snapshots


def _snapshot_en_curso(rds, instancia):
    """Nombre del snapshot (manual o automático) que se está creando, o None."""
    paginador = rds.get_paginator("describe_db_snapshots")
    for pagina in paginador.paginate(DBInstanceIdentifier=instancia):
        for snap in pagina.get("DBSnapshots", []):
            if snap.get("Status") == "creating":
                return snap["DBSnapshotIdentifier"]
    return None


def _borrar_antiguos(rds, instancia, ahora, retencion_horas, excluir=None):
    """Borra los snapshots buildcorp-auto7h-* más viejos que la retención.

    Devuelve (borrados, errores). Solo toca snapshots con nuestro prefijo y en
    estado "available"; nunca los backups automáticos de RDS ni otros manuales.
    """
    limite = ahora - timedelta(hours=retencion_horas)
    borrados, errores = [], []
    for snap in _listar_snapshots_manuales(rds, instancia):
        nombre = snap["DBSnapshotIdentifier"]
        creado = snap.get("SnapshotCreateTime")
        if not nombre.startswith(PREFIJO) or nombre == excluir:
            continue
        if snap.get("Status") != "available" or creado is None:
            continue
        if creado.tzinfo is None:
            creado = creado.replace(tzinfo=timezone.utc)
        if creado >= limite:
            continue
        try:
            rds.delete_db_snapshot(DBSnapshotIdentifier=nombre)
            borrados.append(nombre)
        except Exception as exc:  # un borrado fallido no debe tumbar el respaldo
            logger.warning("No se pudo borrar %s: %s", nombre, exc)
            errores.append(f"{nombre}: {exc}")
    return borrados, errores


def _notificar(sns, topic_arn, asunto, resultado):
    if not topic_arn:
        logger.info("SNS_TOPIC_ARN vacío: no se envía aviso")
        return
    try:
        sns.publish(
            TopicArn=topic_arn,
            Subject=asunto[:100],  # SNS limita el asunto a 100 caracteres
            Message=json.dumps(resultado, ensure_ascii=False, indent=2, default=str),
        )
    except Exception as exc:
        logger.error("No se pudo publicar en SNS: %s", exc)


def lambda_handler(event, context, ahora=None):
    """Punto de entrada de Lambda (Handler: snapshot_rds.lambda_handler)."""
    ahora = ahora or datetime.now(timezone.utc)
    instancia = os.environ.get("DB_INSTANCE_ID", "").strip()
    topic_arn = os.environ.get("SNS_TOPIC_ARN", "").strip()
    rds, sns = _crear_clientes()

    resultado = {"instancia": instancia or None, "fecha_utc": ahora.isoformat()}
    try:
        if not instancia:
            raise ValueError("Falta la variable de entorno DB_INSTANCE_ID")
        retencion = _leer_retencion()
        resultado["retencion_horas"] = retencion

        en_curso = _snapshot_en_curso(rds, instancia)
        if en_curso:
            resultado.update(
                estado="omitido",
                motivo=f"Ya hay un snapshot en curso ({en_curso}); se reintenta en la próxima ejecución.",
            )
            borrados, errores = _borrar_antiguos(rds, instancia, ahora, retencion)
            resultado.update(borrados=borrados, errores_borrado=errores)
            logger.info(json.dumps(resultado, ensure_ascii=False, default=str))
            _notificar(sns, topic_arn, f"[BuildCorp] Respaldo omitido: {instancia}", resultado)
            return resultado

        nombre = PREFIJO + ahora.strftime("%Y%m%d-%H%M")
        try:
            rds.create_db_snapshot(
                DBSnapshotIdentifier=nombre,
                DBInstanceIdentifier=instancia,
                Tags=[
                    {"Key": "Proyecto", "Value": "BuildCorp"},
                    {"Key": "CreadoPor", "Value": "lambda-buildcorp-snapshot-7h"},
                    {"Key": "Frecuencia", "Value": "7h"},
                    {"Key": "RetencionHoras", "Value": str(retencion)},
                ],
            )
        except Exception as exc:
            codigo = _codigo_error(exc)
            if codigo == "DBSnapshotAlreadyExists":
                # Reintento de EventBridge dentro del mismo minuto: no es un error.
                resultado.update(estado="omitido", motivo=f"El snapshot {nombre} ya existe.")
                _notificar(sns, topic_arn, f"[BuildCorp] Respaldo omitido: {instancia}", resultado)
                return resultado
            if codigo == "InvalidDBInstanceState":
                # La instancia está en un backup automático, mantención o detenida.
                raise RuntimeError(
                    f"La instancia {instancia} no está disponible para snapshot "
                    f"(backup, mantención o detenida): {exc}"
                ) from exc
            raise

        borrados, errores = _borrar_antiguos(rds, instancia, ahora, retencion, excluir=nombre)
        resultado.update(estado="ok", snapshot=nombre, borrados=borrados, errores_borrado=errores)
        logger.info(json.dumps(resultado, ensure_ascii=False, default=str))
        _notificar(sns, topic_arn, f"[BuildCorp] Respaldo OK: {nombre}", resultado)
        return resultado

    except Exception as exc:
        resultado.update(
            estado="error",
            tipo_error=type(exc).__name__,
            codigo_aws=_codigo_error(exc),
            detalle=str(exc),
        )
        logger.error(json.dumps(resultado, ensure_ascii=False, default=str))
        _notificar(sns, topic_arn, f"[BuildCorp] ERROR en respaldo de {instancia or 'RDS'}", resultado)
        # Se relanza para que Lambda marque la ejecución como fallida (métricas de errores).
        raise

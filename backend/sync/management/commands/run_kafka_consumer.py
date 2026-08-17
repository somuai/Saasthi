import contextlib
import json
import logging
import time
import uuid

from accounts.models import User
from confluent_kafka import Consumer, KafkaError, KafkaException
from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import IntegrityError, transaction
from registry.models import Patient
from sync.models import SyncEvent
from sync.views import DELETES, UPSERTS, payload_hash, resolve_fk

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Runs the Kafka consumer for sync push events"

    def handle(self, *args, **options):
        conf = {
            "bootstrap.servers": getattr(settings, "KAFKA_BROKER_URL", "kafka:9092"),
            "group.id": "shaasthi_sync_processor",
            "auto.offset.reset": "earliest",
        }

        consumer = Consumer(conf)
        consumer.subscribe(["sync_push_events"])
        logger.info("Starting Kafka consumer for sync_push_events...")

        try:
            while True:
                msg = consumer.poll(timeout=1.0)
                if msg is None:
                    continue
                if msg.error():
                    if msg.error().code() == KafkaError._PARTITION_EOF:
                        continue
                    else:
                        raise KafkaException(msg.error())

                # Process message
                try:
                    payload = json.loads(msg.value().decode("utf-8"))
                    self.process_sync_payload(payload)
                except Exception:
                    logger.exception("Failed to process sync payload")

                consumer.commit(asynchronous=False)

        except KeyboardInterrupt:
            pass
        finally:
            consumer.close()

    def process_sync_payload(self, payload):
        client_id = payload.get("client_id")
        changes = payload.get("changes", [])
        user_id = payload.get("user_id")
        device_id = payload.get("device_id")

        user = None
        if user_id:
            with contextlib.suppress(User.DoesNotExist):
                user = User.objects.get(local_uuid=user_id)

        survey_upserted = False

        with transaction.atomic():
            for change in changes:
                event_uuid = change.get("event_uuid")
                local_uuid = str(change["local_uuid"])

                # Deterministic dedup key when no event_uuid is provided
                dedup_uuid = event_uuid or uuid.uuid5(
                    uuid.NAMESPACE_DNS,
                    f"sync:{change['model']}:{local_uuid}:{'del' if change['deleted'] else 'up'}",
                )

                event_defaults = {
                    "client_id": client_id,
                    "event_type": "delete" if change["deleted"] else "upsert",
                    "model_name": change["model"],
                    "object_local_uuid": local_uuid,
                    "payload_hash": payload_hash(change),
                    "actor": user,
                }
                if event_uuid:
                    event_defaults["local_uuid"] = event_uuid

                event, event_created = SyncEvent.objects.get_or_create(
                    local_uuid=dedup_uuid,
                    defaults=event_defaults,
                )
                if not event_created:
                    continue

                # Process the change
                try:
                    if change["deleted"]:
                        delete_fn = DELETES.get(change["model"])
                        if delete_fn:
                            delete_fn(local_uuid, user)
                        event.status = SyncEvent.Status.APPLIED
                        event.save(update_fields=["status"])
                    else:
                        # Resolve FK references before upsert
                        resolved_data = resolve_fk(change.get("data", {}), change["model"])
                        upsert_fn = UPSERTS.get(change["model"])
                        if not upsert_fn:
                            event.status = SyncEvent.Status.ERROR
                            event.message = f"No handler for {change['model']}"
                            event.save(update_fields=["status", "message"])
                            continue

                        upsert_fn(local_uuid, resolved_data, user)
                        if change["model"] == "survey_response":
                            survey_upserted = True

                        # Late Emergency Detection
                        if change["model"] in ("survey_response", "flag"):
                            created_at_ms = change.get("data", {}).get("created_at")
                            if created_at_ms:
                                offline_duration_sec = int(time.time()) - int(created_at_ms / 1000)
                                if offline_duration_sec > 300:  # 5 minutes late
                                    is_emergency = False
                                    severity = "HIGH"
                                    if (
                                        change["model"] == "flag"
                                        and change.get("data", {}).get("severity") == "critical"
                                    ):
                                        is_emergency = True
                                        severity = "CRITICAL"
                                    elif (
                                        change["model"] == "survey_response"
                                        and change.get("data", {}).get("computed_risk_level") == "high"
                                    ):
                                        is_emergency = True

                                    if is_emergency:
                                        patient_uuid = resolved_data.get("patient")
                                        if patient_uuid:
                                            try:
                                                patient_id = change.get("data", {}).get("patient_id")
                                                if patient_id:
                                                    patient = Patient.objects.get(local_uuid=patient_id)
                                                    household = patient.household
                                                    if household and household.lat and household.lng:
                                                        from dispatch.tasks import dispatch_emergency_task

                                                        dispatch_emergency_task.delay(
                                                            patient_lat=float(household.lat),
                                                            patient_lng=float(household.lng),
                                                            severity=severity,
                                                            household_id=household.pk,
                                                            triggered_by="sync_late",
                                                            is_delayed=True,
                                                            offline_duration_minutes=offline_duration_sec // 60,
                                                        )
                                            except Exception as e:
                                                logger.warning("Failed to trigger late emergency dispatch: %s", e)

                        event.status = SyncEvent.Status.APPLIED
                        event.save(update_fields=["status"])

                except PermissionError as exc:
                    event.status = SyncEvent.Status.ERROR
                    event.message = str(exc)
                    event.save(update_fields=["status", "message"])

                except Patient.DoesNotExist:
                    event.status = SyncEvent.Status.ERROR
                    event.message = "Referenced patient not found"
                    event.save(update_fields=["status", "message"])

                except (KeyError, ValueError, TypeError) as exc:
                    event.status = SyncEvent.Status.ERROR
                    event.message = f"Invalid data: {exc}"
                    event.save(update_fields=["status", "message"])

                except IntegrityError:
                    event.status = SyncEvent.Status.ERROR
                    event.message = "Database integrity error"
                    event.save(update_fields=["status", "message"])

                except Exception:
                    event.status = SyncEvent.Status.ERROR
                    event.message = "Internal server error"
                    event.save(update_fields=["status", "message"])
                    raise

        logger.info(
            "sync_push_done device_id=%s change_count=%d survey_upserted=%s", device_id, len(changes), survey_upserted
        )

        if user:
            from services.telemetry import track_event

            track_event(
                distinct_id=str(user.local_uuid),
                event_name="sync_push_completed",
                properties={
                    "device_id": device_id,
                    "change_count": len(changes),
                    "survey_upserted": survey_upserted,
                    "role": user.role,
                    "village": user.village,
                    "block": user.block,
                },
            )

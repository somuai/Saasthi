import json
import logging

from confluent_kafka import Producer
from django.conf import settings

logger = logging.getLogger(__name__)

_producer = None


def get_producer():
    global _producer
    if _producer is None:
        conf = {
            "bootstrap.servers": getattr(settings, "KAFKA_BROKER_URL", "kafka:9092"),
            "client.id": "shaasthi-backend-producer",
            "linger.ms": 10,
        }
        _producer = Producer(conf)
    return _producer


def produce_sync_event(payload, key=None):
    producer = get_producer()

    def delivery_report(err, msg):
        if err is not None:
            logger.error("Message delivery failed: %s", err)
        else:
            logger.debug("Message delivered to %s [%s]", msg.topic(), msg.partition())

    key_bytes = key.encode("utf-8") if key else None
    value_bytes = json.dumps(payload, default=str).encode("utf-8")

    producer.produce("sync_push_events", value=value_bytes, key=key_bytes, callback=delivery_report)
    producer.poll(0)

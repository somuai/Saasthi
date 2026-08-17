import json
import logging

import h3
from channels.generic.websocket import AsyncWebsocketConsumer
from django.utils import timezone

logger = logging.getLogger(__name__)

class LocationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope.get("user")
        if not self.user or not self.user.is_authenticated:
            await self.close()
            return

        self.is_supervisor = self.user.role in ["block_manager", "district_officer", "admin"]

        # Supervisors join a broadcast group
        if self.is_supervisor:
            self.group_name = f"supervisor_{self.user.block.pk if self.user.block else 'global'}"
            await self.channel_layer.group_add(self.group_name, self.channel_name)

        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        """
        Workers can push live location over WebSocket when in foreground.
        """
        if self.is_supervisor:
            return  # Supervisors only listen

        try:
            data = json.loads(text_data)
            lat = data.get("lat")
            lng = data.get("lng")
            if lat is None or lng is None:
                return

            h3_index = h3.latlng_to_cell(lat, lng, 8)

            # Broadcast to supervisor group (assume block-level for MVP)
            group_name = f"supervisor_{self.user.block.pk if self.user.block else 'global'}"
            await self.channel_layer.group_send(
                group_name,
                {
                    "type": "location_update",
                    "worker_id": self.user.pk,
                    "worker_name": self.user.full_name,
                    "lat": lat,
                    "lng": lng,
                    "h3_cell": h3_index,
                    "timestamp": timezone.now().isoformat(),
                }
            )

            # Optionally update redis cache here if needed,
            # but usually REST API handles background batch uploads.

        except Exception as e:
            logger.warning("Error processing websocket location: %s", e)

    async def location_update(self, event):
        """
        Send location update to supervisor dashboard.
        """
        await self.send(text_data=json.dumps(event))

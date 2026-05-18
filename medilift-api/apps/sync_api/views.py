from datetime import datetime, timezone

from django.db import transaction
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .registry import now_ms, pull_changes, push_changes


class SyncPullView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        since = int(request.query_params.get("last_pulled_at", 0))
        worker_id = str(request.user.id)
        changes = pull_changes(since, worker_id)
        return Response({"timestamp": now_ms(), "changes": changes})


class SyncPushView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        changes = request.data.get("changes") or {}
        worker_id = str(request.user.id)
        processed, errors = push_changes(changes, worker_id)
        return Response(
            {
                "processed": processed,
                "errors": errors,
                "timestamp": now_ms(),
            }
        )

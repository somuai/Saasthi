"""
Visit State Machine — Explicit state transitions with audit logging.

Uber equivalent: Trip State Machine ensuring valid lifecycle transitions.
"""

import logging

from django.db import transaction
from django.utils import timezone

logger = logging.getLogger(__name__)


class InvalidStateTransitionError(Exception):
    """Raised when an invalid visit state transition is attempted."""

    def __init__(self, from_state: str, to_state: str, visit_id: int | None = None):
        self.from_state = from_state
        self.to_state = to_state
        self.visit_id = visit_id
        msg = f"Invalid transition: {from_state} → {to_state}"
        if visit_id:
            msg = f"Visit {visit_id}: {msg}"
        super().__init__(msg)


# Explicit state transition graph
VALID_TRANSITIONS: dict[str, list[str]] = {
    "SCHEDULED": ["EN_ROUTE", "SKIPPED"],
    "EN_ROUTE": ["ARRIVED", "SKIPPED"],
    "ARRIVED": ["IN_PROGRESS"],
    "IN_PROGRESS": ["COMPLETED", "EMERGENCY"],
    "EMERGENCY": ["DISPATCH_SENT"],
    "DISPATCH_SENT": ["COMPLETED", "REFERRED"],
    "COMPLETED": ["VERIFIED", "FLAGGED"],
    "FLAGGED": ["REVIEW"],
    "REVIEW": [],  # Terminal
    "VERIFIED": [],  # Terminal
    "SKIPPED": [],  # Terminal
    "REFERRED": [],  # Terminal
}

TERMINAL_STATES = {state for state, nexts in VALID_TRANSITIONS.items() if not nexts}


def is_valid_transition(from_state: str, to_state: str) -> bool:
    """Check if a state transition is valid."""
    return to_state in VALID_TRANSITIONS.get(from_state, [])


def is_terminal_state(state: str) -> bool:
    """Check if a state is terminal (no further transitions allowed)."""
    return state in TERMINAL_STATES


def transition_visit(visit, new_state: str, actor=None, metadata: dict | None = None):
    """
    Atomically transition a visit to a new state with audit logging.

    Args:
        visit: FollowUp model instance
        new_state: Target state string
        actor: User performing the transition (or None for system)
        metadata: Optional dict of contextual data to log

    Returns:
        The updated visit instance

    Raises:
        InvalidStateTransitionError: If the transition is not valid
    """
    from dispatch.models import VisitStateLog

    current_state = getattr(visit, "visit_state", "SCHEDULED")

    if not is_valid_transition(current_state, new_state):
        raise InvalidStateTransitionError(current_state, new_state, visit_id=visit.pk)

    with transaction.atomic():
        old_state = current_state
        visit.visit_state = new_state
        visit.updated_at = timezone.now()
        visit.save(update_fields=["visit_state", "updated_at"])

        VisitStateLog.objects.create(
            visit=visit,
            from_state=old_state,
            to_state=new_state,
            actor=actor,
            metadata=metadata or {},
        )

        logger.info(
            "Visit %s transitioned: %s → %s (actor=%s)",
            visit.pk,
            old_state,
            new_state,
            actor.pk if actor else "system",
        )

    # Side effects are now triggered asynchronously via Django signals on VisitStateLog
    # See dispatch/signals.py

    return visit

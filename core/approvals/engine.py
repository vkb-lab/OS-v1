from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from core.connectors.registry import RiskLevel, get_connector

APPROVALS: list[dict] = []


def evaluate_action(connector_id: str, action_name: str, payload: dict | None = None) -> dict:
    connector = get_connector(connector_id)
    if connector is None:
        return {
            "allowed": False,
            "status": "rejected",
            "reason": "connector_not_found",
        }

    action = next((item for item in connector.actions if item.name == action_name), None)
    if action is None:
        return {
            "allowed": False,
            "status": "rejected",
            "reason": "action_not_supported",
        }

    if action.requires_approval or action.risk in {RiskLevel.HIGH, RiskLevel.CRITICAL}:
        approval = {
            "id": str(uuid4()),
            "connector_id": connector_id,
            "action": action_name,
            "risk": action.risk,
            "status": "pending",
            "payload": payload or {},
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        APPROVALS.insert(0, approval)
        return {
            "allowed": False,
            "status": "approval_required",
            "approval": approval,
        }

    return {
        "allowed": True,
        "status": "allowed",
        "risk": action.risk,
    }


def list_approvals() -> list[dict]:
    return APPROVALS

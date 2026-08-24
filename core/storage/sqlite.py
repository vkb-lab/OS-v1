from __future__ import annotations

import json
import os
import sqlite3
from pathlib import Path


class TaskStore:
    def __init__(self, path: str | None = None) -> None:
        configured = path or os.getenv("KOS_DATABASE_PATH", "data/kos.db")
        self.path = Path(configured)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.path)
        connection.row_factory = sqlite3.Row
        return connection

    def _initialize(self) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS tasks (
                    id TEXT PRIMARY KEY,
                    command TEXT NOT NULL,
                    project TEXT NOT NULL,
                    status TEXT NOT NULL,
                    assigned_agent TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    payload_json TEXT NOT NULL DEFAULT '{}'
                )
                """
            )

    def list(self, limit: int = 200) -> list[dict]:
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT * FROM tasks ORDER BY created_at DESC LIMIT ?", (limit,)
            ).fetchall()
        return [
            {
                "id": row["id"],
                "command": row["command"],
                "project": row["project"],
                "status": row["status"],
                "assigned_agent": row["assigned_agent"],
                "created_at": row["created_at"],
                "payload": json.loads(row["payload_json"]),
            }
            for row in rows
        ]

    def insert(self, task: dict) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO tasks
                (id, command, project, status, assigned_agent, created_at, payload_json)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    task["id"], task["command"], task["project"], task["status"],
                    task["assigned_agent"], task["created_at"],
                    json.dumps(task.get("payload", {}), ensure_ascii=False),
                ),
            )

    def update_status(self, task_id: str, status: str) -> dict | None:
        with self._connect() as connection:
            result = connection.execute(
                "UPDATE tasks SET status = ? WHERE id = ?", (status, task_id)
            )
            if result.rowcount == 0:
                return None
            row = connection.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
        return dict(row) if row else None

    def health(self) -> dict:
        with self._connect() as connection:
            count = connection.execute("SELECT COUNT(*) FROM tasks").fetchone()[0]
        return {"engine": "sqlite", "path": str(self.path), "tasks": count}

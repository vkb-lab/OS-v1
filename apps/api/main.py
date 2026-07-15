from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from core.approvals.engine import evaluate_action, list_approvals
from core.connectors.registry import get_connector, list_connectors

app = FastAPI(title="K-OS Cloud Pro API", version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

DASHBOARD_FILE = Path(__file__).resolve().parents[1] / "dashboard" / "index.html"

AGENTS = [
    {"id": "ORQ-001", "name": "Orquestrador", "status": "online", "role": "Coordena tarefas"},
    {"id": "MEM-001", "name": "Memória", "status": "online", "role": "Mantém contexto"},
    {"id": "AUD-001", "name": "Auditor", "status": "standby", "role": "Valida risco"},
    {"id": "VAL-001", "name": "Validador", "status": "standby", "role": "Confere resultados"},
    {"id": "DEV-001", "name": "Programador", "status": "standby", "role": "Executa tarefas de código"},
]

TASKS: list[dict] = []


class CommandIn(BaseModel):
    text: str = Field(min_length=3, max_length=4000)
    project: str = Field(default="OS-v1", min_length=1, max_length=120)


class ActionEvaluationIn(BaseModel):
    connector_id: str = Field(min_length=1, max_length=80)
    action: str = Field(min_length=1, max_length=120)
    payload: dict = Field(default_factory=dict)


@app.get("/", include_in_schema=False)
def dashboard() -> FileResponse:
    if not DASHBOARD_FILE.exists():
        raise HTTPException(status_code=404, detail="Dashboard não encontrado")
    return FileResponse(DASHBOARD_FILE)


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "service": "kos-api",
        "version": app.version,
        "time": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/api/agents")
def agents() -> list[dict]:
    return AGENTS


@app.get("/api/connectors")
def connectors() -> list[dict]:
    return list_connectors()


@app.get("/api/connectors/{connector_id}")
def connector(connector_id: str) -> dict:
    definition = get_connector(connector_id)
    if definition is None:
        raise HTTPException(status_code=404, detail="Conector não encontrado")
    return definition.public_dict()


@app.get("/api/approvals")
def approvals() -> list[dict]:
    return list_approvals()


@app.post("/api/actions/evaluate")
def evaluate_connector_action(request: ActionEvaluationIn) -> dict:
    return evaluate_action(request.connector_id, request.action, request.payload)


@app.get("/api/tasks")
def tasks() -> list[dict]:
    return TASKS


@app.post("/api/commands", status_code=202)
def create_command(command: CommandIn) -> dict:
    task = {
        "id": str(uuid4()),
        "command": command.text.strip(),
        "project": command.project.strip(),
        "status": "queued",
        "assigned_agent": "ORQ-001",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    TASKS.insert(0, task)
    return task

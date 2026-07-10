from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

app = FastAPI(title="K-OS Cloud Pro API", version="0.1.0")
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

CONNECTORS = [
    {"id": "github", "name": "GitHub", "status": "connected"},
    {"id": "gcp", "name": "Google Cloud", "status": "connected"},
    {"id": "ollama", "name": "Ollama", "status": "pending"},
    {"id": "render", "name": "Render", "status": "pending"},
    {"id": "whatsapp", "name": "WhatsApp", "status": "pending"},
    {"id": "instagram", "name": "Instagram", "status": "pending"},
]

TASKS: list[dict] = []


class CommandIn(BaseModel):
    text: str = Field(min_length=3, max_length=4000)
    project: str = Field(default="OS-v1", min_length=1, max_length=120)


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
    return CONNECTORS


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

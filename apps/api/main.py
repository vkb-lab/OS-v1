from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime, timezone
from uuid import uuid4

app = FastAPI(title="K-OS Cloud Pro API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    text: str
    project: str = "OS-v1"

@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "kos-api", "time": datetime.now(timezone.utc).isoformat()}

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
        "project": command.project,
        "status": "queued",
        "assigned_agent": "ORQ-001",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    TASKS.insert(0, task)
    return task

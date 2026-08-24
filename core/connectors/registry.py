from __future__ import annotations

from dataclasses import asdict, dataclass
from enum import StrEnum
from os import getenv
from typing import Callable


class RiskLevel(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass(frozen=True)
class ConnectorAction:
    name: str
    description: str
    risk: RiskLevel
    requires_approval: bool = False


@dataclass(frozen=True)
class ConnectorDefinition:
    id: str
    name: str
    runtime: str
    credential_env: str | None
    actions: tuple[ConnectorAction, ...]
    healthcheck: Callable[[], tuple[str, str]]

    def public_dict(self) -> dict:
        status, detail = self.healthcheck()
        return {
            "id": self.id,
            "name": self.name,
            "runtime": self.runtime,
            "status": status,
            "detail": detail,
            "credential_env": self.credential_env,
            "actions": [asdict(action) for action in self.actions],
        }


def _env_healthcheck(variable: str, pending_detail: str) -> Callable[[], tuple[str, str]]:
    def check() -> tuple[str, str]:
        if getenv(variable):
            return "configured", f"Credencial {variable} carregada no runtime."
        return "pending", pending_detail

    return check


def _local_healthcheck() -> tuple[str, str]:
    enabled = getenv("KOS_LOCAL_WORKER_ENABLED", "false").lower() == "true"
    if enabled:
        return "configured", "Worker local habilitado."
    return "pending", "Instale e habilite o worker local antes de executar ações no Windows."


CONNECTOR_REGISTRY: dict[str, ConnectorDefinition] = {
    "github": ConnectorDefinition(
        id="github",
        name="GitHub",
        runtime="cloud",
        credential_env="KOS_GITHUB_TOKEN",
        healthcheck=_env_healthcheck(
            "KOS_GITHUB_TOKEN",
            "O ChatGPT possui acesso ao repositório, mas o runtime do K-OS ainda precisa de credencial própria.",
        ),
        actions=(
            ConnectorAction("read_repository", "Ler metadados e conteúdo", RiskLevel.LOW),
            ConnectorAction("create_branch", "Criar branch de trabalho", RiskLevel.MEDIUM),
            ConnectorAction("commit_files", "Criar ou alterar arquivos", RiskLevel.HIGH, True),
            ConnectorAction("open_pull_request", "Abrir pull request", RiskLevel.MEDIUM),
            ConnectorAction("merge_pull_request", "Mesclar pull request", RiskLevel.CRITICAL, True),
            ConnectorAction("delete_branch", "Excluir branch", RiskLevel.CRITICAL, True),
        ),
    ),
    "filesystem": ConnectorDefinition(
        id="filesystem",
        name="Filesystem local",
        runtime="local-worker",
        credential_env=None,
        healthcheck=_local_healthcheck,
        actions=(
            ConnectorAction("list_files", "Listar arquivos autorizados", RiskLevel.LOW),
            ConnectorAction("read_file", "Ler arquivo autorizado", RiskLevel.LOW),
            ConnectorAction("create_folder", "Criar pasta", RiskLevel.MEDIUM),
            ConnectorAction("move_file", "Mover arquivo", RiskLevel.HIGH, True),
            ConnectorAction("delete_file", "Excluir arquivo", RiskLevel.CRITICAL, True),
        ),
    ),
    "powershell": ConnectorDefinition(
        id="powershell",
        name="PowerShell local",
        runtime="local-worker",
        credential_env=None,
        healthcheck=_local_healthcheck,
        actions=(
            ConnectorAction("inspect_processes", "Consultar processos", RiskLevel.LOW),
            ConnectorAction("run_readonly", "Executar comando somente leitura", RiskLevel.MEDIUM),
            ConnectorAction("run_mutation", "Executar comando que altera o sistema", RiskLevel.CRITICAL, True),
        ),
    ),
}


def list_connectors() -> list[dict]:
    return [definition.public_dict() for definition in CONNECTOR_REGISTRY.values()]


def get_connector(connector_id: str) -> ConnectorDefinition | None:
    return CONNECTOR_REGISTRY.get(connector_id)

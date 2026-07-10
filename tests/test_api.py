from fastapi.testclient import TestClient

from apps.api.main import TASKS, app
from core.approvals.engine import APPROVALS

client = TestClient(app)


def test_dashboard_route() -> None:
    response = client.get('/')
    assert response.status_code == 200
    assert 'K-OS Cloud Pro' in response.text


def test_health() -> None:
    response = client.get('/health')
    assert response.status_code == 200
    assert response.json()['status'] == 'ok'
    assert response.json()['version'] == '0.2.0'


def test_lists_agents_and_connectors() -> None:
    agents = client.get('/api/agents')
    connectors = client.get('/api/connectors')
    assert agents.status_code == 200
    assert connectors.status_code == 200
    assert any(item['id'] == 'ORQ-001' for item in agents.json())
    assert any(item['id'] == 'github' for item in connectors.json())
    assert any(item['id'] == 'filesystem' for item in connectors.json())


def test_connector_exposes_actions_and_runtime_status() -> None:
    response = client.get('/api/connectors/github')
    assert response.status_code == 200
    body = response.json()
    assert body['runtime'] == 'cloud'
    assert body['status'] in {'pending', 'configured'}
    assert any(action['name'] == 'open_pull_request' for action in body['actions'])


def test_unknown_connector_returns_404() -> None:
    response = client.get('/api/connectors/unknown')
    assert response.status_code == 404


def test_low_risk_action_is_allowed() -> None:
    response = client.post(
        '/api/actions/evaluate',
        json={'connector_id': 'github', 'action': 'read_repository', 'payload': {}},
    )
    assert response.status_code == 200
    assert response.json()['allowed'] is True


def test_high_risk_action_creates_approval() -> None:
    APPROVALS.clear()
    response = client.post(
        '/api/actions/evaluate',
        json={
            'connector_id': 'github',
            'action': 'commit_files',
            'payload': {'repository': 'vkb-lab/OS-v1'},
        },
    )
    assert response.status_code == 200
    assert response.json()['status'] == 'approval_required'

    approvals = client.get('/api/approvals')
    assert approvals.status_code == 200
    assert len(approvals.json()) == 1
    assert approvals.json()[0]['action'] == 'commit_files'


def test_create_command() -> None:
    response = client.post('/api/commands', json={'text': 'Audite o projeto', 'project': 'OS-v1'})
    assert response.status_code == 202
    body = response.json()
    assert body['status'] == 'queued'
    assert body['assigned_agent'] == 'ORQ-001'


def test_created_command_appears_in_task_queue() -> None:
    TASKS.clear()
    command = 'Valide a fila do dashboard'
    response = client.post('/api/commands', json={'text': command, 'project': 'OS-v1'})
    assert response.status_code == 202

    tasks = client.get('/api/tasks')
    assert tasks.status_code == 200
    assert any(item['id'] == response.json()['id'] and item['command'] == command for item in tasks.json())


def test_rejects_short_command() -> None:
    response = client.post('/api/commands', json={'text': 'oi'})
    assert response.status_code == 422

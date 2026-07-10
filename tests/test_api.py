from fastapi.testclient import TestClient

from apps.api.main import app

client = TestClient(app)


def test_health() -> None:
    response = client.get('/health')
    assert response.status_code == 200
    assert response.json()['status'] == 'ok'


def test_lists_agents_and_connectors() -> None:
    agents = client.get('/api/agents')
    connectors = client.get('/api/connectors')
    assert agents.status_code == 200
    assert connectors.status_code == 200
    assert any(item['id'] == 'ORQ-001' for item in agents.json())
    assert any(item['id'] == 'github' for item in connectors.json())


def test_create_command() -> None:
    response = client.post('/api/commands', json={'text': 'Audite o projeto', 'project': 'OS-v1'})
    assert response.status_code == 202
    body = response.json()
    assert body['status'] == 'queued'
    assert body['assigned_agent'] == 'ORQ-001'


def test_rejects_short_command() -> None:
    response = client.post('/api/commands', json={'text': 'oi'})
    assert response.status_code == 422

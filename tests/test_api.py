from fastapi.testclient import TestClient

from apps.api.main import app
from core.approvals.engine import APPROVALS

client = TestClient(app)


def test_dashboard_route() -> None:
    response = client.get('/')
    assert response.status_code == 200
    assert 'K-OS Cloud Pro' in response.text


def test_health_reports_persistent_storage() -> None:
    response = client.get('/health')
    assert response.status_code == 200
    assert response.json()['status'] == 'ok'
    assert response.json()['version'] == '0.3.0'
    assert response.json()['storage']['engine'] == 'sqlite'


def test_lists_agents_and_connectors() -> None:
    agents = client.get('/api/agents')
    connectors = client.get('/api/connectors')
    assert agents.status_code == 200
    assert connectors.status_code == 200
    assert any(item['id'] == 'ORQ-001' for item in agents.json())
    assert any(item['id'] == 'github' for item in connectors.json())


def test_connector_exposes_actions_and_runtime_status() -> None:
    response = client.get('/api/connectors/github')
    assert response.status_code == 200
    assert response.json()['status'] in {'pending', 'configured'}
    assert any(action['name'] == 'open_pull_request' for action in response.json()['actions'])


def test_unknown_connector_returns_404() -> None:
    assert client.get('/api/connectors/unknown').status_code == 404


def test_low_risk_action_is_allowed() -> None:
    response = client.post('/api/actions/evaluate', json={'connector_id':'github','action':'read_repository','payload':{}})
    assert response.status_code == 200
    assert response.json()['allowed'] is True


def test_high_risk_action_creates_approval() -> None:
    APPROVALS.clear()
    response = client.post('/api/actions/evaluate',json={'connector_id':'github','action':'commit_files','payload':{'repository':'vkb-lab/OS-v1'}})
    assert response.status_code == 200
    assert response.json()['status'] == 'approval_required'
    assert client.get('/api/approvals').json()[0]['action'] == 'commit_files'


def test_command_is_persisted_and_status_can_change() -> None:
    response = client.post('/api/commands',json={'text':'Audite o projeto','project':'OS-v1','payload':{'source':'test'}})
    assert response.status_code == 202
    task = response.json()
    assert task['assigned_agent'] == 'ORQ-001'
    assert any(item['id'] == task['id'] for item in client.get('/api/tasks').json())
    updated = client.patch(f"/api/tasks/{task['id']}",json={'status':'running'})
    assert updated.status_code == 200
    assert updated.json()['status'] == 'running'


def test_rejects_short_command_and_invalid_status() -> None:
    assert client.post('/api/commands',json={'text':'oi'}).status_code == 422
    assert client.patch('/api/tasks/missing',json={'status':'unknown'}).status_code == 422

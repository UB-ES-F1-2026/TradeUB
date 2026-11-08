"""Test HTTP de GET /api/v1/health."""


def test_health_returns_ok(client):
    """L'endpoint es public i respon que el servei esta viu."""
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

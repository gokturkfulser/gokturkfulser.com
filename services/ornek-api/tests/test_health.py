import json
import logging

from fastapi.testclient import TestClient

from app.config import Settings
from app.logging import JsonFormatter
from app.main import app

client = TestClient(app)


def test_health_ok():
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "ornek-api"


def test_settings_from_env(monkeypatch):
    monkeypatch.setenv("APP_NAME", "baska")
    monkeypatch.setenv("PORT", "9000")
    settings = Settings()
    assert settings.app_name == "baska"
    assert settings.port == 9000


def test_json_log_line():
    record = logging.LogRecord("t", logging.INFO, __file__, 1, "merhaba %s", ("dünya",), None)
    record.istek_id = "abc"
    line = JsonFormatter().format(record)
    data = json.loads(line)
    assert data["message"] == "merhaba dünya"
    assert data["level"] == "INFO"
    assert data["istek_id"] == "abc"

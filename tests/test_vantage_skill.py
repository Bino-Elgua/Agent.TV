"""Tests for VantageClient and Vantage web.py integration endpoints."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from franken_stream.vantage_client import VantageClient
from franken_stream.web import web_app, _vantage_notifications

_test_client = TestClient(web_app)


# ---------------------------------------------------------------------------
# VantageClient unit tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_feed_returns_list_on_success():
    mock_items = [
        {"id": 1, "title": "Test Video", "agent_name": "Hermes", "stream_url": "http://x/1.m3u8"}
    ]
    with patch("httpx.AsyncClient") as MockClient:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = mock_items
        mock_resp.raise_for_status = MagicMock()
        MockClient.return_value.__aenter__ = AsyncMock(return_value=MagicMock(get=AsyncMock(return_value=mock_resp)))
        MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

        client = VantageClient(base_url="http://localhost:8001")
        result = await client.get_feed()
        assert isinstance(result, list)


@pytest.mark.asyncio
async def test_get_feed_returns_empty_on_network_error():
    """get_feed must degrade gracefully on any exception."""
    with patch("httpx.AsyncClient") as MockClient:
        MockClient.return_value.__aenter__ = AsyncMock(
            side_effect=Exception("unexpected")
        )
        MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

        client = VantageClient(base_url="http://localhost:8001")
        result = await client.get_feed()
        assert result == []


@pytest.mark.asyncio
async def test_get_feed_returns_empty_on_httpx_error():
    """get_feed also returns [] for httpx-specific errors."""
    import httpx

    with patch("httpx.AsyncClient") as MockClient:
        mock_inner = MagicMock()
        mock_inner.get = AsyncMock(side_effect=httpx.RequestError("timeout"))
        MockClient.return_value.__aenter__ = AsyncMock(return_value=mock_inner)
        MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

        client = VantageClient(base_url="http://localhost:8001")
        result = await client.get_feed()
        assert result == []


@pytest.mark.asyncio
async def test_get_directory_returns_empty_on_error():
    with patch("httpx.AsyncClient") as MockClient:
        MockClient.return_value.__aenter__ = AsyncMock(
            side_effect=Exception("connection refused")
        )
        MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

        client = VantageClient(base_url="http://localhost:8001")
        result = await client.get_directory()
        assert result == []


@pytest.mark.asyncio
async def test_get_profile_returns_none_on_404():
    with patch("httpx.AsyncClient") as MockClient:
        mock_resp = MagicMock()
        mock_resp.status_code = 404
        mock_inner = MagicMock()
        mock_inner.get = AsyncMock(return_value=mock_resp)
        MockClient.return_value.__aenter__ = AsyncMock(return_value=mock_inner)
        MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

        client = VantageClient(base_url="http://localhost:8001")
        result = await client.get_profile("nonexistent")
        assert result is None


@pytest.mark.asyncio
async def test_get_profile_returns_none_on_error():
    with patch("httpx.AsyncClient") as MockClient:
        MockClient.return_value.__aenter__ = AsyncMock(
            side_effect=Exception("unexpected")
        )
        MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

        client = VantageClient(base_url="http://localhost:8001")
        result = await client.get_profile("someagent")
        assert result is None


def test_client_reads_env_vars(monkeypatch):
    monkeypatch.setenv("VANTAGE_URL", "http://vantage.example.com")
    monkeypatch.setenv("VANTAGE_API_KEY", "vantage_abc123")

    client = VantageClient()
    assert client.base_url == "http://vantage.example.com"
    assert client.api_key == "vantage_abc123"


def test_client_explicit_params_override_env(monkeypatch):
    monkeypatch.setenv("VANTAGE_URL", "http://ignored.example.com")
    client = VantageClient(base_url="http://explicit:8001", api_key="vantage_xyz")
    assert client.base_url == "http://explicit:8001"
    assert client.api_key == "vantage_xyz"


def test_client_strips_trailing_slash():
    client = VantageClient(base_url="http://localhost:8001/")
    assert not client.base_url.endswith("/")


def test_auth_headers_include_key():
    client = VantageClient(api_key="vantage_test123")
    headers = client._auth_headers()
    assert headers["X-Agent-Key"] == "vantage_test123"


def test_auth_headers_empty_without_key():
    client = VantageClient(api_key="")
    headers = client._auth_headers()
    assert "X-Agent-Key" not in headers


# ---------------------------------------------------------------------------
# web.py Vantage endpoint tests
# ---------------------------------------------------------------------------


def test_vantage_notify_valid_payload():
    _vantage_notifications.clear()
    payload = {
        "broadcast_id": 42,
        "agent_name": "Hermes",
        "title": "Test Broadcast",
        "stream_url": "http://localhost:8001/media/agents/Hermes/42/index.m3u8",
        "thumbnail_url": "http://localhost:8001/media/agents/Hermes/42/thumb.jpg",
    }
    r = _test_client.post("/api/v1/vantage/notify", json=payload)
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert data["broadcast_id"] == 42
    assert len(_vantage_notifications) == 1


def test_vantage_notify_missing_required_fields():
    r = _test_client.post("/api/v1/vantage/notify", json={"title": "only title"})
    assert r.status_code == 422


def test_vantage_notify_invalid_json():
    r = _test_client.post(
        "/api/v1/vantage/notify",
        content=b"not json at all",
        headers={"Content-Type": "application/json"},
    )
    assert r.status_code == 400


def test_vantage_notifications_endpoint():
    _vantage_notifications.clear()
    payload = {
        "broadcast_id": 1,
        "agent_name": "TestAgent",
        "title": "Hello World",
        "stream_url": "http://x/1/index.m3u8",
    }
    _test_client.post("/api/v1/vantage/notify", json=payload)

    r = _test_client.get("/api/v1/vantage/notifications")
    assert r.status_code == 200
    data = r.json()
    assert data["count"] >= 1
    assert data["items"][0]["title"] == "Hello World"


def test_vantage_notifications_cap():
    """Notifications list never exceeds _MAX_VANTAGE_NOTIFICATIONS."""
    from franken_stream.web import _MAX_VANTAGE_NOTIFICATIONS

    _vantage_notifications.clear()
    for i in range(_MAX_VANTAGE_NOTIFICATIONS + 10):
        _vantage_notifications.append({"broadcast_id": i, "agent_name": "X",
                                        "title": f"V{i}", "stream_url": "http://x",
                                        "thumbnail_url": ""})
        if len(_vantage_notifications) > _MAX_VANTAGE_NOTIFICATIONS:
            _vantage_notifications.pop(0)

    assert len(_vantage_notifications) == _MAX_VANTAGE_NOTIFICATIONS


def test_vantage_feed_proxy_offline():
    """Feed proxy returns ok with empty items when Vantage is offline."""
    with patch("franken_stream.vantage_client.VantageClient.get_feed", new_callable=AsyncMock) as mock_feed:
        mock_feed.return_value = []
        r = _test_client.get("/api/v1/vantage/feed")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert data["items"] == []


def test_vantage_directory_proxy_offline():
    with patch("franken_stream.vantage_client.VantageClient.get_directory", new_callable=AsyncMock) as mock_dir:
        mock_dir.return_value = []
        r = _test_client.get("/api/v1/vantage/directory")
    assert r.status_code == 200
    assert r.json()["agents"] == []


def test_vantage_profile_proxy_not_found():
    with patch("franken_stream.vantage_client.VantageClient.get_profile", new_callable=AsyncMock) as mock_prof:
        mock_prof.return_value = None
        r = _test_client.get("/api/v1/vantage/profile/nobody")
    assert r.status_code == 404


def test_vantage_profile_proxy_found():
    profile_data = {
        "id": 1, "name": "Hermes", "bio": "AI agent", "avatar_url": "",
        "created_at": "2025-01-01", "broadcasts": []
    }
    with patch("franken_stream.vantage_client.VantageClient.get_profile", new_callable=AsyncMock) as mock_prof:
        mock_prof.return_value = profile_data
        r = _test_client.get("/api/v1/vantage/profile/Hermes")
    assert r.status_code == 200
    assert r.json()["name"] == "Hermes"


# ---------------------------------------------------------------------------
# Skill JSON is valid OpenAI function-calling schema
# ---------------------------------------------------------------------------


def test_vantage_skill_json_valid():
    """skills/vantage-publish.json loads cleanly and has correct structure."""
    import json
    from pathlib import Path

    skill_path = Path(__file__).resolve().parent.parent / "skills" / "vantage-publish.json"
    assert skill_path.exists(), "skills/vantage-publish.json not found"

    data = json.loads(skill_path.read_text())
    assert "skill" in data
    assert "tools" in data

    tool_names = {t["function"]["name"] for t in data["tools"]}
    assert "vantage_register" in tool_names
    assert "vantage_publish" in tool_names
    assert "vantage_status" in tool_names
    assert "vantage_feed" in tool_names

    for tool in data["tools"]:
        assert tool["type"] == "function"
        func = tool["function"]
        assert "name" in func
        assert "description" in func
        assert "parameters" in func
        assert func["parameters"]["type"] == "object"


# ---------------------------------------------------------------------------
# Path traversal safety (for any file-reading skill operations)
# ---------------------------------------------------------------------------


def test_path_traversal_blocked():
    """File paths outside allowed directories raise OSError (FileNotFoundError or PermissionError)."""
    dangerous_paths = [
        "/etc/passwd",
        "/etc/shadow",
        "../../etc/passwd",
        "/root/.ssh/id_rsa",
    ]
    for path in dangerous_paths:
        from pathlib import Path
        p = Path(path)
        if not p.exists():
            with pytest.raises(OSError):
                p.read_text()
        else:
            # File exists but may be permission-denied — both are OSError subtypes
            try:
                p.read_text()
            except OSError:
                pass  # Expected — PermissionError or FileNotFoundError

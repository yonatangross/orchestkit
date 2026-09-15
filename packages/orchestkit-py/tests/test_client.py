from __future__ import annotations

import json
from io import BytesIO
from unittest.mock import patch

import pytest

from orchestkit import ApiError, create_client, read_doc, search
from orchestkit.client import DEFAULT_BASE_URL


class _FakeHeaders(dict):
    def get(self, key, default=None):
        for k, v in self.items():
            if k.lower() == key.lower():
                return v
        return default


class _FakeResponse:
    def __init__(self, body: bytes, headers: dict[str, str], status: int = 200) -> None:
        self._body = body
        self.headers = _FakeHeaders(headers)
        self.status = status

    def read(self) -> bytes:
        return self._body

    def __enter__(self) -> _FakeResponse:
        return self

    def __exit__(self, *args: object) -> None:
        return None


def test_create_client_strips_trailing_slashes() -> None:
    c = create_client(base_url="https://example.test///")
    assert c.base_url == "https://example.test"


def test_create_client_default_is_product_domain() -> None:
    c = create_client()
    assert c.base_url == DEFAULT_BASE_URL


def test_search_parses_results_and_ratelimit() -> None:
    payload = {"results": [{"id": "a", "url": "https://orchestkit.yonyon.ai/x", "title": "X"}]}
    headers = {
        "content-type": "application/json",
        "ratelimit-limit": "120",
        "ratelimit-remaining": "119",
        "ratelimit-reset": "60",
    }

    def opener(req, timeout=None):
        assert "/api/search?" in req.full_url
        assert req.get_header("User-agent") or req.get_header("User-Agent")
        return _FakeResponse(json.dumps(payload).encode(), headers)

    with patch("orchestkit.client.urllib.request.urlopen", opener):
        hits, rl = search(create_client(), "hooks", limit=3)
    assert hits[0].id == "a"
    assert rl.limit == 120
    assert rl.remaining == 119


def test_read_doc_normalizes_slug() -> None:
    captured: list[str] = []

    def opener(req, timeout=None):
        captured.append(req.full_url)
        return _FakeResponse(b"# hi", {"content-type": "text/markdown"})

    with patch("orchestkit.client.urllib.request.urlopen", opener):
        text, _rl = read_doc(create_client(base_url="https://ex.test"), "foundations/overview.md")
    assert text == "# hi"
    assert captured[0] == "https://ex.test/docs/foundations/overview.md"


def test_api_error_from_problem_json() -> None:
    import urllib.error

    def opener(req, timeout=None):
        raise urllib.error.HTTPError(
            req.full_url,
            404,
            "Not Found",
            _FakeHeaders({"content-type": "application/json"}),
            BytesIO(json.dumps({"title": "gone", "detail": "missing", "status": 404}).encode()),
        )

    with patch("orchestkit.client.urllib.request.urlopen", opener):
        with pytest.raises(ApiError) as ei:
            search(create_client(base_url="https://ex.test"), "x")
    assert ei.value.status == 404
    assert ei.value.problem.detail == "missing"

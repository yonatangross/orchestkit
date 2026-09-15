"""urllib client for https://orchestkit.yonyon.ai (search, ask, read)."""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any

DEFAULT_BASE_URL = "https://orchestkit.yonyon.ai"
USER_AGENT = "orchestkit-py/0.1.0"


@dataclass(frozen=True)
class Client:
    base_url: str
    timeout_s: float


@dataclass(frozen=True)
class Problem:
    type: str | None = None
    title: str | None = None
    status: int | None = None
    detail: str | None = None
    instance: str | None = None


@dataclass(frozen=True)
class RateLimit:
    limit: int | None
    remaining: int | None
    reset: int | None


@dataclass(frozen=True)
class SearchHit:
    id: str
    url: str
    title: str | None = None
    description: str | None = None


class ApiError(Exception):
    """HTTP error with an optional RFC 9457 problem body."""

    def __init__(self, status: int, problem: Problem, retry_after: int | None) -> None:
        super().__init__(problem.detail or problem.title or f"HTTP {status}")
        self.status = status
        self.problem = problem
        self.retry_after = retry_after


def _strip_trailing_slashes(url: str) -> str:
    end = len(url)
    while end > 0 and url[end - 1] == "/":
        end -= 1
    return url[:end]


def create_client(
    *,
    base_url: str | None = None,
    timeout_s: float = 15.0,
) -> Client:
    raw = base_url or os.environ.get("ORCHESTKIT_BASE_URL") or DEFAULT_BASE_URL
    return Client(base_url=_strip_trailing_slashes(raw), timeout_s=timeout_s)


def _int_header(headers: Any, name: str) -> int | None:
    raw = headers.get(name)
    if raw is None:
        return None
    try:
        return int(str(raw))
    except ValueError:
        return None


def _rate_limit(headers: Any) -> RateLimit:
    return RateLimit(
        limit=_int_header(headers, "ratelimit-limit"),
        remaining=_int_header(headers, "ratelimit-remaining"),
        reset=_int_header(headers, "ratelimit-reset"),
    )


def _problem_from_body(status: int, text: str) -> Problem:
    try:
        body = json.loads(text)
    except json.JSONDecodeError:
        return Problem(status=status, title="HTTP error")
    if not isinstance(body, dict):
        return Problem(status=status, title="HTTP error")
    return Problem(
        type=body.get("type") if isinstance(body.get("type"), str) else None,
        title=body.get("title") if isinstance(body.get("title"), str) else None,
        status=body.get("status") if isinstance(body.get("status"), int) else status,
        detail=body.get("detail") if isinstance(body.get("detail"), str) else None,
        instance=body.get("instance") if isinstance(body.get("instance"), str) else None,
    )


def _request(client: Client, path: str, accept: str) -> tuple[bytes, Any]:
    req = urllib.request.Request(
        f"{client.base_url}{path}",
        headers={"Accept": accept, "User-Agent": USER_AGENT},
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=client.timeout_s) as res:
            return res.read(), res.headers
    except urllib.error.HTTPError as err:
        text = err.read().decode("utf-8", errors="replace")
        retry = _int_header(err.headers, "retry-after")
        raise ApiError(err.code, _problem_from_body(err.code, text), retry) from err


def search(
    client: Client,
    query: str,
    limit: int = 5,
) -> tuple[list[SearchHit], RateLimit]:
    qs = urllib.parse.urlencode({"query": query, "limit": str(limit)})
    raw, headers = _request(client, f"/api/search?{qs}", "application/json")
    data = json.loads(raw.decode("utf-8"))
    hits: list[SearchHit] = []
    for item in data.get("results") or []:
        if not isinstance(item, dict):
            continue
        hid = item.get("id")
        url = item.get("url")
        if not isinstance(hid, str) or not isinstance(url, str):
            continue
        title = item.get("title") if isinstance(item.get("title"), str) else None
        desc = item.get("description") if isinstance(item.get("description"), str) else None
        hits.append(SearchHit(id=hid, url=url, title=title, description=desc))
    return hits, _rate_limit(headers)


def ask(client: Client, query: str) -> tuple[Any, RateLimit]:
    qs = urllib.parse.urlencode({"query": query})
    raw, headers = _request(client, f"/ask?{qs}", "application/json")
    return json.loads(raw.decode("utf-8")), _rate_limit(headers)


def read_doc(client: Client, slug: str) -> tuple[str, RateLimit]:
    clean = slug.strip()
    if clean.endswith(".md"):
        clean = clean[:-3]
    if not clean.startswith("/"):
        clean = f"/docs/{clean}"
    if not clean.startswith("/docs"):
        clean = f"/docs{clean}"
    raw, headers = _request(client, f"{clean}.md", "text/markdown")
    return raw.decode("utf-8"), _rate_limit(headers)

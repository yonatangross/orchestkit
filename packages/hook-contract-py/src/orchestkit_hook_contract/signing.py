"""HMAC signing for OrchestKit hook deliveries (M141-4, #1805).

Mirrors ``@orchestkit/hook-contract/src/signing.ts`` byte-for-byte for the same
inputs. Both sides consume the shared golden vectors at
``packages/hook-contract/test-vectors/signing/*.json``.

Spec: see ``packages/hook-contract/docs/signing-rfc.md`` in the repo root.

Zero runtime dependencies beyond the Python stdlib (``hmac``, ``hashlib``).
"""

from __future__ import annotations

import hmac
import re
import time
from collections.abc import Sequence
from dataclasses import dataclass
from hashlib import sha256
from typing import TYPE_CHECKING, Literal

if TYPE_CHECKING:
    from collections.abc import Callable

__all__ = [
    "HOOK_SIGNATURE_HEADER",
    "MIN_SECRET_BYTES",
    "Reason",
    "VerifyResult",
    "sign",
    "verify",
]

HOOK_SIGNATURE_HEADER = "X-CC-Hooks-Signature"
"""Header name constant for consumers building Flask/FastAPI/etc. middleware."""

DEFAULT_TOLERANCE_SEC = 300
MIN_SECRET_BYTES = 32
"""Recommended minimum secret length in bytes. Below this triggers ``weak_secret``."""

_HEX_DIGEST_LEN = 64
_MAX_HEADER_BYTES = 8192
_MAX_TIMESTAMP_DIGITS = 10
_SCHEME_PATTERN = re.compile(r"^v[0-9]+$")
_DIGITS_ONLY = re.compile(r"^[0-9]+$")
_HEX_ONLY = re.compile(r"^[0-9a-f]+$")

Reason = Literal[
    "ok",
    "missing_header",
    "malformed_header",
    "stale",
    "signature_mismatch",
    "weak_secret",
]


@dataclass(frozen=True)
class VerifyResult:
    """Result of a verify() call.

    ``valid`` is ``True`` only when reason == "ok". Every other reason maps to
    ``valid = False``.
    """

    valid: bool
    reason: Reason


def _to_bytes(value: bytes | str) -> bytes:
    if isinstance(value, bytes):
        return value
    if isinstance(value, str):
        return value.encode("utf-8")
    raise TypeError(f"expected bytes or str, got {type(value).__name__}")


def _hmac_hex(secret: bytes, payload: bytes) -> str:
    return hmac.new(secret, payload, sha256).hexdigest()


def _signed_payload(timestamp_str: str, body: bytes) -> bytes:
    return timestamp_str.encode("ascii") + b"." + body


def sign(
    body: bytes,
    secret: bytes | str,
    *,
    timestamp: int | None = None,
    scheme: str = "v1",
) -> str:
    """Sign ``body`` and return the full ``X-CC-Hooks-Signature`` header value.

    Example::

        header = sign(body_bytes, secret)
        # -> "t=1731000000,v1=4c2f...e9"
        requests.post(url, headers={"X-CC-Hooks-Signature": header}, data=body_bytes)
    """
    secret_bytes = _to_bytes(secret)
    ts = int(time.time()) if timestamp is None else timestamp
    if not isinstance(ts, int) or isinstance(ts, bool) or ts < 0:
        raise TypeError(f"sign: timestamp must be a non-negative integer, got {ts!r}")
    if not _SCHEME_PATTERN.match(scheme):
        raise TypeError(f'sign: scheme must match /^v[0-9]+$/, got "{scheme}"')

    ts_str = str(ts)
    digest = _hmac_hex(secret_bytes, _signed_payload(ts_str, body))
    return f"t={ts_str},{scheme}={digest}"


@dataclass(frozen=True)
class _ParsedHeader:
    t_raw: str
    schemes: dict[str, str]  # scheme label -> lowercase hex digest


def _parse_header(header: str) -> _ParsedHeader | None:
    if not header:
        return None
    if len(header) > _MAX_HEADER_BYTES:
        return None

    pairs = header.split(",")
    t_raw: str | None = None
    schemes: dict[str, str] = {}

    for pair in pairs:
        if not pair:
            return None
        eq_idx = pair.find("=")
        if eq_idx <= 0 or eq_idx == len(pair) - 1:
            return None
        key = pair[:eq_idx]
        value = pair[eq_idx + 1 :]

        if key == "t":
            if t_raw is not None:
                return None
            if not _DIGITS_ONLY.match(value):
                return None
            t_raw = value
        elif _SCHEME_PATTERN.match(key):
            if key in schemes:
                return None
            lowered = value.lower()
            if len(lowered) != _HEX_DIGEST_LEN or not _HEX_ONLY.match(lowered):
                return None
            schemes[key] = lowered
        else:
            return None

    if t_raw is None or not schemes:
        return None
    return _ParsedHeader(t_raw=t_raw, schemes=schemes)


def _normalize_secrets(
    secret: bytes | str | Sequence[bytes | str],
) -> list[bytes]:
    if isinstance(secret, (bytes, str)):
        return [_to_bytes(secret)]
    if not isinstance(secret, Sequence):
        raise TypeError(
            f"verify: secret must be bytes/str or a sequence of them, got {type(secret).__name__}"
        )
    if len(secret) == 0:
        raise TypeError("verify: secret sequence must contain at least one secret")
    result: list[bytes] = []
    for s in secret:
        if not isinstance(s, (bytes, str)):
            raise TypeError(
                f"verify: secret sequence element must be bytes or str, got {type(s).__name__}"
            )
        result.append(_to_bytes(s))
    return result


def verify(
    header: str | None,
    body: bytes,
    secret: bytes | str | Sequence[bytes | str],
    *,
    now: int | None = None,
    tolerance_sec: int = DEFAULT_TOLERANCE_SEC,
    on_warning: Callable[[Reason], None] | None = None,
) -> VerifyResult:
    """Verify a request signature.

    Never raises on bad header input — every failure maps to a ``Reason``.
    Raises ``TypeError`` only on programmer errors (e.g. ``body`` is not
    bytes, ``secret`` is ``None``).
    """
    if not isinstance(body, (bytes, bytearray, memoryview)):
        raise TypeError("verify: body must be bytes")
    if secret is None:
        raise TypeError("verify: secret is required")

    body_bytes = bytes(body)

    if header is None or len(header) == 0:
        return VerifyResult(False, "missing_header")

    secrets = _normalize_secrets(secret)

    parsed = _parse_header(header)
    if parsed is None:
        return VerifyResult(False, "malformed_header")

    # Weak-secret advisory fires only after parseHeader succeeds so attackers
    # can't probe verifier configuration via malformed-request observation.
    if on_warning is not None:
        for s in secrets:
            if len(s) < MIN_SECRET_BYTES:
                on_warning("weak_secret")
                break

    ref_now = int(time.time()) if now is None else now

    # 10-digit cap on timestamp matches the TS side and keeps cross-language
    # parity (TS Number overflows past safe-integer; Python bigints do not).
    if len(parsed.t_raw) > _MAX_TIMESTAMP_DIGITS:
        return VerifyResult(False, "stale")
    t = int(parsed.t_raw)

    if abs(ref_now - t) > tolerance_sec:
        return VerifyResult(False, "stale")

    signed = _signed_payload(parsed.t_raw, body_bytes)
    matched = False

    for secret_bytes in secrets:
        expected = _hmac_hex(secret_bytes, signed)
        for candidate in parsed.schemes.values():
            if len(candidate) != _HEX_DIGEST_LEN:
                continue
            # compare_digest takes equal-length strings; we've enforced 64
            # chars on parse + the expected is 64 hex chars from sha256.
            # OR-assign so any match wins and the loop runs to completion.
            matched = hmac.compare_digest(candidate, expected) or matched

    return VerifyResult(True, "ok") if matched else VerifyResult(False, "signature_mismatch")

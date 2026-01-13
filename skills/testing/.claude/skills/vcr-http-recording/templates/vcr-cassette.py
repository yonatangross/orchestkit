# Template: VCR.py Cassette Configuration
# Usage: Copy to tests/conftest.py and customize for your API integrations

import pytest
import json
import os
from typing import Any

# ============================================================================
# VCR CONFIGURATION
# ============================================================================

@pytest.fixture(scope="module")
def vcr_config():
    """VCR configuration for HTTP recording and replay."""
    return {
        # Cassette storage location
        "cassette_library_dir": "tests/cassettes",

        # Recording mode based on environment
        # - "once": Record if missing, replay if exists (default for dev)
        # - "new_episodes": Record new requests, replay existing
        # - "none": Never record, only replay (for CI)
        # - "all": Always record (refresh cassettes)
        "record_mode": os.environ.get("VCR_RECORD_MODE", "once"),

        # Request matching criteria
        "match_on": ["uri", "method", "body"],

        # Filter sensitive headers
        "filter_headers": [
            "authorization",
            "x-api-key",
            "api-key",
            "x-auth-token",
            "cookie",
        ],

        # Filter query parameters
        "filter_query_parameters": [
            "api_key",
            "token",
            "access_token",
            "client_secret",
        ],

        # Custom request filter
        "before_record_request": filter_request,

        # Custom response filter
        "before_record_response": filter_response,

        # Decode compressed responses for readability
        "decode_compressed_response": True,
    }


# ============================================================================
# FILTERING FUNCTIONS
# ============================================================================

def filter_request(request):
    """Redact sensitive data from request body before recording."""
    if request.body:
        try:
            body = json.loads(request.body)
            # Redact sensitive fields
            sensitive_fields = ["password", "api_key", "secret", "token", "credit_card"]
            for field in sensitive_fields:
                if field in body:
                    body[field] = "REDACTED"
            request.body = json.dumps(body)
        except (json.JSONDecodeError, TypeError):
            pass
    return request


def filter_response(response: dict[str, Any]) -> dict[str, Any]:
    """Redact sensitive data from response before recording."""
    if "body" in response and "string" in response["body"]:
        try:
            body = json.loads(response["body"]["string"])
            # Redact tokens in response
            if "access_token" in body:
                body["access_token"] = "REDACTED_TOKEN"
            if "refresh_token" in body:
                body["refresh_token"] = "REDACTED_TOKEN"
            response["body"]["string"] = json.dumps(body)
        except (json.JSONDecodeError, TypeError):
            pass
    return response


# ============================================================================
# LLM API MATCHER (for OpenAI/Anthropic)
# ============================================================================

def llm_request_matcher(r1, r2) -> bool:
    """Custom matcher for LLM APIs that ignores dynamic fields."""
    if r1.uri != r2.uri or r1.method != r2.method:
        return False

    try:
        body1 = json.loads(r1.body) if r1.body else {}
        body2 = json.loads(r2.body) if r2.body else {}

        # Fields to ignore when matching LLM requests
        ignore_fields = ["request_id", "timestamp", "stream", "user"]
        for field in ignore_fields:
            body1.pop(field, None)
            body2.pop(field, None)

        return body1 == body2
    except json.JSONDecodeError:
        return r1.body == r2.body


@pytest.fixture(scope="module")
def vcr_config_llm(vcr_config):
    """Extended VCR config for LLM API testing."""
    config = vcr_config.copy()
    config["match_on"] = ["uri", "method"]  # Use custom matcher instead
    config["custom_matchers"] = [llm_request_matcher]
    return config


# ============================================================================
# USAGE EXAMPLES
# ============================================================================

# Basic usage with decorator
@pytest.mark.vcr()
def test_fetch_user():
    """HTTP calls are recorded/replayed automatically."""
    import requests
    response = requests.get("https://api.example.com/users/1")
    assert response.status_code == 200


# Custom cassette name
@pytest.mark.vcr("custom_cassette.yaml")
def test_with_named_cassette():
    import requests
    response = requests.get("https://api.example.com/data")
    assert response.status_code == 200


# Async test with httpx
@pytest.mark.asyncio
@pytest.mark.vcr()
async def test_async_api_call():
    from httpx import AsyncClient
    async with AsyncClient() as client:
        response = await client.get("https://api.example.com/async-data")
    assert response.status_code == 200


# ============================================================================
# CI CONFIGURATION
# ============================================================================

# In CI, ensure cassettes exist (record_mode: none)
# Add to pytest.ini or pyproject.toml:
#
# [tool.pytest.ini_options]
# env = [
#     "VCR_RECORD_MODE=none",
# ]
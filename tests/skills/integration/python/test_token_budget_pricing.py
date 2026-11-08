"""Tests for the long-context rate card in token-budget.py estimate_cost (#5023)."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from types import ModuleType

import pytest

SCRIPT_PATH = (
    Path(__file__).resolve().parents[4]
    / "src"
    / "skills"
    / "distributed-systems"
    / "scripts"
    / "token-budget.py"
)


@pytest.fixture(scope="module")
def token_budget() -> ModuleType:
    spec = importlib.util.spec_from_file_location("token_budget", SCRIPT_PATH)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules["token_budget"] = module
    spec.loader.exec_module(module)
    return module


def cost(token_budget: ModuleType, model: str, input_tokens: int, output_tokens: int) -> float:
    guard = token_budget.TokenBudgetGuard(model=model, context_limit=1_000_000)
    return guard.estimate_cost(input_tokens, output_tokens)


def test_haiku_at_the_threshold_uses_the_base_card(token_budget: ModuleType) -> None:
    assert cost(token_budget, "claude-haiku-5-5", 100_000, 1_000_000) == pytest.approx(0.01 + 0.50)


def test_haiku_above_the_threshold_bills_the_whole_request_on_the_higher_card(
    token_budget: ModuleType,
) -> None:
    assert cost(token_budget, "claude-haiku-5-5", 150_000, 1_000_000) == pytest.approx(0.075 + 2.50)


def test_a_model_with_one_card_ignores_prompt_length(token_budget: ModuleType) -> None:
    assert cost(token_budget, "claude-sonnet-4-6", 150_000, 0) == pytest.approx(0.45)

"""Integration test for the Evaluation API.

This test encompasses:
  1) Create a valid JWT (matching backend .env settings)
  2) Upload a real BPMN file via POST /api/v1/models
  3) Trigger the evaluation workflow via POST /api/v1/evaluation/report?model_id=...

Execute (with docker-compose up and backend exposed on :8000):
  cd backend
  uv run pytest tests/integration/test_evaluation_api_integration.py -v

Notes:
- Requires the FastAPI backend to be running (docker-compose).
- Loads backend/.env automatically (only for the test process), so you don't need to export env vars.
- Uses the JWT secret locally to mint a short-lived HS256 token (dev/test only).
"""

from __future__ import annotations

import os
import time
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv
from jose import jwt
import json


def _load_backend_env() -> None:
    """Load backend/.env once for the test process.

    Existing environment variables take precedence.
    """

    backend_root = Path(__file__).resolve().parents[2]  # .../backend
    env_path = backend_root / ".env"
    if env_path.exists():
        load_dotenv(dotenv_path=env_path, override=False)


def _mint_test_jwt() -> str:
    """Mint an HS256 JWT for the test user.

    In demo mode the backend ignores tokens entirely, but we still produce one so the
    test exercises the same code path as a non-demo deployment.
    """
    _load_backend_env()

    secret = os.environ.get("JWT_SECRET", "demo-mode-insecure-do-not-deploy")
    aud = os.environ.get("AUDIENCE", "authenticated")
    alg = os.environ.get("ALGORITHM", "HS256")
    role = os.environ.get("TEST_JWT_ROLE", "authenticated")
    sub = os.environ.get("DEMO_USER_ID", "00000000-0000-0000-0000-000000000001")

    now = int(time.time())
    payload = {
        "sub": sub,
        "aud": aud,
        "role": role,
        "iat": now,
        "nbf": now,
        "exp": now + 60 * 10,
        "jti": "test-token",
    }
    return jwt.encode(payload, secret, algorithm=alg)


def _dump_report(report: dict) -> None:
    print("\n=== evaluation/report payload ===")
    print(json.dumps(report, indent=2, ensure_ascii=False))

    # Some code paths may wrap the actual report under result
    result = report.get("result", report)

    print("\n=== checks (summary) ===")
    for key in [
        "syntax_check",
        "duplicate_check",
        "semantic_label_check",
        "custom_rules_check",
        "complexity_check",
        "model_evaluation",
    ]:
        val = result.get(key, None)
        print(f"{key}: {val!r}")


@pytest.mark.integration
def test_upload_and_evaluate_report():
    _load_backend_env()

    base_url = os.environ.get("BACKEND_BASE_URL", "http://localhost:8000")

    token = _mint_test_jwt()
    headers = {"Authorization": f"Bearer {token}"}

    # 1) Upload BPMN
    bpmn_file = Path(__file__).resolve().parent.parent / "resources" / "bpmn_validation" / "simple_test.bpmn"
    assert bpmn_file.exists(), f"Missing resource: {bpmn_file}"

    with bpmn_file.open("rb") as f:
        resp = requests.post(
            f"{base_url}/api/v1/models",
            headers=headers,
            files={"file": (bpmn_file.name, f, "application/xml")},
            timeout=60,
        )

    assert resp.status_code == 201, f"Upload failed: {resp.status_code} {resp.text}"
    model = resp.json()
    assert "id" in model, f"Unexpected upload response: {model}"
    model_id = model["id"]

    # 2) Trigger evaluation report
    report_resp = requests.post(
        f"{base_url}/api/v1/evaluation/report",
        headers=headers,
        params={"model_id": model_id},
        timeout=300,
    )

    assert report_resp.status_code == 200, f"Report failed: {report_resp.status_code} {report_resp.text}"
    report = report_resp.json()

    # print
    _dump_report(report)

    # 3) Assert: all check sections exist in the response
    assert report.get("model_id") == model_id
    assert report.get("model_description") is not None

    # new overall evaluation node
    assert report.get("model_evaluation") is not None
    assert 1 <= report["model_evaluation"]["evaluation_rating"] <= 10
    assert isinstance(report["model_evaluation"]["evaluation_summary"], str)
    assert len(report["model_evaluation"]["evaluation_summary"]) > 0

    # check payloads
    assert report.get("syntax_check") is not None
    assert report.get("custom_rules_check") is not None
    assert report.get("complexity_check") is not None
    assert report.get("duplicate_check") is not None
    assert report.get("semantic_label_check") is not None

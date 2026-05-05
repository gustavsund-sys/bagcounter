import os
import requests
import pytest
from pathlib import Path
from dotenv import load_dotenv

# Load frontend .env to get public URL
ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / "frontend" / ".env")

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")


@pytest.fixture(scope="session")
def base_url():
    assert BASE_URL, "REACT_APP_BACKEND_URL must be set"
    return BASE_URL


@pytest.fixture(scope="session")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s

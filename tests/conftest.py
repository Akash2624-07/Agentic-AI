import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
RECOVERED = ROOT / "recovered" / "api"
sys.path.insert(0, str(ROOT))


def pytest_addoption(parser):
    parser.addoption("--runslow", action="store_true", help="also run full 92-week replays")


def pytest_configure(config):
    config.addinivalue_line("markers", "slow: full replays, run with --runslow")


def pytest_collection_modifyitems(config, items):
    if config.getoption("--runslow"):
        return
    skip = pytest.mark.skip(reason="needs --runslow")
    for item in items:
        if "slow" in item.keywords:
            item.add_marker(skip)


def recovered(path: str):
    return json.loads((RECOVERED / path).read_text())


@pytest.fixture(autouse=True)
def isolated_db(tmp_path, monkeypatch):
    from src import config

    monkeypatch.setattr(config, "DB_PATH", tmp_path / "runs.db")
    monkeypatch.setattr(config, "LLM_CACHE_PATH", tmp_path / "llm.json")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    yield


@pytest.fixture(scope="session")
def never_replay():
    from src import policies
    from src.engine import Replay

    replay = Replay(policies.make("never"))
    replay.run()
    return replay


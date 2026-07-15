import importlib
import os
import sys
from pathlib import Path

import pytest

sys.path.append(str(Path(__file__).resolve().parents[1]))


def test_gemini_api_key_is_loaded_from_env():
    from core import config

    importlib.reload(config)
    assert config.settings.GEMINI_API_KEY


def test_gemini_api_key_is_loaded_even_from_another_cwd(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    os.environ.pop("GEMINI_API_KEY", None)

    from core import config

    importlib.reload(config)
    assert config.settings.GEMINI_API_KEY

"""Les tests tournent TOUJOURS en mode démo : aucune clé, aucun envoi réel, données dans un dossier temporaire."""
import os
import sys
import tempfile
from pathlib import Path

for var in ["GEMINI_API_KEY", "OLLAMA_URL", "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID", "FIREBASE_CREDENTIALS",
            "META_PAGE_ID", "META_PAGE_TOKEN", "META_IG_USER_ID", "META_AD_ACCOUNT_ID", "META_ADS_TOKEN", "GITHUB_TOKEN"]:
    os.environ[var] = ""
os.environ["DATA_DIR"] = tempfile.mkdtemp(prefix="bureau-test-")
os.environ["BUREAU_TESTS"] = "1"  # le vrai .env ne doit jamais être utilisé pendant les tests
os.environ["BUREAU_ENV_FILE"] = os.path.join(os.environ["DATA_DIR"], "test.env")
os.environ["AGENTS_ACTIFS"] = "creatif,community,media_buyer,db_manager,auditor,rnd"
os.environ["BUS_URL"] = "http://127.0.0.1:9/event"  # port fermé : les événements sont ignorés
os.environ["BUDGET_MAX_JOUR"] = "80"

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest  # noqa: E402

import store  # noqa: E402
import tools_firestore as fs  # noqa: E402


@pytest.fixture(autouse=True)
def fresh(tmp_path):
    store.connect(tmp_path / "bureau.db")
    fs.set_repo(fs.MemoryRepo())
    yield

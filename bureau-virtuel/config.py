"""Réglages du Bureau Virtuel. Tout se règle dans le fichier .env (voir .env.example)."""
import os
from pathlib import Path

from dotenv import load_dotenv

BASE = Path(__file__).resolve().parent
ENV_FILE = Path(os.getenv("BUREAU_ENV_FILE") or BASE / ".env")
# Le fichier .env (rempli depuis la page Réglages) est prioritaire, sauf pendant les tests.
load_dotenv(ENV_FILE, override=os.getenv("BUREAU_TESTS") != "1")


def _get(name: str, default: str = "") -> str:
    return (os.getenv(name) or default).strip()


def _int(name: str, default: int) -> int:
    try:
        return int(_get(name, str(default)))
    except ValueError:
        return default


# --- Cerveau (IA) ---
GEMINI_API_KEY = _get("GEMINI_API_KEY")
GEMINI_MODEL = _get("GEMINI_MODEL", "gemini-2.5-flash")
OLLAMA_URL = _get("OLLAMA_URL")            # ex. http://127.0.0.1:11434 (secours local, gratuit)
OLLAMA_MODEL = _get("OLLAMA_MODEL", "qwen2.5:7b")

# --- Données locales ---
DATA_DIR = Path(_get("DATA_DIR", str(BASE / "data")))
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DATA_DIR / "bureau.db"           # validations, journal, rapports
MEMORY_PATH = DATA_DIR / "memoire.db"      # mémoire LangGraph (survit aux redémarrages)
MEDIA_DIR = DATA_DIR / "media"
BACKUP_DIR = DATA_DIR / "sauvegardes"

# --- Agents actifs (on les allume un par un) ---
ALL_AGENTS = ["creatif", "community", "media_buyer", "db_manager", "auditor", "rnd"]
AGENTS_ACTIFS = [a.strip() for a in _get("AGENTS_ACTIFS", "community,db_manager,auditor,rnd").split(",")
                 if a.strip() in ALL_AGENTS]

# --- Serveur ---
HOST = _get("HOST", "127.0.0.1")           # 127.0.0.1 = visible seulement sur cet ordinateur
PORT = _int("PORT", 8000)
BUS_URL = _get("BUS_URL", f"http://127.0.0.1:{PORT}/event")
HEURE_ROUTINE = _get("HEURE_ROUTINE", "08:00")  # routine + rapport quotidien
RYTHME = float(_get("RYTHME_ANIMATION", "1.2") or 0)  # secondes de marche à l'écran (0 = aucune pause)
FUSEAU = _get("FUSEAU", "Africa/Casablanca")

# --- Telegram (gratuit) ---
TELEGRAM_BOT_TOKEN = _get("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = _get("TELEGRAM_CHAT_ID")

# --- Firebase (la même base que le site) ---
FIREBASE_CREDENTIALS = _get("FIREBASE_CREDENTIALS")   # chemin du fichier JSON du compte de service
if FIREBASE_CREDENTIALS and not Path(FIREBASE_CREDENTIALS).is_absolute():
    FIREBASE_CREDENTIALS = str(BASE / FIREBASE_CREDENTIALS)  # relatif au dossier bureau-virtuel

# --- Meta (Facebook / Instagram / publicité) ---
META_API_VERSION = _get("META_API_VERSION", "v23.0")
META_PAGE_ID = _get("META_PAGE_ID")
META_PAGE_TOKEN = _get("META_PAGE_TOKEN")
META_IG_USER_ID = _get("META_IG_USER_ID")
META_AD_ACCOUNT_ID = _get("META_AD_ACCOUNT_ID")       # ex. act_1234567890
META_ADS_TOKEN = _get("META_ADS_TOKEN") or META_PAGE_TOKEN
META_SPECIAL_CATEGORY = _get("META_SPECIAL_CATEGORY", "HOUSING")  # catégorie « Logement » ; vide = aucune
BUDGET_MAX_JOUR = _int("BUDGET_MAX_JOUR", 100)        # plafond par jour, dans la devise du compte pub
CPC_MAX = float(_get("CPC_MAX", "3") or 3)            # au-delà : le Media Buyer propose une pause
ZONE_LAT = float(_get("ZONE_LAT", "33.8935") or 33.8935)   # Meknès
ZONE_LNG = float(_get("ZONE_LNG", "-5.5473") or -5.5473)
ZONE_RAYON_KM = _int("ZONE_RAYON_KM", 25)

# --- GitHub (veille de l'Agent R&D) ---
GITHUB_TOKEN = _get("GITHUB_TOKEN")

# --- Agence ---
AGENCE_NOM = _get("AGENCE_NOM", "Al Wasset 777")
AGENCE_WHATSAPP = _get("AGENCE_WHATSAPP", "212777777848")
MARQUE_FILE = BASE / "marque.md"


def ton_marque() -> str:
    return MARQUE_FILE.read_text(encoding="utf-8") if MARQUE_FILE.exists() else ""


def statut_connexions() -> dict:
    """Ce qui est branché ou pas (affiché dans le bureau)."""
    return {
        "ia": "Gemini" if GEMINI_API_KEY else ("Ollama" if OLLAMA_URL else "démo (sans IA)"),
        "telegram": bool(TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID),
        "firebase": bool(FIREBASE_CREDENTIALS and Path(FIREBASE_CREDENTIALS).exists()),
        "meta_page": bool(META_PAGE_ID and META_PAGE_TOKEN),
        "meta_instagram": bool(META_IG_USER_ID and META_PAGE_TOKEN),
        "meta_pub": bool(META_AD_ACCOUNT_ID and META_ADS_TOKEN),
        "github": bool(GITHUB_TOKEN),
        "agents_actifs": AGENTS_ACTIFS,
    }

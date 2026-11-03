"""Page « الإعدادات » : on colle une clé, le bureau la vérifie, l'enregistre dans .env
et la prend en compte tout de suite (sans redémarrer)."""
import importlib
import json
import os
import re
import secrets
from pathlib import Path

import requests

import config
import store
import tools_firestore as fs
import tools_media

# Seules ces clés peuvent être écrites depuis la page (rien d'autre).
ALLOWED = {
    "GEMINI_API_KEY", "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID", "FIREBASE_CREDENTIALS", "GITHUB_TOKEN",
    "META_PAGE_ID", "META_PAGE_TOKEN", "META_IG_USER_ID", "META_AD_ACCOUNT_ID", "META_ADS_TOKEN",
    "BUDGET_MAX_JOUR", "AGENTS_ACTIFS", "HEURE_ROUTINE",
}


# ---------- Fichier .env ----------
def _clean(value) -> str:
    return re.sub(r"[\r\n]", "", str(value if value is not None else "")).strip()


def save_env(updates: dict) -> None:
    """Remplace ou ajoute des lignes CLE=valeur dans .env (crée le fichier depuis .env.example)."""
    updates = {k: _clean(v) for k, v in updates.items() if k in ALLOWED}
    if not updates:
        return
    env = config.ENV_FILE
    if not env.exists():
        example = config.BASE / ".env.example"
        env.write_text(example.read_text(encoding="utf-8") if example.exists() else "", encoding="utf-8")
    lines = env.read_text(encoding="utf-8").splitlines()
    done = set()
    for i, line in enumerate(lines):
        key = line.split("=", 1)[0].strip()
        if key in updates and not line.lstrip().startswith("#"):
            lines[i] = f"{key}={updates[key]}"
            done.add(key)
    lines += [f"{k}={v}" for k, v in updates.items() if k not in done]
    env.write_text("\n".join(lines) + "\n", encoding="utf-8")
    try:
        os.chmod(env, 0o600)  # lisible seulement par vous
    except OSError:
        pass
    for k, v in updates.items():
        os.environ[k] = v
    reload()


def reload() -> None:
    importlib.reload(config)
    fs.set_repo(None)  # la base sera rebranchée avec les nouveaux réglages


# ---------- Vérifications ----------
def check_gemini(key: str) -> tuple[bool, str]:
    try:
        r = requests.get("https://generativelanguage.googleapis.com/v1beta/models",
                         headers={"x-goog-api-key": key}, timeout=20)
    except requests.RequestException as e:
        return False, f"تعذّر الاتصال: {e}"
    return (True, "✅ المفتاح صالح") if r.ok else (False, "❌ المفتاح غير صالح، انسخه من جديد")


def telegram_bot(token: str) -> dict | None:
    try:
        r = requests.get(f"https://api.telegram.org/bot{token}/getMe", timeout=20)
        data = r.json()
        return data.get("result") if data.get("ok") else None
    except (requests.RequestException, ValueError):
        return None


def telegram_link_code() -> str:
    code = store.kv_get("telegram_code")
    if not code:
        code = secrets.token_hex(6)
        store.kv_set("telegram_code", code)
    return code


def bind_telegram(chat_id) -> None:
    store.kv_set("telegram_code", None)  # le code ne sert qu'une fois
    save_env({"TELEGRAM_CHAT_ID": str(chat_id)})


def meta_discover(token: str) -> dict:
    """Avec UN seul jeton, on retrouve tout seul : la Page, Instagram et le compte publicitaire."""
    base = f"https://graph.facebook.com/{config.META_API_VERSION}"

    def get(path, **params):
        r = requests.get(f"{base}/{path}", params={**params, "access_token": token}, timeout=30)
        data = r.json() if r.content else {}
        if r.status_code >= 400 or "error" in data:
            raise RuntimeError((data.get("error") or {}).get("message", f"HTTP {r.status_code}"))
        return data

    pages = get("me/accounts", fields="id,name,access_token,instagram_business_account{id,username}").get("data", [])
    try:
        ads = get("me/adaccounts", fields="id,name,currency,account_status").get("data", [])
    except RuntimeError:
        ads = []  # jeton sans droit publicitaire : on continue sans pub
    return {"pages": pages, "ads": ads}


def save_meta(token: str, page_id: str | None = None, ad_id: str | None = None) -> dict:
    found = meta_discover(token)
    if not found["pages"]:
        raise RuntimeError("لم نجد أي صفحة فيسبوك مرتبطة بهذا الرمز")
    page = next((p for p in found["pages"] if p["id"] == page_id), None) or \
        next((p for p in found["pages"] if "wass" in p.get("name", "").lower()), found["pages"][0])
    ig = page.get("instagram_business_account") or {}
    ad = next((a for a in found["ads"] if a["id"] == ad_id), None) or (found["ads"][0] if found["ads"] else {})
    save_env({"META_PAGE_ID": page["id"], "META_PAGE_TOKEN": page.get("access_token", ""),
              "META_IG_USER_ID": ig.get("id", ""), "META_AD_ACCOUNT_ID": ad.get("id", ""), "META_ADS_TOKEN": token})
    return {"page": page.get("name"), "instagram": ig.get("username"), "pub": ad.get("name"),
            "devise": ad.get("currency"), "pages": [{"id": p["id"], "name": p.get("name")} for p in found["pages"]],
            "comptes_pub": [{"id": a["id"], "name": a.get("name")} for a in found["ads"]]}


def save_firebase(content: str) -> str:
    try:
        data = json.loads(content)
    except ValueError:
        raise ValueError("الملف ليس ملف JSON صحيح")
    if data.get("type") != "service_account" or not data.get("project_id") or not data.get("private_key"):
        raise ValueError("هذا ليس ملف «حساب الخدمة» (Service account) الخاص بـ Firebase")
    path = config.ENV_FILE.parent / "service-account.json"
    path.write_text(json.dumps(data, indent=1), encoding="utf-8")
    try:
        os.chmod(path, 0o600)
    except OSError:
        pass
    save_env({"FIREBASE_CREDENTIALS": str(path)})
    repo = fs.get_repo()
    if not repo.online:
        raise RuntimeError("تعذّر فتح القاعدة بهذا الملف")
    count = len(repo.list(fs.REGISTRY))
    return f"✅ تم الربط بمشروع {data['project_id']} — {count} عقار في السجل"


# ---------- Statut affiché sur la page ----------
def status() -> dict:
    bot = telegram_bot(config.TELEGRAM_BOT_TOKEN) if config.TELEGRAM_BOT_TOKEN else None
    project = None
    if config.FIREBASE_CREDENTIALS and Path(config.FIREBASE_CREDENTIALS).exists():
        try:
            project = json.loads(Path(config.FIREBASE_CREDENTIALS).read_text()).get("project_id")
        except (OSError, ValueError):
            project = None
    return {
        "gemini": bool(config.GEMINI_API_KEY),
        "telegram_token": bool(config.TELEGRAM_BOT_TOKEN),
        "telegram_bot": (bot or {}).get("username"),
        "telegram_lie": bool(config.TELEGRAM_CHAT_ID),
        "telegram_lien": (f"https://t.me/{bot['username']}?start={telegram_link_code()}"
                          if bot and not config.TELEGRAM_CHAT_ID else None),
        "firebase": project,
        "meta_page": bool(config.META_PAGE_ID and config.META_PAGE_TOKEN),
        "meta_instagram": bool(config.META_IG_USER_ID),
        "meta_pub": bool(config.META_AD_ACCOUNT_ID),
        "github": bool(config.GITHUB_TOKEN),
        "ffmpeg": tools_media.ffmpeg_ok(),
        "agents_actifs": config.AGENTS_ACTIFS,
        "budget_max": config.BUDGET_MAX_JOUR,
        "heure": config.HEURE_ROUTINE,
    }

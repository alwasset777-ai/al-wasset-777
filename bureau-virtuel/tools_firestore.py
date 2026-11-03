"""Accès à la base du site (Firebase / Firestore) : collections « registry » (biens et
propriétaires) et « inbox » (demandes des clients du site).
Sans fichier de compte de service, on travaille sur une base de DÉMO en mémoire,
pour pouvoir tout tester sans risque."""
import datetime as dt
import json
import secrets
import time
from pathlib import Path

import config

REGISTRY = "registry"
INBOX = "inbox"


class MemoryRepo:
    """Base de démonstration (ou de test) qui imite Firestore."""
    online = False

    def __init__(self, data: dict[str, dict[str, dict]] | None = None):
        self.data = data if data is not None else demo_data()

    def list(self, coll: str) -> list[dict]:
        return [{**v, "id": k} for k, v in self.data.get(coll, {}).items()]

    def add(self, coll: str, fields: dict, doc_id: str | None = None) -> str:
        doc_id = doc_id or new_id("reg" if coll == REGISTRY else "doc")
        self.data.setdefault(coll, {})[doc_id] = dict(fields)
        return doc_id

    def update(self, coll: str, doc_id: str, fields: dict) -> None:
        if doc_id not in self.data.get(coll, {}):
            raise KeyError(f"{coll}/{doc_id} introuvable")
        self.data[coll][doc_id].update(fields)


class FirestoreRepo:
    online = True

    def __init__(self, credentials_path: str):
        import firebase_admin
        from firebase_admin import credentials, firestore
        app_name = "bureau-virtuel"
        try:
            app = firebase_admin.get_app(app_name)
        except ValueError:
            app = firebase_admin.initialize_app(credentials.Certificate(credentials_path), name=app_name)
        self.client = firestore.client(app)

    def list(self, coll: str) -> list[dict]:
        return [{**d.to_dict(), "id": d.id} for d in self.client.collection(coll).stream()]

    def add(self, coll: str, fields: dict, doc_id: str | None = None) -> str:
        doc_id = doc_id or new_id("reg" if coll == REGISTRY else "doc")
        self.client.collection(coll).document(doc_id).set(fields)
        return doc_id

    def update(self, coll: str, doc_id: str, fields: dict) -> None:
        self.client.collection(coll).document(doc_id).update(fields)


def new_id(prefix: str) -> str:
    # même format que le site : reg-<horodatage>-<6 caractères>
    return f"{prefix}-{int(time.time() * 1000)}-{secrets.token_hex(3)}"


_repo = None


def get_repo():
    global _repo
    if _repo is None:
        creds = config.FIREBASE_CREDENTIALS
        _repo = FirestoreRepo(creds) if creds and Path(creds).exists() else MemoryRepo()
    return _repo


def set_repo(repo) -> None:  # pour les tests
    global _repo
    _repo = repo


def new_registry_fields(fields: dict) -> dict:
    """Un bien ajouté par l'agent a exactement la forme qu'attend le site."""
    keys = ["propertyType", "owner", "ownerPhone", "surface", "location", "price", "notes"]
    out = {k: str(fields.get(k, "") or "").strip()[:500] for k in keys}
    out.update(photos=[], videos=[], documents=[], createdAt=dt.datetime.now(dt.timezone.utc).isoformat())
    return out


def archive(repo, coll: str, doc_id: str, reason: str) -> None:
    """On n'efface jamais : on marque « archivé » (réversible)."""
    repo.update(coll, doc_id, {"archived": True, "archivedReason": reason[:200],
                               "archivedAt": dt.datetime.now(dt.timezone.utc).isoformat()})


def backup(repo, collections=(REGISTRY, INBOX), keep: int = 30) -> Path:
    """Sauvegarde complète en JSON dans data/sauvegardes (garde les 30 dernières)."""
    config.BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    snapshot = {c: repo.list(c) for c in collections}
    path = config.BACKUP_DIR / f"sauvegarde-{dt.datetime.now().strftime('%Y-%m-%d_%H%M%S')}.json"
    path.write_text(json.dumps(snapshot, ensure_ascii=False, indent=1, default=str), encoding="utf-8")
    for old in sorted(config.BACKUP_DIR.glob("sauvegarde-*.json"))[:-keep]:
        old.unlink()
    return path


def demo_data() -> dict:
    now = dt.datetime.now(dt.timezone.utc)
    iso = lambda h: (now - dt.timedelta(hours=h)).isoformat()  # noqa: E731
    reg = lambda **f: {"photos": [], "videos": [], "documents": [], "notes": "", **f}  # noqa: E731
    return {
        REGISTRY: {
            "reg-demo-1": reg(propertyType="Appartement", owner="Karim B.", ownerPhone="0661234567",
                              surface="95", location="Hamria, Meknès", price="850000", createdAt=iso(200)),
            "reg-demo-2": reg(propertyType="Appartement", owner="Karim B.", ownerPhone="+212 661-234567",
                              surface="95", location="hamria, meknès", price="850000", createdAt=iso(20)),
            "reg-demo-3": reg(propertyType="Villa", owner="Fatima Z.", ownerPhone="06 12",
                              surface="300", location="", price="", createdAt=iso(50)),
            "reg-demo-4": reg(propertyType="Terrain", owner="Ahmed R.", ownerPhone="0700112233",
                              surface="500", location="Route d'Agouraï", price="1200000", createdAt=iso(10)),
        },
        INBOX: {
            "doc-demo-1": {"kind": "visite", "name": "Youssef", "phone": "0655443322",
                           "message": "Bonjour, l'appartement de Hamria est toujours disponible ? Je peux visiter samedi ?",
                           "propertyTitle": "Appartement Hamria 3 chambres", "createdAt": iso(3)},
            "doc-demo-2": {"kind": "recherche", "name": "سعاد", "phone": "0611223344",
                           "message": "بغيت شقة للكراء فمكناس الجديدة، الثمن ماشي كثر من 3000 درهم",
                           "createdAt": iso(5)},
        },
    }

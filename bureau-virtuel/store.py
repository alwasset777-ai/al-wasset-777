"""Registre local (SQLite) : actions à valider, journal, rapports, petite mémoire.
Tout est dans data/bureau.db : rien ne se perd si l'ordinateur redémarre."""
import json
import sqlite3
import threading
import time
from pathlib import Path

import config

_lock = threading.RLock()
_conn: sqlite3.Connection | None = None

SCHEMA = """
CREATE TABLE IF NOT EXISTS approvals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent TEXT NOT NULL, kind TEXT NOT NULL, title TEXT NOT NULL,
  details TEXT DEFAULT '', payload TEXT DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',      -- pending | rejected | approved | done | failed
  result TEXT DEFAULT '', created_at REAL, decided_at REAL, decided_by TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS journal (
  id INTEGER PRIMARY KEY AUTOINCREMENT, ts REAL, agent TEXT, action TEXT, details TEXT
);
CREATE TABLE IF NOT EXISTS reports (day TEXT PRIMARY KEY, text TEXT, created_at REAL);
CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT);
"""


def connect(path: Path | str | None = None) -> sqlite3.Connection:
    """Ouvre (ou rouvre, pour les tests) la base."""
    global _conn
    with _lock:
        _conn = sqlite3.connect(str(path or config.DB_PATH), check_same_thread=False)
        _conn.row_factory = sqlite3.Row
        _conn.executescript(SCHEMA)
        return _conn


def db() -> sqlite3.Connection:
    return _conn or connect()


def _row(r):
    if r is None:
        return None
    d = dict(r)
    if "payload" in d:
        d["payload"] = json.loads(d["payload"] or "{}")
    return d


# ---------- Validations ----------
def add_approval(agent: str, kind: str, title: str, details: str = "", payload: dict | None = None) -> int:
    with _lock:
        cur = db().execute(
            "INSERT INTO approvals(agent, kind, title, details, payload, created_at) VALUES (?,?,?,?,?,?)",
            (agent, kind, title[:300], details[:4000], json.dumps(payload or {}, ensure_ascii=False), time.time()))
        db().commit()
        return cur.lastrowid


def get_approval(aid: int) -> dict | None:
    with _lock:
        return _row(db().execute("SELECT * FROM approvals WHERE id=?", (aid,)).fetchone())


def list_approvals(status: str | None = None, limit: int = 100) -> list[dict]:
    with _lock:
        if status:
            rows = db().execute("SELECT * FROM approvals WHERE status=? ORDER BY id DESC LIMIT ?", (status, limit))
        else:
            rows = db().execute("SELECT * FROM approvals ORDER BY id DESC LIMIT ?", (limit,))
        return [_row(r) for r in rows.fetchall()]


def decide(aid: int, approved: bool, by: str) -> bool:
    """Passe une action 'pending' à 'approved' ou 'rejected'. Renvoie False si déjà décidée
    (évite qu'un double clic, ou l'écran + Telegram en même temps, l'exécutent deux fois)."""
    with _lock:
        cur = db().execute(
            "UPDATE approvals SET status=?, decided_at=?, decided_by=? WHERE id=? AND status='pending'",
            ("approved" if approved else "rejected", time.time(), by, aid))
        db().commit()
        return cur.rowcount == 1


def set_result(aid: int, status: str, result: str) -> None:
    with _lock:
        db().execute("UPDATE approvals SET status=?, result=? WHERE id=?", (status, result[:4000], aid))
        db().commit()


def approvals_since(ts: float) -> list[dict]:
    with _lock:
        return [_row(r) for r in db().execute(
            "SELECT * FROM approvals WHERE created_at>=? OR decided_at>=? ORDER BY id", (ts, ts)).fetchall()]


# ---------- Journal ----------
def log(agent: str, action: str, details: str = "") -> None:
    with _lock:
        db().execute("INSERT INTO journal(ts, agent, action, details) VALUES (?,?,?,?)",
                     (time.time(), agent, action, details[:2000]))
        db().commit()


def journal_since(ts: float) -> list[dict]:
    with _lock:
        return [dict(r) for r in db().execute("SELECT * FROM journal WHERE ts>=? ORDER BY id", (ts,)).fetchall()]


# ---------- Rapports ----------
def save_report(day: str, text: str) -> None:
    with _lock:
        db().execute("INSERT OR REPLACE INTO reports(day, text, created_at) VALUES (?,?,?)", (day, text, time.time()))
        db().commit()


def last_report() -> dict | None:
    with _lock:
        r = db().execute("SELECT * FROM reports ORDER BY created_at DESC LIMIT 1").fetchone()
        return dict(r) if r else None


# ---------- Petite mémoire clé/valeur ----------
def kv_get(key: str, default=None):
    with _lock:
        r = db().execute("SELECT value FROM kv WHERE key=?", (key,)).fetchone()
        return json.loads(r["value"]) if r else default


def kv_set(key: str, value) -> None:
    with _lock:
        db().execute("INSERT OR REPLACE INTO kv(key, value) VALUES (?,?)", (key, json.dumps(value, ensure_ascii=False)))
        db().commit()

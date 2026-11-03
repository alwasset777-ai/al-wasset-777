import json
import shutil
import sqlite3
import subprocess

import pytest

import actions
import agents
import company
import config
import store
import tools_firestore as fs
import tools_media
import tools_meta
import tools_telegram
from utils import normalize_phone, phone_valid, whatsapp_link


# ---------- Outils de base ----------
def test_phones():
    assert normalize_phone("0661234567") == "+212661234567"
    assert normalize_phone("+212 661-234567") == "+212661234567"
    assert normalize_phone("00212661234567") == "+212661234567"
    assert phone_valid("0700112233") and not phone_valid("06 12")
    assert whatsapp_link("0655443322", "Salam ça va").startswith("https://wa.me/212655443322?text=Salam%20%C3%A7a")


def test_decision_only_once():
    aid = store.add_approval("community", "rnd_tool", "test", "", {"repo": "x"})
    assert store.decide(aid, True, "bureau") is True
    assert store.decide(aid, True, "telegram") is False  # double clic / écran + Telegram


# ---------- Data Auditor ----------
def test_audit_finds_duplicates_missing_and_bad_phones():
    res = agents.audit(fs.get_repo().list(fs.REGISTRY))
    assert res["doublons"] == [{"garder": "reg-demo-1", "archiver": ["reg-demo-2"]}]
    assert any(m["id"] == "reg-demo-3" and "location" in m["manque"] for m in res["champs_manquants"])
    assert res["telephones_invalides"] == ["reg-demo-3"]


def test_auditor_backup_and_archive_after_approval():
    out = agents.auditor({"order": None, "mode": "routine"})
    assert "sauvegarde OK" in out["summary"]
    assert list(config.BACKUP_DIR.glob("sauvegarde-*.json"))
    pending = store.list_approvals("pending")
    assert [a["kind"] for a in pending] == ["db_archive"]
    agents.auditor({"order": None, "mode": "routine"})
    assert len(store.list_approvals("pending")) == 1  # pas proposé deux fois
    msg = actions.decide_and_execute(pending[0]["id"], True, "bureau")
    assert msg.startswith("✅")
    assert fs.get_repo().data[fs.REGISTRY]["reg-demo-2"]["archived"] is True
    assert "reg-demo-1" in fs.get_repo().data[fs.REGISTRY]  # rien n'est effacé


# ---------- Community Manager ----------
def test_community_drafts_whatsapp_replies_once():
    out = agents.community({"order": None, "mode": "routine"})
    pending = store.list_approvals("pending")
    assert out["kpis"]["messages"] == 2 and len(pending) == 2
    assert all(a["kind"] == "reply_whatsapp" for a in pending)
    agents.community({"order": None, "mode": "routine"})
    assert len(store.list_approvals("pending")) == 2  # déjà vus : pas de doublon
    arabic = next(a for a in pending if a["payload"]["phone"] == "0611223344")
    assert "السلام" in arabic["payload"]["text"]  # répond dans la langue du client
    msg = actions.decide_and_execute(arabic["id"], True, "bureau")
    assert "https://wa.me/212611223344?text=" in msg


def test_refusal_does_nothing():
    agents.community({"order": None, "mode": "routine"})
    a = store.list_approvals("pending")[0]
    assert actions.decide_and_execute(a["id"], False, "bureau").startswith("Refusé")
    assert store.get_approval(a["id"])["status"] == "rejected"
    assert "déjà traitée" in actions.decide_and_execute(a["id"], True, "bureau")


# ---------- Media Buyer : sécurité budget ----------
def test_budget_is_capped():
    assert tools_meta.clamp_budget(99999) == config.BUDGET_MAX_JOUR == 80
    assert tools_meta.clamp_budget("abc") == 80 and tools_meta.clamp_budget(-5) == 1


def test_campaign_always_created_paused(monkeypatch):
    monkeypatch.setattr(config, "META_AD_ACCOUNT_ID", "act_1")
    monkeypatch.setattr(config, "META_ADS_TOKEN", "tok")
    calls = []

    class R:
        status_code = 200

        def __init__(self, data):
            self._d = data

        def json(self):
            return self._d

    def fake_post(url, data=None, timeout=None):
        calls.append((url, data))
        return R({"id": f"id{len(calls)}"})

    monkeypatch.setattr(tools_meta.requests, "post", fake_post)
    r = tools_meta.create_paused_campaign({"nom": "Promo", "budget_jour": 5000, "duree_jours": 90})
    assert len(calls) == 2
    assert all(d["status"] == "PAUSED" for _, d in calls)
    assert calls[0][0].endswith("/act_1/campaigns") and json.loads(calls[0][1]["special_ad_categories"]) == ["HOUSING"]
    assert calls[1][1]["daily_budget"] == "8000"  # 80 × 100 centimes, jamais 5000
    assert r["jours"] == 30
    assert json.loads(calls[1][1]["targeting"])["geo_locations"]["custom_locations"][0]["radius"] >= 25


def test_media_buyer_without_meta_never_requests_spending():
    out = agents.media_buyer({"order": "Promo villa", "mode": "ordre"})
    assert "pas encore branché" in out["summary"]
    assert store.list_approvals("pending") == []


# ---------- Telegram : seul le patron peut valider ----------
def test_telegram_only_owner_can_decide(monkeypatch):
    monkeypatch.setattr(config, "TELEGRAM_CHAT_ID", "42")
    sent = []
    monkeypatch.setattr(tools_telegram, "call", lambda method, **p: sent.append((method, p)) or {})
    decisions = []
    on_decision = lambda aid, ok, by: decisions.append((aid, ok, by)) or "ok"  # noqa: E731
    stranger = {"callback_query": {"id": "c1", "data": "ok:7", "message": {"chat": {"id": 999}, "message_id": 1}}}
    tools_telegram.handle_update(stranger, on_decision, None, None)
    assert decisions == []
    owner = {"callback_query": {"id": "c2", "data": "ok:7", "message": {"chat": {"id": 42}, "message_id": 1, "text": "x"}}}
    tools_telegram.handle_update(owner, on_decision, None, None)
    assert decisions == [(7, True, "telegram")]
    orders = []
    tools_telegram.handle_update({"message": {"chat": {"id": 999}, "text": "/ordre pirate"}}, None, orders.append, None)
    tools_telegram.handle_update({"message": {"chat": {"id": 42}, "text": "/ordre Promo Hamria"}}, None,
                                 lambda o: orders.append(o) or "ok", None)
    assert orders == ["Promo Hamria"]


# ---------- R&D / QA ----------
def test_qa_flags_risky_replies():
    store.add_approval("community", "reply_whatsapp", "a", "", {"text": ""})
    store.add_approval("community", "reply_whatsapp", "b", "", {"text": "Je vous garantis le prix final"})
    store.add_approval("community", "reply_whatsapp", "c", "", {"text": "Bonjour, quand voulez-vous visiter ?"})
    qa = agents.qa_check_replies(store.list_approvals("pending"))
    assert qa["note"] == pytest.approx(3.3, abs=0.1) and len(qa["problemes"]) == 2


# ---------- Directeur : journée complète + mémoire sur disque ----------
def test_full_routine_report_and_memory(monkeypatch):
    import scout
    monkeypatch.setattr(scout, "run", lambda top_n, emit: {"analyses": 10, "propositions": [
        {"repo": "a/b", "url": "https://github.com/a/b", "score": 90, "stars": 1, "licence": "MIT",
         "description": "outil", "agents": {"ceo": ["memory"]}, "alertes": [], "avis_ia": None}]})
    report = company.run("", "routine")
    assert "RAPPORT" in report and "À VALIDER PAR VOUS" in report and "PLAN DE DEMAIN" in report
    for label in ["Community Manager", "Data Auditor", "DB Manager", "R&D / QA", "Media Buyer", "Créatif"]:
        assert label in report
    kinds = {a["kind"] for a in store.list_approvals("pending")}
    assert {"reply_whatsapp", "db_archive", "rnd_tool"} <= kinds
    assert store.last_report()["text"] == report
    rows = sqlite3.connect(config.MEMORY_PATH).execute("SELECT COUNT(*) FROM checkpoints").fetchone()[0]
    assert rows > 0  # la journée est gardée en mémoire sur disque


def test_ceo_routes_orders_by_keywords():
    assert "media_buyer" in company.choose_agents("Lance une campagne pub pour la villa")
    assert "creatif" in company.choose_agents("Fais une vidéo du bien")


# ---------- Créatif : vidéo FFmpeg ----------
@pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="FFmpeg absent")
def test_slideshow_video(tmp_path):
    imgs = []
    for i, color in enumerate(["red", "blue"]):
        p = tmp_path / f"p{i}.jpg"
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", f"color=c={color}:s=800x600",
                        "-frames:v", "1", str(p)], check=True)
        imgs.append(p)
    out = tools_media.slideshow(imgs, "test video", seconds=1.0, size=(540, 960))
    assert out.exists() and out.stat().st_size > 1000
    probe = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
                            "-of", "csv=p=0", str(out)], capture_output=True, text=True, check=True)
    assert probe.stdout.strip() == "540,960"


# ---------- Serveur : boutons + protections ----------
def test_server_api_and_protections():
    from fastapi.testclient import TestClient
    import server
    with TestClient(server.app) as client:
        assert client.get("/").status_code == 200
        assert client.get("/static/office.js").status_code == 200
        agents.community({"order": None, "mode": "routine"})
        aid = store.list_approvals("pending")[0]["id"]
        r = client.post(f"/api/approbations/{aid}", json={"decision": True})
        assert r.status_code == 200 and "wa.me" in r.json()["message"]
        assert client.post("/api/approbations/99999", json={"decision": True}).status_code == 404
        assert client.post("/api/routine").status_code == 422  # formulaire piégé sans JSON : refusé
        assert client.get("/", headers={"host": "evil.example"}).status_code == 400  # autre adresse : refusé
        assert client.get("/api/statut").json()["ia"] == "démo (sans IA)"


def test_telegram_setup_mode_only_gives_chat_id(monkeypatch):
    monkeypatch.setattr(config, "TELEGRAM_CHAT_ID", "")
    sent = []
    monkeypatch.setattr(tools_telegram, "call", lambda method, **p: sent.append((method, p)) or {})
    called = []
    tools_telegram.handle_update({"message": {"chat": {"id": 555}, "text": "/ordre lance une pub"}},
                                 lambda *a: called.append(a), lambda o: called.append(o), lambda c: called.append(c))
    assert called == []  # aucune action
    assert sent and "555" in sent[0][1]["text"]


def test_firebase_path_relative_to_folder(monkeypatch):
    import importlib
    monkeypatch.setenv("FIREBASE_CREDENTIALS", "service-account.json")
    cfg = importlib.reload(config)
    try:
        assert cfg.FIREBASE_CREDENTIALS == str(cfg.BASE / "service-account.json")
    finally:
        monkeypatch.setenv("FIREBASE_CREDENTIALS", "")
        importlib.reload(config)

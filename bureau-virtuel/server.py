"""Le Bureau Virtuel : écran en direct + boutons Valider/Refuser + ordres + routine quotidienne.
Lancer :  python server.py      puis ouvrir http://127.0.0.1:8000
"""
import threading
import time
from contextlib import asynccontextmanager
from pathlib import Path

import uvicorn
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

import actions
import company
import config
import reglages
import store
import tools_telegram

STATIC = Path(__file__).with_name("static")
clients: set[WebSocket] = set()
history: list[dict] = []
_busy = threading.Lock()
_stop = threading.Event()
_sched = None
_telegram_thread = None


# ---------- Lancer le travail en arrière-plan ----------
def start_run(order: str, mode: str) -> str:
    if not _busy.acquire(blocking=False):
        return "L'équipe travaille déjà : réessayez dans un instant."

    def job():
        try:
            company.run(order, mode)
        except Exception as e:
            store.log("ceo", "erreur", str(e))
            try:
                tools_telegram.send(f"⚠️ Erreur pendant le travail : {e}")
            except Exception:
                pass
        finally:
            _busy.release()
    threading.Thread(target=job, name=f"run-{mode}", daemon=True).start()
    return "C'est parti : l'équipe se réunit." if mode == "ordre" else "Routine du jour lancée."


def telegram_command(cmd: str) -> str:
    if cmd in ("/start", "/aide"):
        return ("Commandes :\n/ordre <texte> — donner un ordre\n/routine — lancer la routine du jour\n"
                "/attente — actions à valider\n/rapport — dernier rapport\nUn message simple = un ordre.")
    if cmd == "/rapport":
        r = store.last_report()
        return r["text"] if r else "Pas encore de rapport."
    if cmd == "/routine":
        return start_run("", "routine")
    if cmd == "/attente":
        pending = store.list_approvals("pending")
        for a in pending[:10]:
            tools_telegram.send_approval(a)
        return f"{len(pending)} action(s) en attente." if pending else "Rien à valider."
    return "Commande inconnue. Tapez /aide"


def daily_routine():
    start_run("", "routine")


def ensure_telegram() -> None:
    """Démarre l'écoute Telegram dès qu'un jeton existe (aussi après l'avoir collé dans les Réglages)."""
    global _telegram_thread
    if config.TELEGRAM_BOT_TOKEN and not (_telegram_thread and _telegram_thread.is_alive()):
        _telegram_thread = tools_telegram.start_polling(
            actions.decide_and_execute, lambda o: start_run(o, "ordre"), telegram_command, _stop, reglages.bind_telegram)


def schedule_routine() -> None:
    hour, minute = (config.HEURE_ROUTINE.split(":") + ["0"])[:2]
    _sched.add_job(daily_routine, "cron", hour=int(hour), minute=int(minute), id="routine", replace_existing=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _sched
    store.connect()
    from apscheduler.schedulers.background import BackgroundScheduler
    _sched = BackgroundScheduler(timezone=config.FUSEAU)
    schedule_routine()
    _sched.start()
    ensure_telegram()
    print(f"\n  Bureau Virtuel prêt : http://{config.HOST}:{config.PORT}\n  Routine quotidienne à {config.HEURE_ROUTINE}\n")
    yield
    _stop.set()
    _sched.shutdown(wait=False)


app = FastAPI(title="Bureau Virtuel", lifespan=lifespan)
# Protection : le bureau ne répond qu'aux adresses locales (évite qu'un site piégé le pilote).
app.add_middleware(TrustedHostMiddleware, allowed_hosts=["127.0.0.1", "localhost", config.HOST, "testserver"])
app.mount("/static", StaticFiles(directory=STATIC), name="static")


@app.middleware("http")
async def anti_forgery(request, call_next):
    """Toute action (POST) doit venir de la page du bureau elle-même : un autre site ne peut rien déclencher."""
    if request.method not in ("GET", "HEAD", "OPTIONS"):
        origin = request.headers.get("origin")
        if request.headers.get("x-bureau") != "1" or (origin and origin.split("://", 1)[-1] != request.headers.get("host")):
            return JSONResponse({"detail": "refusé"}, status_code=403)
    return await call_next(request)


@app.get("/reglages")
def settings_page():
    return FileResponse(STATIC / "reglages.html")


@app.get("/")
def office():
    return FileResponse(STATIC / "index.html")


@app.websocket("/ws")
async def ws(sock: WebSocket):
    origin = sock.headers.get("origin", "")
    host = sock.headers.get("host", "")
    if origin and origin.split("://", 1)[-1] != host:
        await sock.close(code=1008)  # page d'un autre site : refusé
        return
    await sock.accept()
    clients.add(sock)
    for e in history[-40:]:
        await sock.send_json(e)
    try:
        while True:
            await sock.receive_text()
    except WebSocketDisconnect:
        clients.discard(sock)


@app.post("/event")
async def event(e: dict):
    e.setdefault("ts", time.time())
    history.append(e)
    del history[:-500]
    for c in list(clients):
        try:
            await c.send_json(e)
        except Exception:
            clients.discard(c)
    return {"ok": True}


class Order(BaseModel):
    texte: str = Field(min_length=2, max_length=2000)


class Decision(BaseModel):
    decision: bool


class Confirm(BaseModel):
    ok: bool = True


@app.post("/api/ordre")
def api_order(o: Order):
    return {"message": start_run(o.texte.strip(), "ordre")}


@app.post("/api/routine")
def api_routine(_: Confirm):  # corps JSON obligatoire : bloque les formulaires piégés d'autres sites
    return {"message": start_run("", "routine")}


@app.get("/api/approbations")
def api_approvals(statut: str | None = None):
    return store.list_approvals(statut, limit=60)


@app.post("/api/approbations/{aid}")
def api_decide(aid: int, d: Decision):
    if not store.get_approval(aid):
        raise HTTPException(404, "introuvable")
    return {"message": actions.decide_and_execute(aid, d.decision, "bureau"), "approval": store.get_approval(aid)}


@app.get("/api/rapport")
def api_report():
    return store.last_report() or {"text": "Pas encore de rapport. Lancez la routine ou donnez un ordre."}


class Setting(BaseModel):
    cle: str
    valeur: str | list[str] = ""


class MetaToken(BaseModel):
    token: str = Field(min_length=10, max_length=2000)
    page_id: str | None = None
    ad_id: str | None = None


class FirebaseFile(BaseModel):
    contenu: str = Field(min_length=10, max_length=20000)


@app.get("/api/reglages")
def api_settings():
    return reglages.status()


@app.post("/api/reglages/cle")
def api_save_setting(s: Setting):
    cle, val = s.cle, s.valeur
    if cle == "GEMINI_API_KEY":
        ok, msg = reglages.check_gemini(str(val).strip())
        if not ok:
            raise HTTPException(400, msg)
    elif cle == "TELEGRAM_BOT_TOKEN":
        bot = reglages.telegram_bot(str(val).strip())
        if not bot:
            raise HTTPException(400, "❌ رمز البوت غير صالح، انسخه من BotFather من جديد")
        msg = f"✅ البوت @{bot['username']} جاهز. اضغط الآن زر «ربط تيليغرام»"
        reglages.save_env({"TELEGRAM_CHAT_ID": ""})  # nouveau bot : on refait la liaison
    elif cle == "AGENTS_ACTIFS":
        names = [a for a in (val if isinstance(val, list) else str(val).split(",")) if a in config.ALL_AGENTS]
        val, msg = ",".join(names), "✅ تم حفظ الوكلاء المفعّلين"
    elif cle == "BUDGET_MAX_JOUR":
        if not str(val).isdigit() or not 1 <= int(val) <= 100000:
            raise HTTPException(400, "اكتب رقماً صحيحاً")
        msg = "✅ تم حفظ سقف الميزانية"
    elif cle == "HEURE_ROUTINE":
        import re
        if not re.fullmatch(r"([01]\d|2[0-3]):[0-5]\d", str(val)):
            raise HTTPException(400, "اكتب الساعة هكذا: 08:00")
        msg = "✅ تم حفظ ساعة التقرير اليومي"
    elif cle == "GITHUB_TOKEN":
        msg = "✅ تم الحفظ"
    else:
        raise HTTPException(400, "إعداد غير مسموح")
    reglages.save_env({cle: val if isinstance(val, str) else ",".join(val)})
    if cle == "TELEGRAM_BOT_TOKEN":
        ensure_telegram()
    if cle == "HEURE_ROUTINE" and _sched:
        schedule_routine()
    return {"message": msg, "statut": reglages.status()}


@app.post("/api/reglages/meta")
def api_save_meta(m: MetaToken):
    try:
        info = reglages.save_meta(m.token.strip(), m.page_id, m.ad_id)
    except Exception as e:
        raise HTTPException(400, f"❌ {e}")
    return {"message": f"✅ تم الربط: صفحة «{info['page']}»"
                       + (f"، إنستغرام @{info['instagram']}" if info["instagram"] else "، (بدون إنستغرام)")
                       + (f"، حساب الإشهار «{info['pub']}» ({info['devise']})" if info["pub"] else "، (بدون حساب إشهار)"),
            "details": info, "statut": reglages.status()}


@app.post("/api/reglages/firebase")
def api_save_firebase(f: FirebaseFile):
    try:
        msg = reglages.save_firebase(f.contenu)
    except Exception as e:
        raise HTTPException(400, f"❌ {e}")
    return {"message": msg, "statut": reglages.status()}


@app.post("/api/reglages/test-telegram")
def api_test_telegram():
    if not tools_telegram.enabled():
        raise HTTPException(400, "تيليغرام غير مربوط بعد")
    tools_telegram.send("👋 رسالة تجربة من المكتب الافتراضي: كل شيء يعمل.")
    return {"message": "✅ أُرسلت رسالة التجربة إلى تيليغرام"}


@app.get("/api/statut")
def api_status():
    return {**config.statut_connexions(), "occupe": _busy.locked()}


if __name__ == "__main__":
    uvicorn.run(app, host=config.HOST, port=config.PORT, log_level="warning")

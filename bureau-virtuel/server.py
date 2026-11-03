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
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

import actions
import company
import config
import store
import tools_telegram

STATIC = Path(__file__).with_name("static")
clients: set[WebSocket] = set()
history: list[dict] = []
_busy = threading.Lock()
_stop = threading.Event()


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


@asynccontextmanager
async def lifespan(app: FastAPI):
    store.connect()
    from apscheduler.schedulers.background import BackgroundScheduler
    hour, minute = (config.HEURE_ROUTINE.split(":") + ["0"])[:2]
    sched = BackgroundScheduler(timezone=config.FUSEAU)
    sched.add_job(daily_routine, "cron", hour=int(hour), minute=int(minute), id="routine")
    sched.start()
    if config.TELEGRAM_BOT_TOKEN:  # sans TELEGRAM_CHAT_ID : le bot donne seulement votre numéro de chat
        tools_telegram.start_polling(actions.decide_and_execute, lambda o: start_run(o, "ordre"), telegram_command, _stop)
    print(f"\n  Bureau Virtuel prêt : http://{config.HOST}:{config.PORT}\n  Routine quotidienne à {config.HEURE_ROUTINE}\n")
    yield
    _stop.set()
    sched.shutdown(wait=False)


app = FastAPI(title="Bureau Virtuel", lifespan=lifespan)
# Protection : le bureau ne répond qu'aux adresses locales (évite qu'un site piégé le pilote).
app.add_middleware(TrustedHostMiddleware, allowed_hosts=["127.0.0.1", "localhost", config.HOST, "testserver"])
app.mount("/static", StaticFiles(directory=STATIC), name="static")


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


@app.get("/api/statut")
def api_status():
    return {**config.statut_connexions(), "occupe": _busy.locked()}


if __name__ == "__main__":
    uvicorn.run(app, host=config.HOST, port=config.PORT, log_level="warning")

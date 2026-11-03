"""1. Le DIRECTEUR (CEO) et l'organisation de l'entreprise (LangGraph).
Ordre ou routine → réunion → le Directeur choisit les agents → ils travaillent EN PARALLÈLE
→ réunion de synthèse → rapport (bureau + Telegram).
La mémoire de chaque journée est gardée sur disque (data/memoire.db)."""
import datetime as dt
import operator
import sqlite3
import uuid
from typing import Annotated, TypedDict

from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import Send

import config
import llm
import store
import tools_telegram
from agents import AGENT_FUNCS, AGENT_LABELS
from events import emit, pause

KEYWORDS = {
    "creatif": ["vidéo", "video", "photo", "visuel", "affiche", "reel", "légende", "فيديو", "صور"],
    "community": ["message", "commentaire", "répond", "client", "whatsapp", "dm", "رسائل", "تعليق"],
    "media_buyer": ["pub", "campagne", "sponsor", "ads", "budget", "promo", "إشهار", "اعلان"],
    "db_manager": ["ajoute", "ajouter", "modifie", "bien", "base", "registre", "زيد", "بدل"],
    "auditor": ["doublon", "sauvegarde", "backup", "nettoie", "audit", "vérifie"],
    "rnd": ["github", "outil", "qualité", "amélior", "veille"],
}


class State(TypedDict):
    order: str
    mode: str
    plan: list[str]
    results: Annotated[list[dict], operator.add]
    report: str


def choose_agents(order: str) -> list[str]:
    active = config.AGENTS_ACTIFS
    if llm.available():
        picked = llm.ask_json(
            "Tu es le Directeur d'une agence immobilière. Choisis les agents utiles pour l'ordre, parmi : "
            + ", ".join(f"{a} ({AGENT_LABELS[a]})" for a in active) + ". Réponds par une liste JSON de noms.",
            order, None)
        if isinstance(picked, list):
            picked = [a for a in picked if a in active]
            if picked:
                return picked
    low = order.lower()
    picked = [a for a in active if any(k in low for k in KEYWORDS[a])]
    return picked or list(active)


def ceo_plan(state: State):
    team = config.AGENTS_ACTIFS
    for a in ["ceo", *team]:
        emit(a, "walk", "Réunion", target="meeting")
    pause()
    if state["mode"] == "routine":
        emit("ceo", "working", "Routine du jour : chacun fait sa tournée")
        plan = list(team)
    else:
        emit("ceo", "working", f"Ordre reçu : {state['order'][:120]}")
        plan = choose_agents(state["order"])
    memo = store.kv_get("memoire_ordres", [])
    memo.append({"date": dt.datetime.now().isoformat(timespec="minutes"), "ordre": state["order"], "equipe": plan})
    store.kv_set("memoire_ordres", memo[-50:])
    emit("ceo", "done", "Équipe : " + ", ".join(AGENT_LABELS[a] for a in plan))
    for a in team:
        if a not in plan:
            emit(a, "walk", "Pas concerné : je retourne travailler", target="desk")
    return {"plan": plan}


def dispatch(state: State):
    return [Send("worker", {"agent": a, "order": state["order"], "mode": state["mode"]}) for a in state["plan"]]


def worker(task: dict):
    name = task["agent"]
    emit(name, "walk", "Retour au bureau", target="desk")
    pause()
    try:
        res = AGENT_FUNCS[name]({"order": task["order"], "mode": task["mode"]})
    except Exception as e:  # un agent en panne ne bloque pas les autres
        emit(name, "error", f"Erreur : {e}")
        res = {"agent": name, "summary": f"ERREUR : {e}", "kpis": {}, "status": "erreur"}
    store.log(name, "travail", res["summary"])
    return {"results": [res]}


def build_report(state: State, since: float) -> str:
    today = dt.date.today().strftime("%d/%m/%Y")
    res = {r["agent"]: r for r in state["results"]}
    approvals = store.approvals_since(since)
    pending = store.list_approvals("pending")
    errors = [r for r in state["results"] if r["status"] == "erreur"]
    health = "🔴 Rouge" if len(errors) >= 2 else "🟠 Orange" if errors or len(pending) > 10 else "🟢 Vert"
    k = lambda a, key, d="—": (res.get(a, {}).get("kpis") or {}).get(key, d)  # noqa: E731

    lines = [f"🏢 RAPPORT — {config.AGENCE_NOM} — {today}",
             f"{'Ordre : ' + state['order'] if state['mode'] == 'ordre' else 'Routine quotidienne'}",
             "━━━━━━━━━━━━━━━━━━",
             f"SANTÉ GLOBALE : {health} — {len(errors)} agent(s) en erreur, {len(pending)} action(s) à valider",
             "", f"⏳ À VALIDER PAR VOUS ({len(pending)})"]
    lines += [f"{i}. #{a['id']} [{AGENT_LABELS.get(a['agent'], a['agent'])}] {a['title']}"
              for i, a in enumerate(pending[:10], 1)] or ["Rien à valider."]
    if len(pending) > 10:
        lines.append(f"… et {len(pending) - 10} autres (voir le bureau)")
    lines += ["", "📊 CHIFFRES",
              f"• Biens au registre : {k('db_manager', 'biens')} (nouveaux 24 h : {k('db_manager', 'biens_24h')})",
              f"• Demandes clients 24 h : {k('db_manager', 'demandes_24h')}",
              f"• Nouveaux messages : {k('community', 'messages')} — chauds : {k('community', 'prospects_chaud')}, "
              f"tièdes : {k('community', 'prospects_tiede')}",
              (f"• Pub hier : dépensé {k('media_buyer', 'depense_hier')} — clics {k('media_buyer', 'clics_hier')} — "
               f"coût/clic {k('media_buyer', 'cout_par_clic')}") if config.META_AD_ACCOUNT_ID else
              "• Pub : compte publicitaire Meta pas encore branché",
              f"• Données : {k('auditor', 'doublons')} doublon(s), {k('auditor', 'fiches_incompletes')} fiche(s) incomplète(s)",
              f"• Qualité des réponses (QA) : {k('rnd', 'note_qualite')}/10",
              "", "✅ FAIT (par agent)"]
    lines += [f"• {AGENT_LABELS[r['agent']]} : {r['summary']}" for r in state["results"]]
    done = [a for a in approvals if a["status"] in ("done", "failed", "rejected")]
    if done:
        lines += ["", "🧾 DÉCISIONS EXÉCUTÉES"] + [f"• #{a['id']} {a['status']} — {a['title']}" for a in done[:10]]
    lines += ["", "⚠️ PROBLÈMES"] + ([f"• {AGENT_LABELS[r['agent']]} : {r['summary'][:200]}" for r in errors] or ["Aucun."])

    plan = None
    if llm.available():
        try:
            plan = llm.ask("Tu es le Directeur. Donne 3 priorités pour demain, une par ligne, très courtes.",
                           "\n".join(lines))
        except Exception:
            plan = None
    if not plan:
        plan = "\n".join(filter(None, [
            "1. Valider les actions en attente" if pending else "",
            "2. Rappeler les prospects chauds" if k("community", "prospects_chaud", 0) else "",
            "3. Compléter les fiches incomplètes" if k("auditor", "fiches_incompletes", 0) else ""])) or "1. Continuer la routine"
    lines += ["", "🎯 PLAN DE DEMAIN", plan.strip(), "", f"💰 Coût IA : 0 DH ({config.statut_connexions()['ia']})"]
    return "\n".join(lines)


def ceo_report(state: State):
    for a in ["ceo", *state["plan"]]:
        emit(a, "walk", "Réunion de synthèse", target="meeting")
    pause()
    emit("ceo", "working", "Je rédige le rapport")
    report = build_report(state, store.kv_get("run_started", 0))
    store.save_report(dt.date.today().isoformat() + ("" if state["mode"] == "routine" else "-ordre-" + uuid.uuid4().hex[:4]), report)
    try:
        tools_telegram.send(report)
    except Exception as e:
        store.log("ceo", "telegram_erreur", str(e))
    emit("ceo", "done", "Rapport prêt", report=True)
    for a in ["ceo", *state["plan"]]:
        emit(a, "walk", "Retour au bureau", target="desk")
    return {"report": report}


def build_graph(checkpointer):
    g = StateGraph(State)
    g.add_node("ceo_plan", ceo_plan)
    g.add_node("worker", worker)
    g.add_node("ceo_report", ceo_report)
    g.add_edge(START, "ceo_plan")
    g.add_conditional_edges("ceo_plan", dispatch, ["worker"])
    g.add_edge("worker", "ceo_report")
    g.add_edge("ceo_report", END)
    return g.compile(checkpointer=checkpointer)


_graph = None


def graph():
    global _graph
    if _graph is None:
        conn = sqlite3.connect(str(config.MEMORY_PATH), check_same_thread=False)
        _graph = build_graph(SqliteSaver(conn))
    return _graph


def run(order: str = "", mode: str = "ordre") -> str:
    import time
    store.kv_set("run_started", time.time())
    thread = f"{mode}-{dt.date.today().isoformat()}-{uuid.uuid4().hex[:6]}"
    out = graph().invoke({"order": order, "mode": mode, "results": [], "plan": [], "report": ""},
                         {"configurable": {"thread_id": thread}})
    return out["report"]


if __name__ == "__main__":
    import sys
    text = " ".join(sys.argv[1:])
    print(run(text, "ordre" if text else "routine"))

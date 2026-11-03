"""Les actions sensibles (publier, répondre, dépenser, modifier la base) passent toutes ici :
1) l'agent DEMANDE (request) → la demande apparaît dans le bureau et sur Telegram ;
2) vous validez ou refusez (decide_and_execute) → l'action s'exécute une seule fois."""
import events
import store
import tools_firestore as fs
import tools_meta
import tools_telegram
from utils import whatsapp_link


def request(agent: str, kind: str, title: str, details: str, payload: dict) -> int:
    aid = store.add_approval(agent, kind, title, details, payload)
    store.log(agent, "demande_validation", f"#{aid} {title}")
    events.emit(agent, "waiting", f"#{aid} {title}", approval_id=aid)
    try:
        tools_telegram.send_approval(store.get_approval(aid))
    except Exception as e:
        store.log("ceo", "telegram_erreur", str(e))
    return aid


# ---------- Exécuteurs : un par type d'action ----------
def _reply_whatsapp(p):
    return "Message prêt : ouvrez ce lien pour l'envoyer sur WhatsApp → " + whatsapp_link(p["phone"], p["text"])


def _reply_fb(p):
    return f"Réponse publiée sur Facebook (id {tools_meta.reply_facebook_comment(p['target_id'], p['text'])})"


def _reply_ig(p):
    return f"Réponse publiée sur Instagram (id {tools_meta.reply_instagram_comment(p['target_id'], p['text'])})"


def _reply_messenger(p):
    return f"Message Messenger envoyé (id {tools_meta.send_messenger(p['recipient'], p['text'])})"


def _ads_campaign(p):
    r = tools_meta.create_paused_campaign(p["plan"])
    return (f"Campagne créée EN PAUSE (campagne {r['campaign_id']}, ensemble {r['adset_id']}, "
            f"{r['budget_jour']}/jour × {r['jours']} j). Ajoutez le visuel puis activez-la vous-même : "
            "https://adsmanager.facebook.com/")


def _ads_pause(p):
    tools_meta.pause_campaign(p["campaign_id"])
    return f"Campagne {p.get('campaign_name', p['campaign_id'])} mise en pause"


def _db_add(p):
    doc_id = fs.get_repo().add(fs.REGISTRY, fs.new_registry_fields(p["fields"]))
    return f"Bien ajouté au registre ({doc_id})"


ALLOWED_UPDATE = {"propertyType", "owner", "ownerPhone", "surface", "location", "price", "notes"}


def _db_update(p):
    fields = {k: str(v)[:500] for k, v in p["fields"].items() if k in ALLOWED_UPDATE}
    if not fields:
        raise ValueError("Aucun champ modifiable")
    fs.get_repo().update(fs.REGISTRY, p["id"], fields)
    return f"Bien {p['id']} modifié : {', '.join(fields)}"


def _db_archive(p):
    repo = fs.get_repo()
    for doc_id in p["ids"]:
        fs.archive(repo, p.get("collection", fs.REGISTRY), doc_id, p.get("reason", "doublon"))
    return f"{len(p['ids'])} fiche(s) archivée(s) (rien n'est effacé, c'est réversible)"


def _rnd_tool(p):
    return f"Noté : {p.get('repo')} sera étudié. Rien n'a été installé automatiquement."


EXECUTORS = {
    "reply_whatsapp": _reply_whatsapp, "reply_fb_comment": _reply_fb, "reply_ig_comment": _reply_ig,
    "reply_messenger": _reply_messenger, "ads_campaign": _ads_campaign, "ads_pause": _ads_pause,
    "db_add": _db_add, "db_update": _db_update, "db_archive": _db_archive, "rnd_tool": _rnd_tool,
}


def decide_and_execute(aid: int, approved: bool, by: str) -> str:
    a = store.get_approval(aid)
    if not a:
        return f"Action #{aid} introuvable"
    if not store.decide(aid, approved, by):
        return f"Action #{aid} déjà traitée ({a['status']})"
    agent = a["agent"]
    if not approved:
        store.log(agent, "refus", f"#{aid} par {by}")
        events.emit(agent, "done", f"#{aid} refusé : rien n'a été fait", approval_id=aid)
        return "Refusé : rien n'a été fait."
    events.emit(agent, "working", f"J'exécute #{aid}", approval_id=aid)
    try:
        result = EXECUTORS[a["kind"]](a["payload"])
        store.set_result(aid, "done", result)
        store.log(agent, "execution", f"#{aid} {result}")
        events.emit(agent, "done", f"#{aid} fait", approval_id=aid)
        return "✅ " + result
    except Exception as e:
        store.set_result(aid, "failed", str(e))
        store.log(agent, "echec", f"#{aid} {e}")
        events.emit(agent, "error", f"#{aid} échec : {e}", approval_id=aid)
        return f"⚠️ Échec de #{aid} : {e}"

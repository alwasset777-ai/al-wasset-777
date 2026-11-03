"""Les 6 agents spécialisés. Le Directeur (CEO) est dans company.py.
Chaque agent reçoit ctx = {"order": texte ou None, "mode": "ordre" | "routine"}
et renvoie {"agent", "summary", "kpis", "status"}.
Toute action publique, payante ou qui modifie la base passe par actions.request()."""
import datetime as dt

import actions
import config
import llm
import store
import tools_firestore as fs
import tools_media
import tools_meta
from events import emit
from utils import norm_text, normalize_phone, phone_valid

AGENT_LABELS = {
    "ceo": "Directeur", "creatif": "Créatif", "community": "Community Manager",
    "media_buyer": "Media Buyer", "db_manager": "DB Manager", "auditor": "Data Auditor", "rnd": "R&D / QA",
}


def _result(agent, summary, kpis=None, status="ok"):
    return {"agent": agent, "summary": summary, "kpis": kpis or {}, "status": status}


def _recent(items, hours=24):
    limit = dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=hours)
    out = []
    for it in items:
        try:
            if dt.datetime.fromisoformat(str(it.get("createdAt", "")).replace("Z", "+00:00")) >= limit:
                out.append(it)
        except ValueError:
            continue
    return out


# ======================= 3. COMMUNITY MANAGER =======================
CM_SYSTEM = """Tu es le Community Manager de l'agence immobilière {agence}.
Règles : réponds dans la langue du client (darija, arabe ou français), poli, chaleureux, court (3-4 phrases max).
Ne promets jamais de prix final ni de remise. Invite à une visite ou à un appel. Ne donne aucune information
personnelle d'un autre client. Guide de ton de la marque :
{marque}
Réponds en JSON strict : {{"temperature": "chaud|tiede|froid", "resume": "1 phrase", "reponse": "le texte à envoyer"}}"""

REPLY_KIND = {"inbox": "reply_whatsapp", "fb_comment": "reply_fb_comment",
              "ig_comment": "reply_ig_comment", "messenger": "reply_messenger"}
CHANNEL_LABEL = {"inbox": "site → WhatsApp", "fb_comment": "commentaire Facebook",
                 "ig_comment": "commentaire Instagram", "messenger": "Messenger"}


def _demo_draft(item):
    t = norm_text(item["text"])
    hot = any(k in t for k in ["visite", "visiter", "disponible", "prix", "شحال", "زيارة", "بغيت", "dispo"])
    name = item.get("author") or ""
    arabic = any("؀" <= ch <= "ۿ" for ch in item["text"])
    reponse = (f"السلام عليكم {name}، شكرا على رسالتك. يسعدنا نعاونوك، تقدر تتصل بنا ولا نحددو موعد للزيارة. — {config.AGENCE_NOM}"
               if arabic else
               f"Bonjour {name}, merci pour votre message. Nous serons ravis de vous aider : "
               f"souhaitez-vous fixer une visite ou être rappelé ? — {config.AGENCE_NOM}")
    return {"temperature": "chaud" if hot else "tiede", "resume": item["text"][:80], "reponse": reponse}


def _collect_messages(errors):
    items = []
    for d in fs.get_repo().list(fs.INBOX):
        if d.get("archived"):
            continue
        items.append({"channel": "inbox", "id": d["id"], "text": d.get("message", ""), "author": d.get("name", ""),
                      "phone": d.get("phone", ""), "context": d.get("propertyTitle") or d.get("kind", "")})
    sources = []
    if config.META_PAGE_ID and config.META_PAGE_TOKEN:
        sources += [tools_meta.facebook_comments, tools_meta.messenger_messages]
    if config.META_IG_USER_ID and config.META_PAGE_TOKEN:
        sources.append(tools_meta.instagram_comments)
    for src in sources:
        try:
            items += src()
        except Exception as e:
            errors.append(f"{src.__name__}: {e}")
    return items


def community(ctx):
    emit("community", "working", "Je lis les messages du site et des réseaux")
    errors: list[str] = []
    seen = set(store.kv_get("cm_seen", []))
    new = [i for i in _collect_messages(errors) if f"{i['channel']}:{i['id']}" not in seen][:15]
    temps = {"chaud": 0, "tiede": 0, "froid": 0}
    system = CM_SYSTEM.format(agence=config.AGENCE_NOM, marque=config.ton_marque())
    for item in new:
        emit("community", "working", f"Je prépare une réponse à {item['author']}")
        draft = llm.ask_json(system, f"Canal : {item['channel']}\nContexte : {item['context']}\n"
                                     f"Client : {item['author']}\nMessage : {item['text']}", _demo_draft(item))
        if not isinstance(draft, dict) or not draft.get("reponse"):
            draft = _demo_draft(item)
        temp = draft.get("temperature", "tiede") if draft.get("temperature") in temps else "tiede"
        temps[temp] += 1
        payload = {"text": draft["reponse"]}
        if item["channel"] == "inbox":
            payload["phone"] = item["phone"]
        elif item["channel"] == "messenger":
            payload["recipient"] = item["recipient"]
        else:
            payload["target_id"] = item["id"]
        actions.request("community", REPLY_KIND[item["channel"]],
                        f"Réponse à {item['author']} ({CHANNEL_LABEL[item['channel']]}) — {temp.upper()}",
                        f"Message reçu : {item['text']}\n\nRéponse proposée : {draft['reponse']}", payload)
        seen.add(f"{item['channel']}:{item['id']}")
    store.kv_set("cm_seen", sorted(seen)[-3000:])
    summary = f"{len(new)} nouveau(x) message(s), {len(new)} réponse(s) en brouillon à valider"
    if errors:
        summary += " | erreurs : " + "; ".join(errors)[:300]
    emit("community", "done", summary)
    return _result("community", summary, {"messages": len(new), **{f"prospects_{k}": v for k, v in temps.items()}},
                   "erreur" if errors and not new else "ok")


# ======================= 5. DB MANAGER =======================
DB_SYSTEM = """Tu es le gestionnaire de la base des biens de l'agence. Champs possibles :
propertyType, owner, ownerPhone, surface (m²), location, price (DH), notes.
À partir de l'ordre, réponds en JSON strict :
{"action": "ajouter|modifier|aucune", "id": "identifiant si modifier", "champs": {...}}"""


def db_manager(ctx):
    emit("db_manager", "working", "Je consulte la base")
    repo = fs.get_repo()
    registry = [r for r in repo.list(fs.REGISTRY) if not r.get("archived")]
    inbox = [d for d in repo.list(fs.INBOX) if not d.get("archived")]
    kpis = {"biens": len(registry), "biens_24h": len(_recent(registry)), "demandes_24h": len(_recent(inbox)),
            "base": "Firebase (réelle)" if repo.online else "démo"}
    summary = f"{kpis['biens']} biens ({kpis['biens_24h']} nouveaux en 24 h), {kpis['demandes_24h']} demandes clients en 24 h"
    if ctx["mode"] == "ordre" and ctx.get("order"):
        if not llm.available():
            summary += " | IA non configurée : je ne peux pas comprendre l'ordre"
        else:
            listing = "\n".join(f"{r['id']}: {r.get('propertyType')} {r.get('location')} {r.get('owner')}" for r in registry[:80])
            plan = llm.ask_json(DB_SYSTEM, f"Biens existants :\n{listing}\n\nOrdre : {ctx['order']}", {"action": "aucune"})
            if not isinstance(plan, dict):
                plan = {"action": "aucune"}
            action = plan.get("action")
            fields = plan.get("champs") if isinstance(plan.get("champs"), dict) else {}
            if action == "ajouter" and fields:
                actions.request("db_manager", "db_add", f"Ajouter un bien : {fields.get('propertyType', '')} {fields.get('location', '')}",
                                "\n".join(f"{k} : {v}" for k, v in fields.items()), {"fields": fields})
                summary += " | ajout proposé (à valider)"
            elif action == "modifier" and plan.get("id") and fields:
                actions.request("db_manager", "db_update", f"Modifier le bien {plan['id']}",
                                "\n".join(f"{k} → {v}" for k, v in fields.items()), {"id": plan["id"], "fields": fields})
                summary += " | modification proposée (à valider)"
    emit("db_manager", "done", summary)
    return _result("db_manager", summary, kpis)


# ======================= 6. DATA AUDITOR =======================
REQUIRED = ["propertyType", "owner", "ownerPhone", "location", "price"]


def audit(registry: list[dict]) -> dict:
    """Contrôles purs (sans IA) : doublons, champs manquants, téléphones invalides."""
    groups: dict[tuple, list[dict]] = {}
    for r in registry:
        key = (normalize_phone(r.get("ownerPhone", "")), norm_text(r.get("location", "")).replace(",", ""),
               norm_text(str(r.get("surface", ""))), norm_text(r.get("propertyType", "")))
        if key[0] and key[1]:
            groups.setdefault(key, []).append(r)
    duplicates = []
    for items in groups.values():
        if len(items) > 1:
            items = sorted(items, key=lambda x: str(x.get("createdAt", "")))
            duplicates.append({"garder": items[0]["id"], "archiver": [x["id"] for x in items[1:]]})
    missing = [{"id": r["id"], "manque": [f for f in REQUIRED if not str(r.get(f, "")).strip()]}
               for r in registry if any(not str(r.get(f, "")).strip() for f in REQUIRED)]
    bad_phones = [r["id"] for r in registry if r.get("ownerPhone") and not phone_valid(r["ownerPhone"])]
    return {"doublons": duplicates, "champs_manquants": missing, "telephones_invalides": bad_phones}


def auditor(ctx):
    emit("auditor", "working", "Sauvegarde puis contrôle des données")
    repo = fs.get_repo()
    errors = []
    try:
        path = fs.backup(repo)
        backup_msg = f"sauvegarde OK ({path.name})"
    except Exception as e:
        backup_msg = f"sauvegarde ÉCHEC ({e})"
        errors.append(backup_msg)
    registry = [r for r in repo.list(fs.REGISTRY) if not r.get("archived")]
    res = audit(registry)
    proposed = set(store.kv_get("audit_proposed", []))
    for dup in res["doublons"]:
        todo = [i for i in dup["archiver"] if i not in proposed]
        if todo:
            actions.request("auditor", "db_archive", f"Archiver {len(todo)} doublon(s) de {dup['garder']}",
                            f"On garde la fiche la plus ancienne : {dup['garder']}\nÀ archiver (réversible) : {', '.join(todo)}",
                            {"ids": todo, "reason": f"doublon de {dup['garder']}"})
            proposed.update(todo)
    store.kv_set("audit_proposed", sorted(proposed))
    kpis = {"doublons": sum(len(d["archiver"]) for d in res["doublons"]),
            "fiches_incompletes": len(res["champs_manquants"]), "telephones_invalides": len(res["telephones_invalides"]),
            "sauvegarde": backup_msg}
    summary = (f"{backup_msg} ; {kpis['doublons']} doublon(s), {kpis['fiches_incompletes']} fiche(s) incomplète(s), "
               f"{kpis['telephones_invalides']} téléphone(s) invalide(s)")
    if res["champs_manquants"]:
        summary += " | à compléter : " + ", ".join(f"{m['id']} ({'/'.join(m['manque'])})" for m in res["champs_manquants"][:5])
    emit("auditor", "done" if not errors else "error", summary)
    return _result("auditor", summary, kpis, "erreur" if errors else "ok")


# ======================= 4. MEDIA BUYER =======================
MB_SYSTEM = """Tu es le Media Buyer d'une agence immobilière à {ville}. Propose UNE campagne Meta simple.
Budget max par jour : {budget}. Réponds en JSON strict :
{{"nom": "...", "budget_jour": nombre, "duree_jours": nombre, "titre": "...", "texte": "texte de la pub", "kpi": "objectif chiffré"}}"""


def media_buyer(ctx):
    configured = bool(config.META_AD_ACCOUNT_ID and config.META_ADS_TOKEN)
    kpis, parts = {}, []
    if configured:
        emit("media_buyer", "working", "Je lis les résultats d'hier")
        try:
            rows = tools_meta.campaign_insights("yesterday")
            spend = sum(float(r.get("spend", 0)) for r in rows)
            clicks = sum(int(r.get("clicks", 0)) for r in rows)
            kpis = {"depense_hier": round(spend, 2), "clics_hier": clicks,
                    "cout_par_clic": round(spend / clicks, 2) if clicks else None}
            parts.append(f"hier : {spend:.0f} dépensés, {clicks} clics")
            asked = set(store.kv_get("mb_pause_asked", []))
            for r in rows:
                cpc = float(r.get("cpc") or 0)
                key = f"{r['campaign_id']}:{dt.date.today()}"
                if cpc > config.CPC_MAX and key not in asked:
                    actions.request("media_buyer", "ads_pause", f"Mettre en pause « {r.get('campaign_name')} »",
                                    f"Coût par clic {cpc:.2f} > plafond {config.CPC_MAX}. Dépense hier : {r.get('spend')}",
                                    {"campaign_id": r["campaign_id"], "campaign_name": r.get("campaign_name")})
                    asked.add(key)
            store.kv_set("mb_pause_asked", sorted(asked)[-500:])
        except Exception as e:
            parts.append(f"erreur Meta : {e}")
    else:
        parts.append("compte publicitaire Meta pas encore branché")
    if ctx["mode"] == "ordre" and ctx.get("order"):
        emit("media_buyer", "working", "Je prépare une proposition de campagne")
        fallback = {"nom": ctx["order"][:60], "budget_jour": min(50, config.BUDGET_MAX_JOUR), "duree_jours": 7,
                    "titre": config.AGENCE_NOM, "texte": ctx["order"], "kpi": "clics vers WhatsApp / site"}
        plan = llm.ask_json(MB_SYSTEM.format(ville="Meknès", budget=config.BUDGET_MAX_JOUR), ctx["order"], fallback)
        if not isinstance(plan, dict):
            plan = fallback
        plan["budget_jour"] = tools_meta.clamp_budget(plan.get("budget_jour"))
        plan["duree_jours"] = int(max(1, min(int(plan.get("duree_jours") or 7), 30)))
        total = plan["budget_jour"] * plan["duree_jours"]
        details = (f"Budget : {plan['budget_jour']}/jour × {plan['duree_jours']} jours = {total} au maximum\n"
                   f"Zone : {config.ZONE_RAYON_KM} km autour de Meknès, 18-65 ans\n"
                   f"Titre : {plan.get('titre')}\nTexte : {plan.get('texte')}\nObjectif : {plan.get('kpi')}\n\n"
                   "Si vous validez : la campagne est créée EN PAUSE. Rien n'est dépensé tant que vous ne l'activez pas.")
        if configured:
            actions.request("media_buyer", "ads_campaign", f"Campagne « {plan.get('nom')} » ({total} max)", details, {"plan": plan})
            parts.append("campagne proposée (à valider)")
        else:
            parts.append(f"proposition (non envoyée, Meta pas branché) : {plan.get('nom')} {plan['budget_jour']}/jour")
    summary = " | ".join(parts)
    emit("media_buyer", "done", summary)
    return _result("media_buyer", summary, kpis)


# ======================= 2. CRÉATIF =======================
def _pick_property(order, registry):
    words = [w for w in norm_text(order).split() if len(w) > 3]
    best, score = None, 0
    for r in registry:
        hay = norm_text(f"{r.get('propertyType')} {r.get('location')} {r.get('owner')} {r.get('notes')}")
        s = sum(w in hay for w in words)
        if s > score and (r.get("photos") or []):
            best, score = r, s
    return best


def creatif(ctx):
    if ctx["mode"] != "ordre" or not ctx.get("order"):
        return _result("creatif", "en attente d'un ordre (rien à produire aujourd'hui)")
    emit("creatif", "working", "Je prépare les textes et la vidéo")
    order = ctx["order"]
    captions = llm.ask_json(
        "Tu es le créatif d'une agence immobilière marocaine. Écris des légendes de publication. "
        "JSON strict : {\"fr\": \"...\", \"ar\": \"...\", \"hashtags\": \"...\"}", order,
        {"fr": f"{order} — {config.AGENCE_NOM}. Contactez-nous sur WhatsApp !",
         "ar": f"{order} — اتصلو بنا على الواتساب", "hashtags": "#ImmobilierMeknes #عقارات_مكناس #AlWassit777"})
    parts = [f"légendes prêtes (FR : {str(captions.get('fr', ''))[:80]}…)"] if isinstance(captions, dict) else []
    prop = _pick_property(order, [r for r in fs.get_repo().list(fs.REGISTRY) if not r.get("archived")])
    sources = [p.get("url") for p in (prop or {}).get("photos", []) if p.get("url")]
    local = config.DATA_DIR / "photos"
    if not sources and local.exists():
        sources = [str(local)]
    if sources and tools_media.ffmpeg_ok():
        try:
            video = tools_media.slideshow_from_sources(sources, order[:40])
            parts.append(f"vidéo verticale prête : {video}")
        except Exception as e:
            parts.append(f"vidéo impossible : {e}")
    elif not tools_media.ffmpeg_ok():
        parts.append("FFmpeg non installé : pas de vidéo")
    else:
        parts.append("aucune photo trouvée (mettez-les dans data/photos/ ou dans le registre du site)")
    summary = " | ".join(parts)
    store.kv_set("creatif_dernier", {"order": order, "captions": captions, "summary": summary})
    emit("creatif", "done", summary)
    return _result("creatif", summary)


# ======================= 7. R&D & QA =======================
def qa_check_replies(pending: list[dict]) -> dict:
    """Contrôle qualité simple des brouillons de réponses (sans IA)."""
    issues = []
    for a in pending:
        text = (a["payload"] or {}).get("text", "")
        if not text.strip():
            issues.append(f"#{a['id']} réponse vide")
        elif len(text) > 900:
            issues.append(f"#{a['id']} réponse trop longue")
        elif any(w in text.lower() for w in ["remise garantie", "prix final", "100% sûr"]):
            issues.append(f"#{a['id']} promesse risquée")
    score = round(10 * (1 - len(issues) / len(pending)), 1) if pending else None
    return {"note": score, "problemes": issues}


def rnd(ctx):
    emit("rnd", "working", "Contrôle qualité des brouillons")
    pending = [a for a in store.list_approvals("pending") if a["kind"].startswith("reply_")]
    qa = qa_check_replies(pending)
    parts = [f"qualité des réponses : {qa['note'] if qa['note'] is not None else '—'}/10"]
    if qa["problemes"]:
        parts.append("à revoir : " + ", ".join(qa["problemes"][:5]))
    if ctx["mode"] == "routine":
        try:
            import scout
            proposal = scout.run(top_n=3, emit=emit)
            for p in proposal["propositions"]:
                actions.request("rnd", "rnd_tool", f"Outil GitHub à étudier : {p['repo']} ({p['score']}/100)",
                                f"{p['description']}\n{p['url']}\nLicence : {p['licence']} — ★ {p['stars']}\n"
                                f"Utile pour : {', '.join(p['agents']) or '?'}\nAlertes : {', '.join(p['alertes']) or 'aucune'}\n"
                                f"Avis IA : {p.get('avis_ia') or '—'}\n\nValider = « à étudier ». Rien ne s'installe tout seul.",
                                {"repo": p["repo"], "url": p["url"]})
            parts.append(f"veille GitHub : {len(proposal['propositions'])} outil(s) proposé(s) sur {proposal['analyses']} analysés")
        except Exception as e:
            parts.append(f"veille GitHub en échec : {e}")
    summary = " | ".join(parts)
    emit("rnd", "done", summary)
    return _result("rnd", summary, {"note_qualite": qa["note"]})


AGENT_FUNCS = {"creatif": creatif, "community": community, "media_buyer": media_buyer,
               "db_manager": db_manager, "auditor": auditor, "rnd": rnd}

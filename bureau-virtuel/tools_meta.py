"""Outils Meta (API officielle Graph, gratuite) : commentaires, Messenger, Instagram, publicité.
RÈGLES DE SÉCURITÉ codées en dur :
- toute campagne et tout ensemble de publicités sont créés EN PAUSE (c'est vous qui activez) ;
- le budget par jour ne peut jamais dépasser BUDGET_MAX_JOUR.
"""
import datetime as dt
import json

import requests

import config


class MetaError(RuntimeError):
    pass


def _url(path: str) -> str:
    return f"https://graph.facebook.com/{config.META_API_VERSION}/{path.lstrip('/')}"


def graph(method: str, path: str, token: str, params: dict | None = None) -> dict:
    params = {**(params or {}), "access_token": token}
    if method == "GET":
        r = requests.get(_url(path), params=params, timeout=60)
    else:  # le jeton voyage dans le corps de la requête, pas dans l'adresse
        r = requests.post(_url(path), data=params, timeout=60)
    try:
        data = r.json()
    except ValueError:
        data = {}
    if r.status_code >= 400 or "error" in data:
        err = data.get("error", {})
        raise MetaError(f"{err.get('message', r.text[:200])} (code {err.get('code')})")
    return data


def _page_token() -> str:
    if not config.META_PAGE_TOKEN:
        raise MetaError("META_PAGE_TOKEN manquant")
    return config.META_PAGE_TOKEN


# ---------- Lecture des messages ----------
def facebook_comments(posts: int = 5) -> list[dict]:
    tok = _page_token()
    out = []
    for post in graph("GET", f"{config.META_PAGE_ID}/posts", tok, {"fields": "id,message", "limit": posts}).get("data", []):
        comments = graph("GET", f"{post['id']}/comments", tok, {
            "fields": "id,message,from,created_time", "filter": "stream",
            "order": "reverse_chronological", "limit": 25}).get("data", [])
        for c in comments:
            if (c.get("from") or {}).get("id") == config.META_PAGE_ID:
                continue  # nos propres réponses
            out.append({"channel": "fb_comment", "id": c["id"], "text": c.get("message", ""),
                        "author": (c.get("from") or {}).get("name", "?"), "context": (post.get("message") or "")[:150]})
    return out


def messenger_messages(limit: int = 15) -> list[dict]:
    tok = _page_token()
    convs = graph("GET", f"{config.META_PAGE_ID}/conversations", tok, {
        "platform": "messenger", "limit": limit,
        "fields": "id,updated_time,messages.limit(1){id,message,from,created_time}"}).get("data", [])
    out = []
    for conv in convs:
        msgs = (conv.get("messages") or {}).get("data", [])
        if not msgs:
            continue
        m = msgs[0]
        sender = m.get("from") or {}
        if sender.get("id") == config.META_PAGE_ID:
            continue  # le dernier message vient de nous : déjà répondu
        out.append({"channel": "messenger", "id": m["id"], "recipient": sender.get("id"),
                    "text": m.get("message", ""), "author": sender.get("name", "?"), "context": ""})
    return out


def instagram_comments(posts: int = 5) -> list[dict]:
    tok = _page_token()
    out = []
    media = graph("GET", f"{config.META_IG_USER_ID}/media", tok, {"fields": "id,caption", "limit": posts}).get("data", [])
    for m in media:
        for c in graph("GET", f"{m['id']}/comments", tok, {"fields": "id,text,username,timestamp", "limit": 25}).get("data", []):
            out.append({"channel": "ig_comment", "id": c["id"], "text": c.get("text", ""),
                        "author": c.get("username", "?"), "context": (m.get("caption") or "")[:150]})
    return out


# ---------- Réponses (seulement après votre validation) ----------
def reply_facebook_comment(comment_id: str, text: str) -> str:
    return graph("POST", f"{comment_id}/comments", _page_token(), {"message": text}).get("id", "")


def reply_instagram_comment(comment_id: str, text: str) -> str:
    return graph("POST", f"{comment_id}/replies", _page_token(), {"message": text}).get("id", "")


def send_messenger(recipient_id: str, text: str) -> str:
    # messaging_type RESPONSE : autorisé dans les 24 h qui suivent le message du client
    data = graph("POST", f"{config.META_PAGE_ID}/messages", _page_token(), {
        "recipient": json.dumps({"id": recipient_id}), "messaging_type": "RESPONSE",
        "message": json.dumps({"text": text})})
    return data.get("message_id", "")


# ---------- Publicité ----------
def clamp_budget(budget: float) -> int:
    """Le budget proposé par l'IA ne dépasse jamais le plafond, et jamais moins de 1."""
    try:
        b = float(budget)
    except (TypeError, ValueError):
        b = config.BUDGET_MAX_JOUR
    return int(max(1, min(b, config.BUDGET_MAX_JOUR)))


def _ads_token() -> str:
    if not (config.META_AD_ACCOUNT_ID and config.META_ADS_TOKEN):
        raise MetaError("META_AD_ACCOUNT_ID ou META_ADS_TOKEN manquant")
    return config.META_ADS_TOKEN


def create_paused_campaign(plan: dict) -> dict:
    """Crée la campagne + l'ensemble de publicités, TOUT EN PAUSE.
    Il reste à ajouter le visuel et à activer dans le Gestionnaire de publicités."""
    tok = _ads_token()
    acct = config.META_AD_ACCOUNT_ID
    budget = clamp_budget(plan.get("budget_jour"))
    days = int(max(1, min(int(plan.get("duree_jours") or 7), 30)))
    special = [config.META_SPECIAL_CATEGORY] if config.META_SPECIAL_CATEGORY else []
    camp = graph("POST", f"{acct}/campaigns", tok, {
        "name": plan.get("nom", "Campagne Bureau Virtuel")[:120],
        "objective": "OUTCOME_TRAFFIC",
        "status": "PAUSED",
        "special_ad_categories": json.dumps(special),
        **({"special_ad_category_country": json.dumps(["MA"])} if special else {}),
        "is_adset_budget_sharing_enabled": "false",
    })
    start = dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=1)
    targeting = {
        "geo_locations": {"custom_locations": [{
            "latitude": config.ZONE_LAT, "longitude": config.ZONE_LNG,
            "radius": max(config.ZONE_RAYON_KM, 25 if special else 1), "distance_unit": "kilometer"}]},
        "age_min": 18, "age_max": 65,  # obligatoire avec la catégorie « Logement »
    }
    adset = graph("POST", f"{acct}/adsets", tok, {
        "name": f"{plan.get('nom', 'Campagne')[:100]} - ensemble",
        "campaign_id": camp["id"],
        "daily_budget": str(budget * 100),          # Meta compte en centimes
        "billing_event": "IMPRESSIONS",
        "optimization_goal": "LINK_CLICKS",
        "bid_strategy": "LOWEST_COST_WITHOUT_CAP",
        "targeting": json.dumps(targeting),
        "start_time": start.isoformat(),
        "end_time": (start + dt.timedelta(days=days)).isoformat(),
        "status": "PAUSED",
    })
    return {"campaign_id": camp["id"], "adset_id": adset["id"], "budget_jour": budget, "jours": days}


def campaign_insights(date_preset: str = "yesterday") -> list[dict]:
    tok = _ads_token()
    return graph("GET", f"{config.META_AD_ACCOUNT_ID}/insights", tok, {
        "level": "campaign", "date_preset": date_preset,
        "fields": "campaign_id,campaign_name,spend,impressions,clicks,cpc"}).get("data", [])


def pause_campaign(campaign_id: str) -> bool:
    return bool(graph("POST", campaign_id, _ads_token(), {"status": "PAUSED"}).get("success", True))

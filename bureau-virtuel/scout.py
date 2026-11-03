"""Agent 7 — R&D Scout : cherche chaque jour sur GitHub des outils open-source
utiles aux autres agents, les note, et prépare une proposition pour le Directeur.
RÈGLE DE SÉCURITÉ : ce script ne télécharge ni n'installe JAMAIS de code.
Il propose seulement ; c'est vous qui validez.
Usage : python scout.py            (GITHUB_TOKEN facultatif mais conseillé, gratuit)
"""
import json, math, sys, time, datetime as dt
import requests

import config
import llm

API = "https://api.github.com"
TOKEN = config.GITHUB_TOKEN  # token gratuit "fine-grained", lecture publique seulement
HEADERS = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28",
           "User-Agent": "virtual-office-scout"}
if TOKEN:
    HEADERS["Authorization"] = f"Bearer {TOKEN}"

SEEN_FILE = config.DATA_DIR / "scout_vus.json"
OUT_DIR = config.DATA_DIR / "propositions"
OK_LICENSES = {"mit", "apache-2.0", "bsd-2-clause", "bsd-3-clause", "isc", "mpl-2.0"}

# Mots-clés -> agent qui en profiterait
AGENT_KEYWORDS = {
    "creatif": ["ffmpeg", "video", "image generation", "stable diffusion", "comfyui", "flux", "thumbnail", "subtitle"],
    "community": ["instagram", "facebook", "whatsapp", "comments", "dm", "inbox", "chatbot", "social media"],
    "media_buyer": ["meta ads", "facebook ads", "tiktok ads", "ad campaign", "marketing api", "roas"],
    "db_manager": ["firestore", "firebase", "sql", "postgres", "sqlite", "text-to-sql", "database"],
    "auditor": ["data quality", "validation", "backup", "deduplication", "schema", "great expectations"],
    "ceo": ["orchestration", "multi-agent", "memory", "langgraph", "planner", "workflow"],
    "rnd": ["evaluation", "eval", "benchmark", "observability", "tracing", "mcp"],
}

def queries():
    since_created = (dt.date.today() - dt.timedelta(days=30)).isoformat()
    since_pushed = (dt.date.today() - dt.timedelta(days=7)).isoformat()
    base = f"stars:>50 pushed:>{since_pushed} archived:false"
    return [
        f"topic:ai-agents created:>{since_created} {base}",
        f"topic:multi-agent {base}",
        f"topic:mcp-server created:>{since_created} {base}",
        f"topic:langgraph {base}",
        f"automation llm social-media in:name,description,readme {base}",
        f"ffmpeg ai video in:name,description {base}",
    ]

def gh_get(url, **params):
    for attempt in range(4):
        r = requests.get(url, headers=HEADERS, params=params, timeout=30)
        if r.status_code in (403, 429) and "rate limit" in r.text.lower():
            reset = int(r.headers.get("X-RateLimit-Reset", time.time() + 60))
            time.sleep(max(5, min(reset - time.time(), 90)))
            continue
        r.raise_for_status()
        return r
    raise RuntimeError(f"GitHub rate limit persistant : {url}")

def search(q, per_page=20):
    r = gh_get(f"{API}/search/repositories", q=q, sort="stars", order="desc", per_page=per_page)
    return r.json().get("items", [])

def readme(full_name, max_chars=4000):
    try:
        r = requests.get(f"{API}/repos/{full_name}/readme",
                         headers={**HEADERS, "Accept": "application/vnd.github.raw"}, timeout=30)
        return r.text[:max_chars] if r.ok else ""
    except requests.RequestException:
        return ""

def score(repo):
    """Note sur 100 + drapeaux de risque. Pas de magie : des règles lisibles."""
    now = dt.datetime.now(dt.timezone.utc)
    created = dt.datetime.fromisoformat(repo["created_at"].replace("Z", "+00:00"))
    pushed = dt.datetime.fromisoformat(repo["pushed_at"].replace("Z", "+00:00"))
    age_days = max((now - created).days, 1)
    stars = repo["stargazers_count"]
    velocity = stars / age_days                      # étoiles par jour
    lic = ((repo.get("license") or {}).get("spdx_id") or "").lower()
    text = f'{repo["full_name"]} {repo.get("description") or ""} {" ".join(repo.get("topics", []))}'.lower()

    s = min(12 * math.log10(1 + velocity), 35)      # popularité récente, échelle log (35 pts max)
    s += 20 if (now - pushed).days <= 3 else 10 if (now - pushed).days <= 14 else 0  # activité
    s += 15 if lic in OK_LICENSES else 0             # licence utilisable commercialement
    s += min(repo.get("forks_count", 0) / 50, 10)    # adoption réelle
    matched = {a: [k for k in kws if k in text] for a, kws in AGENT_KEYWORDS.items()}
    matched = {a: k for a, k in matched.items() if k}
    s += min(len(matched) * 10, 20)                  # utilité pour NOS agents

    flags = []
    if lic not in OK_LICENSES: flags.append(f"licence '{lic or 'aucune'}' : à vérifier")
    if age_days < 14 and stars > 3000: flags.append("croissance d'étoiles suspecte (achat d'étoiles ?)")
    if repo.get("open_issues_count", 0) > 500: flags.append("beaucoup d'issues ouvertes")
    if not matched: flags.append("aucun agent concerné clairement")
    return round(min(s, 100), 1), matched, flags, round(velocity, 1)

def llm_review(repo, readme_text):
    """Avis court de l'IA (gratuite). Sans IA configurée : on saute cette étape."""
    if not llm.available() or not readme_text:
        return None
    prompt = (f"Dépôt GitHub : {repo['full_name']}\nDescription : {repo.get('description')}\n"
              f"README (extrait) :\n{readme_text}\n\n"
              "Réponds en JSON strict : {\"utile_pour\": [liste parmi creatif, community, media_buyer, "
              "db_manager, auditor, ceo, rnd], \"gain\": \"1 phrase\", \"effort\": \"faible|moyen|eleve\", "
              "\"risque\": \"1 phrase\"}")
    return llm.ask_json("Tu évalues des outils open-source pour une petite agence immobilière.", prompt, None)

def run(top_n=5, emit=lambda *a, **k: None):
    seen = set(json.loads(SEEN_FILE.read_text())) if SEEN_FILE.exists() else set()
    candidates = {}
    for i, q in enumerate(queries()):
        emit("rnd", "working", f"Recherche GitHub {i + 1}/{len(queries())}")
        for repo in search(q):
            if repo["full_name"] not in seen and not repo.get("fork"):
                candidates[repo["full_name"]] = repo
        if not TOKEN:
            time.sleep(7)  # sans token : 10 recherches/minute max
    ranked = []
    for repo in candidates.values():
        s, matched, flags, vel = score(repo)
        ranked.append({"repo": repo["full_name"], "url": repo["html_url"], "score": s,
                       "stars": repo["stargazers_count"], "stars_par_jour": vel,
                       "licence": (repo.get("license") or {}).get("spdx_id"),
                       "description": repo.get("description"), "agents": matched, "alertes": flags})
    ranked.sort(key=lambda x: x["score"], reverse=True)
    top = ranked[:top_n]
    for item in top:
        emit("rnd", "working", f"Lecture du README de {item['repo']}")
        item["avis_ia"] = llm_review({"full_name": item["repo"], "description": item["description"]},
                                     readme(item["repo"]))
    seen.update(x["repo"] for x in top)
    SEEN_FILE.parent.mkdir(parents=True, exist_ok=True)
    SEEN_FILE.write_text(json.dumps(sorted(seen)))
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUT_DIR / f"{dt.date.today().isoformat()}.json"
    proposal = {"date": dt.date.today().isoformat(), "analyses": len(candidates), "propositions": top,
                "statut": "EN_ATTENTE_VALIDATION_DIRECTEUR"}
    out.write_text(json.dumps(proposal, ensure_ascii=False, indent=2))
    emit("rnd", "done", f"{len(top)} propositions envoyées au Directeur")
    return proposal

if __name__ == "__main__":
    p = run(top_n=int(sys.argv[1]) if len(sys.argv) > 1 else 5)
    print(f"{p['analyses']} dépôts analysés. Top :")
    for x in p["propositions"]:
        print(f"  {x['score']:>5}  {x['repo']:<45} ★{x['stars']:<6} agents={list(x['agents'])} alertes={x['alertes']}")

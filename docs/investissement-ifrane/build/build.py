# -*- coding: utf-8 -*-
"""Génère les 9 dossiers d'investissement (3 projets × 3 langues) en HTML, puis en PDF via render.cjs."""
import base64
import importlib
import json
import math
import os
import subprocess
import sys

import model as M
import svg as G

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_HTML = os.path.join(HERE, "html")
OUT_PDF = os.path.join(os.path.dirname(HERE), "pdf")
FILE_NAMES = {"A": "A-ARZ-Eco-Resort", "B": "B-Ifrane-Highlands", "C": "C-SAFA-Longevity-Retreat"}

# ---------------------------------------------------------------- modèles calculés une fois
MODELS = {"A": M.hotel_model(M.A), "B": M.promo_model(M.B), "C": M.hotel_model(M.C)}
SENS = {"A": M.sensitivities_hotel(M.A), "B": M.sensitivities_promo(M.B), "C": M.sensitivities_hotel(M.C)}
LEV = {"A": M.levered_irr_hotel(M.A), "C": M.levered_irr_hotel(M.C)}
PARAMS = {"A": M.A, "B": M.B, "C": M.C}


def img64(name):
    with open(os.path.join(HERE, "img", name), "rb") as f:
        return "data:image/jpeg;base64," + base64.b64encode(f.read()).decode()


# ---------------------------------------------------------------- formats par langue
def fnum(v, lang, d=1):
    s = f"{v:,.{d}f}"
    if lang == "fr":
        return s.replace(",", " ").replace(".", ",")
    return s


def money(v, lang, d=1):
    return {"fr": f"{fnum(v, lang, d)} M MAD", "en": f"MAD {fnum(v, lang, d)}m", "ar": f"{fnum(v, lang, d)} مليون درهم"}[lang]


def eur(v, lang):
    e = v / M.EUR_MAD
    return {"fr": f"{fnum(e, lang)} M€", "en": f"€{fnum(e, lang)}m", "ar": f"{fnum(e, lang)} مليون يورو"}[lang]


def pct(x, lang, d=1):
    return {"fr": f"{fnum(x * 100, lang, d)} %", "en": f"{fnum(x * 100, lang, d)}%", "ar": f"{fnum(x * 100, lang, d)}%"}[lang]


def mad(v, lang):
    return {"fr": f"{fnum(v, lang, 0)} MAD", "en": f"MAD {fnum(v, lang, 0)}", "ar": f"{fnum(v, lang, 0)} درهم"}[lang]


def eur_unit(v, lang):
    e = v / M.EUR_MAD
    return {"fr": f"{fnum(e, lang, 0)} €", "en": f"€{fnum(e, lang, 0)}", "ar": f"{fnum(e, lang, 0)} يورو"}[lang]


def years(v, lang):
    return {"fr": f"≈ {fnum(v, lang)} ans", "en": f"≈ {fnum(v, lang)} years", "ar": f"≈ {fnum(v, lang)} سنة"}[lang]


def fields(code, lang):
    m = MODELS[code]
    F = {}
    if code in ("A", "C"):
        p = PARAMS[code]
        st = m["stab"]
        dur = m["payback_dur"] + 1                       # années depuis le 1er janvier 2027
        F.update(keys=p["keys"], capex=money(m["capex_total"], lang), capex_eur=eur(m["capex_total"], lang),
                 resi_sales=money(m["resi_sales"], lang), resi_margin=money(m["resi_margin"], lang),
                 stab_year=st["year"], stab_ebitda=money(st["ebitda"], lang), ebitda_margin=pct(st["ebitda"] / st["total_rev"], lang, 0),
                 stab_rev=money(st["total_rev"], lang), irr=pct(m["irr"], lang), irr_sub=pct(SENS[code]["subsidy15"], lang),
                 irr_lev=pct(LEV[code][0], lang), payback_ops=fnum(dur - 3, lang), payback_total=years(dur, lang),
                 exit=money(m["exit_value"], lang), yoc=pct(m["yield_on_cost"], lang), net_need=money(m["net_equity_need"], lang),
                 adr0=mad(p["adr0"], lang), adr0_eur=eur_unit(p["adr0"], lang), irr_adr_p10=pct(SENS[code]["adr_p10"], lang))
    else:
        dur = m["payback_dur"] + 1
        sales_by = {k: n * s * pr / 1e6 for k, n, s, pr, _ in PARAMS["B"]["units"]}
        F.update(units=sum(n for _, n, _, _, _ in PARAMS["B"]["units"]), sales=money(m["sales"], lang), sales_eur=eur(m["sales"], lang),
                 built=fnum(m["built"], lang, 0), cost=money(m["total_cost"], lang), margin=money(m["margin"], lang),
                 margin_pct=pct(m["margin_on_sales"], lang), irr=pct(m["irr"], lang), peak=money(m["peak_funding"], lang),
                 payback_year=str(int(2027 + dur)), payback_total=years(dur, lang),
                 margin_price_m10=pct(SENS["B"]["price_m10_margin"], lang),
                 share_signature=pct(sales_by["signature"] / m["sales"], lang, 0), share_forest=pct(sales_by["forest"] / m["sales"], lang, 0),
                 share_lodge=pct(sales_by["lodge"] / m["sales"], lang, 0))
    return F


def compare_fields(lang):
    F = {}
    for c in ("A", "C"):
        m = MODELS[c]
        F[f"{c}_capex"] = money(m["capex_total"], lang)
        F[f"{c}_irr"] = pct(m["irr"], lang)
        F[f"{c}_payback"] = years(m["payback_dur"] + 1, lang)
    b = MODELS["B"]
    F["B_cost"] = money(b["total_cost"], lang)
    F["B_irr"] = pct(b["irr"], lang)
    F["B_payback"] = years(b["payback_dur"] + 1, lang)
    return F


def fmt(text, F):
    return text.format(**F) if "{" in text else text


# ---------------------------------------------------------------- CSS
def css(lang):
    rtl = lang == "ar"
    body_font = "'Cairo', 'Noto Naskh Arabic', sans-serif" if rtl else "'Inter', sans-serif"
    head_font = "'Cairo', sans-serif" if rtl else "'Playfair Display', serif"
    return f"""
@page {{ size: A4; margin: 17mm 15mm 18mm 15mm; }}
@page :first {{ margin: 0; }}
:root {{ --cedar:#1f3b2d; --cedar2:#2f5a43; --copper:#b5653b; --gold:#c8a45c; --cream:#f6f1e7; --ink:#22262a; --muted:#6b6f72; --line:#e2dccd; }}
* {{ box-sizing: border-box; }}
html {{ -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
body {{ margin:0; font-family:{body_font}; color:var(--ink); font-size:{'10.2pt' if rtl else '9.6pt'}; line-height:{1.68 if rtl else 1.55}; background:#fff; }}
h1,h2,h3,h4 {{ font-family:{head_font}; color:var(--cedar); margin:0; line-height:1.25; }}
h2 {{ font-size:{'19pt' if rtl else '20pt'}; font-weight:{800 if rtl else 700}; margin-bottom:4mm; display:flex; align-items:baseline; gap:3mm; }}
h2 .no {{ font-family:'Inter',sans-serif; font-size:11pt; color:var(--copper); font-weight:800; letter-spacing:.5px; }}
h3 {{ font-size:12pt; font-weight:700; margin:5mm 0 2mm; color:var(--cedar2); break-after:avoid; }}
p {{ margin:0 0 2.6mm; text-align:{'right' if rtl else 'justify'}; }}
b, strong {{ font-weight:700; color:#111; }}
section.sec {{ break-before:page; }}
section.sec.cont {{ break-before:auto; margin-top:6mm; }}
.rule {{ height:3px; width:28mm; background:var(--copper); margin:0 0 5mm; }}
ul {{ margin:0 0 3mm; padding-{'right' if rtl else 'left'}:5mm; }}
li {{ margin-bottom:1.4mm; }}
table {{ width:100%; border-collapse:collapse; margin:2mm 0 4mm; font-size:{'8.9pt' if rtl else '8.4pt'}; break-inside:auto; }}
th {{ background:var(--cedar); color:#fff; font-weight:600; padding:2mm 2.2mm; text-align:{'right' if rtl else 'left'}; }}
td {{ padding:1.7mm 2.2mm; border-bottom:0.6px solid var(--line); vertical-align:top; }}
tr {{ break-inside:avoid; }}
tbody tr:nth-child(even) td {{ background:#faf7f0; }}
td.num, th.num {{ text-align:{'left' if rtl else 'right'}; white-space:nowrap; font-variant-numeric:tabular-nums; }}
tr.total td {{ font-weight:700; background:#efe7d6 !important; border-top:1.2px solid var(--cedar); }}
.pill {{ display:inline-block; padding:0.3mm 2mm; border-radius:6px; font-size:7.4pt; font-weight:700; white-space:nowrap; }}
.pill.V {{ background:#dcebdc; color:#24603a; }} .pill.E {{ background:#f6e6c9; color:#8a5a12; }} .pill.A {{ background:#f6d6cc; color:#9a3a1c; }}
.pill.H {{ background:#f6d6cc; color:#9a3a1c; }} .pill.M {{ background:#f6e6c9; color:#8a5a12; }} .pill.L {{ background:#dcebdc; color:#24603a; }}
.kpis {{ display:grid; grid-template-columns:repeat(3,1fr); gap:3mm; margin:4mm 0; }}
.kpi {{ background:var(--cream); border-{'right' if rtl else 'left'}:3px solid var(--copper); padding:3mm 3.5mm; break-inside:avoid; }}
.kpi .v {{ font-family:'Inter',sans-serif; font-size:14.5pt; font-weight:800; color:var(--cedar); unicode-bidi:isolate; display:inline-block; }}
.kpi.ar .v {{ font-family:'Cairo',sans-serif; }}
.kpi .l {{ font-size:8pt; color:var(--muted); text-transform:{'none' if rtl else 'uppercase'}; letter-spacing:{0 if rtl else '.4px'}; }}
.kpi .s {{ font-size:7.8pt; color:var(--muted); }}
.box {{ background:var(--cream); padding:4mm 5mm; border-radius:2mm; margin:3mm 0 4mm; break-inside:avoid; }}
.alert {{ background:#fbeee8; border:1px solid #e8b7a3; border-{'right' if rtl else 'left'}:4px solid #b2452a; padding:4mm 5mm; margin:3mm 0 4mm; break-inside:avoid; }}
.alert h4 {{ color:#9a3a1c; font-size:11pt; margin-bottom:1.5mm; }}
.grid2 {{ display:grid; grid-template-columns:1fr 1fr; gap:4mm; }}
.card {{ border:0.8px solid var(--line); border-top:3px solid var(--cedar2); padding:3mm 3.5mm; break-inside:avoid; background:#fff; }}
.card h4 {{ font-size:10.5pt; margin-bottom:1.2mm; }}
.card p {{ margin:0; font-size:{'9pt' if rtl else '8.8pt'}; text-align:{'right' if rtl else 'left'}; }}
figure {{ margin:2mm 0 4mm; break-inside:avoid; }}
figure img, figure svg {{ width:100%; display:block; border-radius:1.5mm; }}
figcaption {{ font-size:7.9pt; color:var(--muted); margin-top:1.5mm; line-height:1.45; }}
.photos {{ display:grid; grid-template-columns:1fr 1fr; gap:4mm; }}
.photos img {{ height:118mm; object-fit:cover; }}
.legend {{ display:flex; flex-wrap:wrap; gap:1.5mm 5mm; font-size:8pt; margin:1mm 0 3mm; }}
.legend span.sw {{ display:inline-block; width:3mm; height:3mm; border-radius:0.6mm; vertical-align:middle; margin-{'left' if rtl else 'right'}:1.5mm; }}
.plan-legend {{ columns:2; font-size:8.3pt; margin:0 0 3mm; padding:0; list-style:none; }}
.plan-legend li {{ break-inside:avoid; margin-bottom:1mm; }}
.plan-legend .n {{ display:inline-block; width:4.6mm; height:4.6mm; line-height:4.6mm; border-radius:50%; background:var(--copper); color:#fff; font-size:7pt; font-weight:700; text-align:center; margin-{'left' if rtl else 'right'}:1.5mm; font-family:'Inter',sans-serif; }}
.sw {{ display:inline-block; width:3mm; height:3mm; border-radius:0.6mm; margin-{'left' if rtl else 'right'}:1.2mm; vertical-align:middle; }}
.bar {{ height:3.2mm; background:var(--cedar2); border-radius:1mm; }}
.bar.neg {{ background:#c0533a; }} .bar.pos {{ background:#4f8a5f; }}
.stack {{ display:flex; height:6mm; border-radius:1.5mm; overflow:hidden; margin:2mm 0 1mm; direction:ltr; }}
.small {{ font-size:7.9pt; color:var(--muted); }}
.toc {{ columns:2; list-style:none; padding:0; margin:2mm 0 5mm; font-size:9.6pt; }}
.toc li {{ margin-bottom:1.6mm; }} .toc .n {{ color:var(--copper); font-weight:800; font-family:'Inter',sans-serif; display:inline-block; width:8mm; }}
.timeline {{ margin:3mm 0; }}
.tl-row {{ display:grid; grid-template-columns:{'30mm 1fr' if not rtl else '30mm 1fr'}; gap:3mm; padding:1.1mm 0; border-bottom:0.6px solid var(--line); break-inside:avoid; }}
.tl-row .t {{ color:var(--copper); font-weight:700; font-size:8.6pt; direction:ltr; unicode-bidi:isolate; }}
.contact {{ display:flex; gap:5mm; align-items:center; background:var(--cedar); color:#fff; padding:5mm; border-radius:2mm; margin-top:5mm; break-inside:avoid; }}
.contact b {{ color:#fff; }} .contact .small {{ color:#d7e3da; }}
.sources {{ font-size:7.8pt; padding-{'right' if rtl else 'left'}:4.5mm; }}
.sources li {{ margin-bottom:1.2mm; word-break:break-all; }}
.sources a {{ color:var(--cedar2); }}
.ltr {{ direction:ltr; unicode-bidi:isolate; }}
/* couverture */
.cover {{ position:relative; width:210mm; height:297mm; overflow:hidden; background:var(--cedar); color:#fff; break-after:page; }}
.cover .hero {{ position:absolute; inset:0 0 auto 0; height:190mm; }}
.cover .shade {{ position:absolute; left:0; right:0; top:120mm; height:72mm; background:linear-gradient(180deg, rgba(31,59,45,0) 0%, rgba(31,59,45,1) 100%); }}
.cover .top {{ position:absolute; top:12mm; {'right' if rtl else 'left'}:14mm; {'left' if rtl else 'right'}:14mm; display:flex; justify-content:space-between; align-items:center; font-size:8.5pt; letter-spacing:{0 if rtl else '1.5px'}; text-transform:{'none' if rtl else 'uppercase'}; color:#fff; text-shadow:0 1px 3px rgba(0,0,0,.35); }}
.cover .top .brand {{ display:flex; align-items:center; gap:3mm; font-weight:700; }}
.cover .body {{ position:absolute; top:168mm; {'right' if rtl else 'left'}:16mm; {'left' if rtl else 'right'}:16mm; }}
.cover .kicker {{ color:var(--gold); font-size:9pt; letter-spacing:{0 if rtl else '2px'}; text-transform:{'none' if rtl else 'uppercase'}; font-weight:700; }}
.cover h1 {{ color:#fff; font-size:{'34pt' if rtl else '40pt'}; font-weight:800; margin:2mm 0 1mm; letter-spacing:{0 if rtl else '1px'}; }}
.cover .sub {{ font-family:{head_font}; font-size:14pt; color:#f0e6d2; margin-bottom:4mm; }}
.cover .tag {{ font-size:10.5pt; color:#dfe8e1; max-width:160mm; line-height:1.55; }}
.cover .meta {{ position:absolute; bottom:14mm; {'right' if rtl else 'left'}:16mm; {'left' if rtl else 'right'}:16mm; display:flex; justify-content:space-between; font-size:8.3pt; color:#cfdcd2; border-top:0.6px solid rgba(255,255,255,.3); padding-top:3mm; }}
.cover .badge {{ display:inline-block; border:1px solid var(--gold); color:var(--gold); padding:1mm 3mm; border-radius:1mm; font-size:8pt; margin-top:5mm; }}
"""


# ---------------------------------------------------------------- briques HTML
def pill(code, UI):
    return f'<span class="pill {code}">{UI["status"][code]}</span>'


def lvl(code, UI):
    return f'<span class="pill {code}">{UI["levels"][code]}</span>'


def h2(n, title):
    return f'<h2><span class="no">{n:02d}</span>{title}</h2><div class="rule"></div>'


import re
_NUM = re.compile(r"^[\-−+≈]?\s?[\d][\d.,\s\u00a0]*%?$")


def _cell(c):
    return f'<bdi dir="ltr">{c}</bdi>' if isinstance(c, str) and _NUM.match(c.strip()) else c


def table(head, rows, num_cols=(), cls=""):
    th = "".join(f'<th class="{"num" if i in num_cols else ""}">{h}</th>' for i, h in enumerate(head))
    body = []
    for r in rows:
        tr_cls = ""
        if isinstance(r, dict):
            tr_cls, r = r.get("cls", ""), r["cells"]
        body.append(f'<tr class="{tr_cls}">' + "".join(f'<td class="{"num" if i in num_cols else ""}">{_cell(c)}</td>' for i, c in enumerate(r)) + "</tr>")
    return f'<table class="{cls}"><thead><tr>{th}</tr></thead><tbody>{"".join(body)}</tbody></table>'


def kpi(label, value, sub="", lang="fr"):
    return f'<div class="kpi {"ar" if lang == "ar" else ""}"><div class="l">{label}</div><div class="v">{value}</div><div class="s">{sub}</div></div>'


CAPEX_LABELS = {
    "fr": {"land": "Terrain (valeur d'apport, 500 MAD/m²)", "construction": "Construction (bâtiments)", "infra": "Voiries, réseaux, paysage, énergie",
           "ffe": "Mobilier et équipements", "medical": "Équipements médicaux et thermes", "soft": "Études, honoraires, autorisations",
           "preopen": "Pré-ouverture, recrutement et formation", "contingency": "Imprévus", "club": "Club-house",
           "marketing": "Commercialisation et commissions (6 %)", "finance": "Frais financiers"},
    "en": {"land": "Land (contribution value, MAD 500/m²)", "construction": "Construction (buildings)", "infra": "Roads, utilities, landscaping, energy",
           "ffe": "Furniture, fixtures & equipment", "medical": "Medical & thermal equipment", "soft": "Studies, fees, permits",
           "preopen": "Pre-opening, recruitment & training", "contingency": "Contingency", "club": "Clubhouse",
           "marketing": "Sales & marketing, commissions (6%)", "finance": "Financing costs"},
    "ar": {"land": "الأرض (قيمة المساهمة، 500 درهم/م²)", "construction": "البناء (المباني)", "infra": "الطرق والشبكات والمساحات الخضراء والطاقة",
           "ffe": "الأثاث والتجهيزات", "medical": "التجهيزات الطبية والحمامات العلاجية", "soft": "الدراسات والأتعاب والتراخيص",
           "preopen": "ما قبل الافتتاح والتوظيف والتكوين", "contingency": "احتياطي الطوارئ", "club": "النادي (كلوب هاوس)",
           "marketing": "التسويق والعمولات (6%)", "finance": "المصاريف المالية"},
}

def build_doc(code, C, lang):
    UI = C.UI
    P = C.PROJECTS[code]
    F = fields(code, lang)
    if code in ("A", "C"):
        p = PARAMS[code]
        sep = "," if lang == "fr" else "."
        F["occ_ramp"] = " → ".join(f"{int(o * 100)} %" if lang == "fr" else f"{int(o * 100)}%" for o in p["occ"])
        F["rooms_share"] = pct(p["rooms_share"], lang, 0)
        F["cap"] = pct(p["exit_cap"], lang)
        F["per_key"] = money(MODELS[code]["per_key"], lang, 2)
    F.update(compare_fields(lang))
    T = C.TXT
    m = MODELS[code]
    sec = UI["sections"]
    html = []
    # ---------- couverture
    html.append(f'''<div class="cover">
<div class="hero">{G.HEROES[code]()}</div><div class="shade"></div>
<div class="top"><div class="brand">{G.logo_svg(30)}<span>{"Al Wasset 777" if lang != "ar" else "مكتب الوسيط 777"}</span></div><div>{UI["date"]}</div></div>
<div class="body"><div class="kicker">{UI["doc_kind"]} · {UI["scenario"]} {code}</div>
<h1>{P["name"]}</h1><div class="sub">{P["type"]}</div><div class="tag">{P["tagline"]}<br>{UI["land"]}</div>
<div class="badge">{UI["confidential"]}</div></div>
<div class="meta"><div>{UI["prepared_by"]} : {C.AGENCY["name"]}</div><div class="ltr">{C.AGENCY["phone"]}</div></div>
</div>''')
    # ---------- sommaire + synthèse
    toc = "".join(f'<li><span class="n">{i + 1:02d}</span>{t}</li>' for i, t in enumerate(sec))
    if code == "B":
        kp = [kpi(UI["kpi"]["sales"], money(m["sales"], lang, 0), eur(m["sales"], lang), lang),
              kpi(UI["kpi"]["capex"], money(m["total_cost"], lang, 0), eur(m["total_cost"], lang), lang),
              kpi(UI["kpi"]["margin"], money(m["margin"], lang, 0), F["margin_pct"], lang),
              kpi(UI["kpi"]["irr"], F["irr"], "", lang),
              kpi(UI["kpi"]["peak"], money(m["peak_funding"], lang, 0), "", lang),
              kpi(UI["kpi"]["payback"], F["payback_total"], "", lang)]
    else:
        kp = [kpi(UI["kpi"]["capex"], money(m["capex_total"], lang, 0), eur(m["capex_total"], lang), lang),
              kpi(UI["kpi"]["keys"], f'{PARAMS[code]["keys"]} + {PARAMS[code]["resi"]["n"]}', C.TXT["keys_sub"], lang),
              kpi(UI["kpi"]["ebitda"], money(m["stab"]["ebitda"], lang, 1), str(m["stab"]["year"]), lang),
              kpi(UI["kpi"]["irr"], F["irr"], C.TXT["irr_sub_lbl"].format(**F), lang),
              kpi(C.TXT["exit_lbl"], money(m["exit_value"], lang, 0), "2039", lang),
              kpi(UI["kpi"]["payback"], F["payback_total"], C.TXT["payback_sub"].format(**F), lang)]
    pts = "".join(f"<li>{fmt(x, F)}</li>" for x in P["exec_points"])
    html.append(f'''<section>
<h3 style="margin-top:0">{UI["toc"]}</h3><ul class="toc">{toc}</ul>
{h2(1, sec[0])}<p>{fmt(P["exec"], F)}</p>
<div class="kpis">{"".join(kp)}</div><ul>{pts}</ul>
<div class="box"><b>{UI["legend_title"]}.</b> {UI["legend_text"]}<br><span class="small">{UI["fx_note"]}</span></div>
</section>''')
    # ---------- concept
    objs = "".join(f"<li>{fmt(x, F)}</li>" for x in P["objectives"])
    cards = "".join(f'<div class="card"><h4>{t}</h4><p>{fmt(d, F)}</p></div>' for t, d in P["distinctive"])
    html.append(f'''<section class="sec">{h2(2, sec[1])}
<figure style="margin:0 0 3mm">{G.HEROES[code](1200, 330)}</figure>
<h3>{C.TXT["vision"]}</h3><p>{P["vision"]}</p>
<h3>{C.TXT["objectives"]}</h3><ul>{objs}</ul>
<h3>{C.TXT["positioning"]}</h3><p>{P["positioning"]}</p>
<h3>{C.TXT["distinctive"]}</h3><div class="grid2">{cards}</div>
</section>''')
    # ---------- terrain
    S = C.SITE
    facts = table([UI["th"]["feature"], UI["th"]["info"], UI["th"]["status"]], [(a, b, pill(c, UI)) for a, b, c in S["facts"]])
    env = "".join(f"<li>{x}</li>" for x in S["environment"])
    html.append(f'''<section class="sec">{h2(3, sec[2])}
<p>{S["intro"]}</p>{facts}
<div class="alert"><h4>{S["alert_title"]}</h4><p style="margin:0">{S["alert"]}</p></div>
<div class="photos"><figure><img src="{img64('site-itineraire.jpg')}"><figcaption>{UI["photo_site1"]}</figcaption></figure>
<figure><img src="{img64('site-satellite.jpg')}"><figcaption>{UI["photo_site2"]}</figcaption></figure></div>
<h3>{C.TXT["environment"]}</h3><ul>{env}</ul>
<h3>{C.TXT["site_reading"]}</h3><p>{P["site_angle"]}</p>
</section>''')
    # ---------- programme
    prog = table([UI["th"]["component"], UI["th"]["qty"], UI["th"]["area"], UI["th"]["desc"]], [list(r) for r in P["program"]], num_cols=(1, 2))
    lu_total = sum(v for _, v in P["landuse"])
    lu_rows = [(f'<span class="sw" style="background:{G.ZONE_COLORS[i] if i < len(P["landuse"]) - 1 else G.ZONE_COLORS[8]}"></span>{i + 1}. {lab}', fnum(v, lang, 0), pct(v / lu_total, lang, 0))
               for i, (lab, v) in enumerate(P["landuse"])]
    lu_rows.append({"cls": "total", "cells": [UI["total"], fnum(lu_total, lang, 0), pct(1, lang, 0)]})
    lu = table([UI["th"]["zone"], UI["th"]["surface"], UI["th"]["pct"]], lu_rows, num_cols=(1, 2))
    infra = "".join(f"<li>{x}</li>" for x in C.INFRA_COMMON + P["infra_extra"])
    leis = "".join(f"<li>{x}</li>" for x in P["leisure"])
    html.append(f'''<section class="sec">{h2(4, sec[3])}
<p>{fmt(P["program_intro"], F)}</p>{prog}
<div class="grid2" style="font-size:8.4pt;line-height:1.45"><div><h3>{C.TXT["infra"]}</h3><ul>{infra}</ul></div><div><h3>{C.TXT["leisure"]}</h3><ul>{leis}</ul></div></div>
<div style="break-before:page"><h3 style="margin-top:0">{UI["masterplan_title"]}</h3>
<figure>{G.PLANS[code]()}<figcaption>{UI["masterplan_note"]}</figcaption></figure>
{lu}</div>
</section>''')
    # ---------- marché
    MK = C.MARKET
    macro = table([UI["th"]["info"], UI["th"]["value"], UI["th"]["status"]], [(a, b, pill(c, UI)) for a, b, c in MK["macro"]])
    comp = table([C.TXT["competitor"], UI["th"]["desc"], C.TXT["relevance"]], [list(r) for r in MK["competition"]])
    tg = table([UI["th"]["segment"], UI["th"]["desc"], UI["th"]["weight"]], [list(r) for r in P["targets"]], num_cols=(2,))
    opp = "".join(f"<li>{fmt(x, F)}</li>" for x in P["opportunities"])
    html.append(f'''<section class="sec">{h2(5, sec[4])}
<h3>{C.TXT["macro"]}</h3>{macro}
<h3>{C.TXT["targets"]}</h3>{tg}
<p>{fmt(P["market_specific"], F)}</p>
<div class="box">{MK["gulf"]}</div>
<h3>{C.TXT["competition"]}</h3>{comp}
<h3>{C.TXT["opportunities"]}</h3><ul>{opp}</ul>
</section>''')
    # ---------- modèle économique
    rev = table([UI["th"]["stream"], UI["th"]["desc"], UI["th"]["share"]], [[a, b, fmt(c, F)] for a, b, c in P["revenues"]], num_cols=(2,))
    lists = [(C.TXT["services"], P["services"]), (C.TXT["partners"], P["partners"]), (C.TXT["devs"], P["devs"])]
    blocks = "".join(f'<div class="card"><h4>{t}</h4><ul style="margin:1mm 0 0">{"".join(f"<li>{fmt(x, F)}</li>" for x in xs)}</ul></div>' for t, xs in lists)
    html.append(f'''<section class="sec">{h2(6, sec[5])}
<p>{C.TXT["bm_intro"][code]}</p>
<h3>{C.TXT["revenues"]}</h3>{rev}
<div class="grid2" style="grid-template-columns:1fr 1fr 1fr">{blocks}</div>
</section>''')
    # ---------- finances
    html.append(finance_section(code, C, lang, F))
    # ---------- atouts
    cards = "".join(f'<div class="card"><h4>{t}</h4><p>{fmt(d, F)}</p></div>' for t, d in P["investor"])
    html.append(f'''<section class="sec">{h2(8, sec[7])}<div class="grid2">{cards}</div>
<div class="box" style="margin-top:5mm">{C.TXT["land_value"]}</div></section>''')
    # ---------- illustrations
    sec_leg = "".join(f'<li><span class="n">{i + 1}</span>{x}</li>' for i, x in enumerate(C.TXT["section_legend"][code]))
    html.append(f'''<section class="sec">{h2(9, sec[8])}
<p>{C.TXT["illus_intro"]}</p>
<figure>{G.HEROES[code](1200, 520)}<figcaption>{P["illus"][0]}</figcaption></figure>
<div class="grid2"><figure>{G.SECTIONS[code]()}<figcaption>{P["illus"][1]}</figcaption><ul class="plan-legend" style="columns:1;margin-top:2mm">{sec_leg}</ul></figure>
<div><figure><img src="{img64('reference-architecture.jpg')}" style="height:44mm;object-fit:cover"><figcaption>{UI["photo_ref"]}</figcaption></figure>
<div class="box" style="font-size:8.2pt;margin-top:2mm"><b>{C.TXT["arch_title"]}</b><ul style="margin:1mm 0 0">{"".join(f"<li>{x}</li>" for x in C.TXT["arch_principles"])}</ul></div></div></div>
</section>''')
    # ---------- risques
    rk = table([UI["th"]["risk"], UI["th"]["level"], UI["th"]["mitigation"]], [(a, lvl(b, UI), c) for a, b, c in C.RISKS_COMMON + P["risks"]])
    html.append(f'<section class="sec">{h2(10, sec[9])}{rk}</section>')
    # ---------- conclusion
    cmp_head = [UI["th"]["criterion"]] + [C.COMPARE_NAMES[k] + (" ★" if k == code else "") for k in ("A", "B", "C")]
    cmp_rows = [[C.COMPARE_ROWS[i]] + [fmt(C.COMPARE[k][i], F) for k in ("A", "B", "C")] for i in range(len(C.COMPARE_ROWS))]
    tl = "".join(f'<div class="tl-row"><div class="t">{b}</div><div>{a}</div></div>' for a, b in C.TIMELINE)
    reco = "".join(f"<li>{x}</li>" for x in P["reco"])
    html.append(f'''<section class="sec">{h2(11, sec[10])}
<p>{fmt(P["conclusion"], F)}</p>
<h3>{C.TXT["reco"]}</h3><ol>{reco}</ol>
<h3>{UI["timeline_title"]}</h3><div class="timeline">{tl}</div>
<h3>{UI["compare_title"]}</h3>{table(cmp_head, cmp_rows)}
<p class="small">{C.TXT["compare_note"]}</p>
</section>''')
    # ---------- sources
    src = "".join(f'<li>{t} — <a href="{u}">{u}</a></li>' for t, u in C.SOURCES)
    html.append(f'''<section class="sec">{h2(12, sec[11])}
<h3>{UI["sources_title"]}</h3><ol class="sources">{src}</ol>
<h3>{C.TXT["disclaimer_title"]}</h3><p class="small" style="font-size:8.6pt">{UI["disclaimer"]}</p>
<div class="contact">{G.logo_svg(54)}<div><b style="font-size:12pt">{C.AGENCY["name"]}</b><br>{C.AGENCY["manager"]}<br>
<span class="small">{C.AGENCY["address"]}</span><br><span class="ltr">{C.AGENCY["phone"]}</span> · <span class="ltr">alwasset777@gmail.com</span> · <span class="ltr">al-wasset-777.vercel.app</span></div></div>
</section>''')
    title = f'{P["fullname"]} — {UI["doc_kind"]}'
    return f'''<!doctype html><html lang="{lang}" dir="{C.DIR}"><head><meta charset="utf-8"><title>{title}</title><style>{css(lang)}</style></head>
<body>{"".join(html)}</body></html>'''


def finance_section(code, C, lang, F):
    UI = C.UI
    T = C.TXT
    sec = UI["sections"]
    m = MODELS[code]
    out = [f'<section class="sec">{h2(7, sec[6])}']
    if code in ("A", "C"):
        P = C.PROJECTS[code]
        hyp = table([UI["th"]["hyp"], UI["th"]["value"], UI["th"]["status"]], [(a, fmt(b, F), pill(c, UI)) for a, b, c in T["hyp"]])
        p = PARAMS[code]
        rows = [(CAPEX_LABELS[lang][k], money(v if k != "land" else v, lang), pct(v / m["capex_total"], lang, 0)) for k, v in p["capex"]]
        rows.append({"cls": "total", "cells": [UI["total"], money(m["capex_total"], lang), pct(1, lang, 0)]})
        rows.append([T["resi_line"], money(m["resi_sales"], lang), ""])
        rows.append([T["resi_cost"], "− " + money(m["resi_cost"], lang), ""])
        rows.append({"cls": "total", "cells": [T["resi_margin"], money(m["resi_margin"], lang), ""]})
        capex = table([UI["th"]["item"], UI["th"]["amount"], UI["th"]["share"]], rows, num_cols=(1, 2))
        colors = ["#b5653b", "#2f5a43", "#c8a45c", "#7aa6a1", "#8d6e9e", "#d98f6a", "#9cb36b", "#9a9a9a"]
        stack = "".join(f'<div style="width:{v / m["capex_total"] * 100:.2f}%;background:{colors[i % len(colors)]}"></div>' for i, (k, v) in enumerate(p["capex"]))
        sleg = "".join(f'<span><span class="sw" style="background:{colors[i % len(colors)]}"></span>{CAPEX_LABELS[lang][k]}</span>' for i, (k, v) in enumerate(p["capex"]))
        yrs = [r["year"] for r in m["rows"]]
        pl_head = [UI["th"]["year"]] + [str(y) for y in yrs]
        pl = [
            [T["occ"]] + [f'{r["occ"] * 100:.0f}%' for r in m["rows"]],
            [T["adr"]] + [fnum(r["adr"], lang, 0) for r in m["rows"]],
            [T["rev"]] + [fnum(r["total_rev"], lang) for r in m["rows"]],
            [T["opex"]] + [fnum(-r["opex"], lang) for r in m["rows"]],
            [T["gop"]] + [fnum(r["gop"], lang) for r in m["rows"]],
            [T["fees"]] + [fnum(-r["fees"], lang) for r in m["rows"]],
            {"cls": "total", "cells": [T["ebitda"]] + [fnum(r["ebitda"], lang) for r in m["rows"]]},
        ]
        pl_t = table(pl_head, pl, num_cols=tuple(range(1, 11)), cls="pl")
        chart1 = G.bar_chart([str(y) for y in yrs], [[r["total_rev"] for r in m["rows"]], [r["ebitda"] for r in m["rows"]]], ["#c8a45c", "#2f5a43"])
        cum, acc = [], 0
        for f in m["flows"]:
            acc += f
            cum.append(acc)
        chart2 = G.bar_chart([str(y) for y in m["years"]], [m["flows"]], ["#7aa6a1"], line=cum, neg=True)
        opex = table([UI["th"]["item"], UI["th"]["share"]], [list(r) for r in P["opex"][:-1]] + [{"cls": "total", "cells": list(P["opex"][-1])}], num_cols=(1,))
        kr = table([UI["th"]["criterion"], UI["th"]["value"]], [(a.format(**F), fmt(b, F)) for a, b in T["kpi_rows"]], num_cols=(1,))
        base = SENS[code]["base"]
        sens_rows = []
        for k, lab in T["sens"]:
            v = SENS[code][k]
            d = v - base
            w = min(abs(d) * 100 / 3.0 * 100, 100)
            sens_rows.append([lab, pct(v, lang), f'<div style="display:flex;{"flex-direction:row-reverse;" if lang == "ar" else ""}"><div class="bar {"pos" if d >= 0 else "neg"}" style="width:{w:.0f}%"></div></div>'])
        sens = table([UI["th"]["variation"], UI["th"]["irr"], ""], [[UI["base"], pct(base, lang), ""]] + sens_rows, num_cols=(1,))
        out.append(f'''<p>{T["fin_intro"]}</p>
<h3>{UI["hyp_title"]}</h3>{hyp}
<h3>{UI["capex_title"]}</h3>{capex}
<div style="break-inside:avoid"><div class="stack">{stack}</div><div class="legend">{sleg}</div></div>
<h3>{UI["pl_title"]} ({T["mmad"]})</h3>{pl_t}
<div style="break-inside:avoid"><h3>{UI["chart_rev_title"]}</h3><figure>{chart1}</figure><div class="legend"><span><span class="sw" style="background:#c8a45c"></span>{UI["legend_rev"]}</span><span><span class="sw" style="background:#2f5a43"></span>{UI["legend_ebitda"]}</span></div></div>
<div class="grid2" style="break-inside:avoid"><div><h3>{UI["opex_title"]}</h3>{opex}<p class="small">{P["fees_note"]}</p></div><div><h3>{UI["sens_title"]}</h3>{sens}</div></div>
<div style="break-inside:avoid"><h3>{UI["chart_cash_title"]}</h3><figure>{chart2}</figure>
<div class="legend"><span><span class="sw" style="background:#7aa6a1"></span>{T["cash_years"]}</span><span><span class="sw" style="background:#b5653b"></span>{UI["legend_cum"]}</span></div>
<p class="small">{T["cash_note"]}</p></div>
<div class="grid2" style="break-inside:avoid"><div><h3>{UI["kpi_title"]}</h3>{kr}</div><div><h3>&nbsp;</h3><div class="box">{fmt(P["fin_comment"], F)}</div></div></div>''')
    else:
        B = PARAMS["B"]
        hyp = table([UI["th"]["hyp"], UI["th"]["value"], UI["th"]["status"]], [(a, fmt(b, F), pill(c, UI)) for a, b, c in T["b_hyp"]])
        unit_rows = []
        for k, n, s, pr, c in B["units"]:
            unit_rows.append([T["unit_names"][k], str(n), fnum(s, lang, 0), fnum(pr, lang, 0), money(n * s * pr / 1e6, lang), money(n * s * c / 1e6, lang)])
        unit_rows.append({"cls": "total", "cells": [UI["total"], str(F["units"]), fnum(m["built"], lang, 0), "", money(m["sales"], lang), money(sum(n * s * c for _, n, s, _, c in B["units"]) / 1e6, lang)]})
        units_t = table(T["unit_head"], unit_rows, num_cols=(1, 2, 3, 4, 5))
        rows = [(CAPEX_LABELS[lang][k], money(v, lang), pct(v / m["total_cost"], lang, 0)) for k, v in m["capex"]]
        rows.append({"cls": "total", "cells": [UI["total"], money(m["total_cost"], lang), pct(1, lang, 0)]})
        rows.append([T["sales_line"], money(m["sales"], lang), ""])
        rows.append({"cls": "total", "cells": [T["margin_line"], money(m["margin"], lang), F["margin_pct"]]})
        capex = table([UI["th"]["item"], UI["th"]["amount"], UI["th"]["share"]], rows, num_cols=(1, 2))
        cf_rows = [[str(r["year"]), fnum(r["cash_in"], lang), fnum(-r["cash_out"], lang), fnum(r["net"], lang)] for r in m["rows"]]
        cf_rows.append({"cls": "total", "cells": [UI["total"], fnum(sum(r["cash_in"] for r in m["rows"]), lang), fnum(-sum(r["cash_out"] for r in m["rows"]), lang), fnum(sum(r["net"] for r in m["rows"]), lang)]})
        cf = table([UI["th"]["year"], UI["th"]["cash_in"], UI["th"]["cash_out"], UI["th"]["net"]], cf_rows, num_cols=(1, 2, 3))
        cum, acc = [], 0
        for r in m["rows"]:
            acc += r["net"]
            cum.append(acc)
        chart = G.bar_chart([str(r["year"]) for r in m["rows"]], [[r["cash_in"] for r in m["rows"]], [-r["cash_out"] for r in m["rows"]]], ["#2f5a43", "#c8a45c"], line=cum, neg=True)
        kr = table([UI["th"]["criterion"], UI["th"]["value"]], [(a, fmt(b, F)) for a, b in T["b_kpi_rows"]], num_cols=(1,))
        base = SENS["B"]["base"]
        sens_rows = []
        for k, lab in T["b_sens"]:
            v = SENS["B"][k]
            d = v - base
            w = min(abs(d) * 100 / 10 * 100, 100)
            sens_rows.append([lab, pct(v, lang), f'<div style="display:flex;{"flex-direction:row-reverse;" if lang == "ar" else ""}"><div class="bar {"pos" if d >= 0 else "neg"}" style="width:{w:.0f}%"></div></div>'])
        sens = table([UI["th"]["variation"], UI["th"]["irr"], ""], [[UI["base"], pct(base, lang), ""]] + sens_rows, num_cols=(1,))
        out.append(f'''<p>{T["b_fin_intro"]}</p>
<h3>{UI["hyp_title"]}</h3>{hyp}
<h3>{T["units_title"]}</h3>{units_t}
<h3>{UI["capex_title"]}</h3>{capex}
<div class="grid2"><div><h3>{T["cf_title"]} ({T["mmad"]})</h3>{cf}</div><div><h3>{UI["sens_title"]}</h3>{sens}</div></div>
<div style="break-inside:avoid"><h3>{UI["chart_promo_title"]}</h3><figure>{chart}</figure><div class="legend"><span><span class="sw" style="background:#2f5a43"></span>{UI["legend_in"]}</span><span><span class="sw" style="background:#c8a45c"></span>{UI["legend_out"]}</span><span><span class="sw" style="background:#b5653b"></span>{UI["legend_cum"]}</span></div></div>
<div class="grid2"><div><h3>{UI["kpi_title"]}</h3>{kr}<p class="small">{T["b_recurring"]}</p></div><div><h3>&nbsp;</h3><div class="box">{fmt(C.PROJECTS["B"]["fin_comment"], F)}</div></div></div>''')
    out.append("</section>")
    return "".join(out)


def main(langs=("fr", "en", "ar"), codes=("A", "B", "C"), pdf=True):
    os.makedirs(OUT_HTML, exist_ok=True)
    os.makedirs(OUT_PDF, exist_ok=True)
    jobs = []
    for lang in langs:
        C = importlib.import_module(f"content_{lang}")
        for code in codes:
            html = build_doc(code, C, lang)
            name = f"{FILE_NAMES[code]}_{lang.upper()}"
            hp = os.path.join(OUT_HTML, name + ".html")
            with open(hp, "w", encoding="utf-8") as f:
                f.write(html)
            jobs.append({"html": hp, "pdf": os.path.join(OUT_PDF, name + ".pdf"), "lang": lang,
                         "footer": C.UI["footer"].format(name=C.PROJECTS[code]["name"], code=code)})
    if pdf:
        subprocess.run(["node", os.path.join(HERE, "render.cjs"), json.dumps(jobs)], check=True)
    return jobs


if __name__ == "__main__":
    args = sys.argv[1:]
    langs = tuple(a for a in args if a in ("fr", "en", "ar")) or ("fr", "en", "ar")
    codes = tuple(a for a in args if a in ("A", "B", "C")) or ("A", "B", "C")
    main(langs, codes)

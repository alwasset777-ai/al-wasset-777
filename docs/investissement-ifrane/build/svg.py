# -*- coding: utf-8 -*-
"""Illustrations vectorielles (sans texte, pour être valables dans les 3 langues)."""
import math
import random


def _cedar(x, y, h, color, trunk="#2a1d14", snow=False):
    """Cèdre de l'Atlas stylisé : étages horizontaux aplatis."""
    w = h * 0.95
    out = [f'<rect x="{x - h * 0.03:.1f}" y="{y - h * 0.35:.1f}" width="{h * 0.06:.1f}" height="{h * 0.35:.1f}" fill="{trunk}"/>']
    tiers = 5
    for k in range(tiers):
        ty = y - h * (0.25 + 0.15 * k)
        tw = w * (1 - 0.18 * k) / 2
        th = h * 0.13
        out.append(
            f'<path d="M{x - tw:.1f},{ty:.1f} Q{x - tw * 0.4:.1f},{ty - th:.1f} {x:.1f},{ty - th * 1.25:.1f} '
            f'Q{x + tw * 0.4:.1f},{ty - th:.1f} {x + tw:.1f},{ty:.1f} Q{x:.1f},{ty + th * 0.35:.1f} {x - tw:.1f},{ty:.1f}Z" fill="{color}"/>')
        if snow:
            out.append(
                f'<path d="M{x - tw * 0.7:.1f},{ty - th * 0.55:.1f} Q{x:.1f},{ty - th * 1.35:.1f} {x + tw * 0.7:.1f},{ty - th * 0.55:.1f} '
                f'Q{x:.1f},{ty - th * 0.9:.1f} {x - tw * 0.7:.1f},{ty - th * 0.55:.1f}Z" fill="#f4f8fc" opacity="0.92"/>')
    return "".join(out)


def _fir(x, y, h, color, snow=False):
    w = h * 0.42
    out = [f'<rect x="{x - 2:.1f}" y="{y - h * 0.12:.1f}" width="4" height="{h * 0.12:.1f}" fill="#2a1d14"/>']
    for k in range(3):
        top = y - h * (0.45 + 0.27 * k) - h * 0.1
        base = y - h * (0.1 + 0.27 * k)
        ww = w * (1 - 0.25 * k)
        out.append(f'<path d="M{x:.1f},{top:.1f} L{x + ww:.1f},{base:.1f} L{x - ww:.1f},{base:.1f}Z" fill="{color}"/>')
        if snow:
            out.append(f'<path d="M{x:.1f},{top:.1f} L{x + ww * 0.45:.1f},{top + (base - top) * 0.45:.1f} L{x - ww * 0.45:.1f},{top + (base - top) * 0.45:.1f}Z" fill="#f4f8fc"/>')
    return "".join(out)


def _mountains(points_y, width, color, baseline, seed):
    rnd = random.Random(seed)
    pts = [(0, baseline)]
    n = len(points_y)
    for i, py in enumerate(points_y):
        pts.append((width * i / (n - 1), py + rnd.uniform(-6, 6)))
    pts.append((width, baseline))
    d = "M" + " L".join(f"{a:.1f},{b:.1f}" for a, b in pts) + "Z"
    return f'<path d="{d}" fill="{color}"/>'


def _forest_band(y, width, color, seed, h_min=40, h_max=75, step=22, snow=False, kind="cedar"):
    rnd = random.Random(seed)
    out = []
    x = -10
    while x < width + 20:
        h = rnd.uniform(h_min, h_max)
        if kind == "cedar" or (kind == "mix" and rnd.random() < 0.5):
            out.append(_cedar(x, y + rnd.uniform(-4, 4), h, color, snow=snow))
        else:
            out.append(_fir(x, y + rnd.uniform(-4, 4), h, color, snow=snow))
        x += step * rnd.uniform(0.7, 1.3)
    return "".join(out)


def hero_A(w=1200, h=800):
    """Éco-resort au crépuscule : suites, cabanes perchées, pavillon central, étang."""
    s = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" preserveAspectRatio="xMidYMid slice" width="100%" height="100%">',
         '<defs><linearGradient id="skyA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b2745"/><stop offset="0.45" stop-color="#5b4a6e"/>'
         '<stop offset="0.72" stop-color="#e3875a"/><stop offset="0.9" stop-color="#f6c47c"/></linearGradient>'
         '<radialGradient id="sunA" cx="0.62" cy="0.5" r="0.35"><stop offset="0" stop-color="#ffe2a6" stop-opacity="0.9"/><stop offset="1" stop-color="#ffe2a6" stop-opacity="0"/></radialGradient>'
         '<linearGradient id="meadowA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5d6a3c"/><stop offset="1" stop-color="#1f2a1c"/></linearGradient>'
         '<linearGradient id="pondA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2b46e"/><stop offset="1" stop-color="#3b3f5c"/></linearGradient>'
         '<filter id="glowA"><feGaussianBlur stdDeviation="3"/></filter></defs>',
         f'<rect width="{w}" height="{h}" fill="url(#skyA)"/>', f'<rect width="{w}" height="{h}" fill="url(#sunA)"/>']
    rnd = random.Random(4)
    for _ in range(70):
        s.append(f'<circle cx="{rnd.uniform(0, w):.0f}" cy="{rnd.uniform(0, h * 0.32):.0f}" r="{rnd.uniform(0.6, 1.6):.1f}" fill="#fff" opacity="{rnd.uniform(0.3, 0.9):.2f}"/>')
    s.append(f'<circle cx="{w * 0.62:.0f}" cy="{h * 0.55:.0f}" r="34" fill="#ffd89a" opacity="0.95"/>')
    s.append(_mountains([380, 330, 300, 350, 290, 320, 360, 310, 345, 380], w, "#6b5b78", 600, 1))
    s.append(_mountains([440, 400, 420, 380, 410, 430, 395, 420, 440], w, "#4a4560", 600, 2))
    s.append(_forest_band(500, w, "#2c3a33", 3, 55, 95, 26))
    s.append(f'<path d="M0,500 Q{w * 0.3},470 {w * 0.55},495 T{w},485 L{w},{h} L0,{h}Z" fill="url(#meadowA)"/>')
    # étang
    s.append(f'<ellipse cx="{w * 0.5:.0f}" cy="{h * 0.83:.0f}" rx="{w * 0.24:.0f}" ry="{h * 0.06:.0f}" fill="url(#pondA)" opacity="0.85"/>')
    # pavillon central (toiture en tuiles)
    px, py = w * 0.5, 560
    s.append(f'<path d="M{px - 150},{py} L{px},{py - 85} L{px + 150},{py}Z" fill="#9c4f2e"/>')
    s.append(f'<rect x="{px - 130}" y="{py}" width="260" height="70" fill="#d9c3a0"/>')
    for i in range(6):
        s.append(f'<rect x="{px - 118 + i * 41}" y="{py + 12}" width="30" height="50" fill="#ffcf7a"/>')
    s.append(f'<rect x="{px - 130}" y="{py + 70}" width="260" height="8" fill="#5b4632"/>')
    s.append(f'<rect x="{px - 160}" y="{py + 4}" width="320" height="6" fill="#7a3d22"/>')
    # cabanes perchées
    for cx, cy, sc in [(w * 0.16, 470, 1.0), (w * 0.28, 455, 0.85), (w * 0.79, 462, 0.95), (w * 0.9, 476, 1.05)]:
        bw, bh = 90 * sc, 48 * sc
        s.append(f'<g>')
        for k in range(3):
            s.append(f'<rect x="{cx - bw / 2 + 8 + k * (bw - 20) / 2:.1f}" y="{cy:.1f}" width="4" height="{110 * sc:.1f}" fill="#3a2a1d"/>')
        s.append(f'<rect x="{cx - bw / 2:.1f}" y="{cy - bh:.1f}" width="{bw:.1f}" height="{bh:.1f}" fill="#7b5a3d"/>')
        s.append(f'<rect x="{cx - bw / 2 + 6:.1f}" y="{cy - bh + 8:.1f}" width="{bw * 0.62:.1f}" height="{bh - 16:.1f}" fill="#ffcf7a"/>')
        s.append(f'<rect x="{cx - bw / 2 - 8:.1f}" y="{cy - bh - 8:.1f}" width="{bw + 16:.1f}" height="9" fill="#4e6b3a"/>')
        s.append(f'<rect x="{cx - bw / 2 - 14:.1f}" y="{cy:.1f}" width="{bw + 28:.1f}" height="5" fill="#3a2a1d"/>')
        s.append('</g>')
    # suites basses en lisière
    for sx in [w * 0.06, w * 0.33, w * 0.67, w * 0.95]:
        s.append(f'<rect x="{sx - 55:.0f}" y="590" width="110" height="34" fill="#c7ad86"/>')
        s.append(f'<rect x="{sx - 62:.0f}" y="582" width="124" height="9" fill="#4e6b3a"/>')
        s.append(f'<rect x="{sx - 45:.0f}" y="597" width="60" height="22" fill="#ffcf7a"/>')
    # avant-plan : cèdres
    s.append(_cedar(w * 0.04, h + 10, 300, "#162019"))
    s.append(_cedar(w * 0.97, h + 20, 340, "#162019"))
    s.append(_cedar(w * 0.86, h + 30, 220, "#1b261e"))
    # reflets
    s.append(f'<rect x="{px - 100}" y="{h * 0.81:.0f}" width="200" height="6" fill="#ffd89a" opacity="0.5" filter="url(#glowA)"/>')
    s.append('</svg>')
    return "".join(s)


def hero_B(w=1200, h=800):
    """Village de chalets sous la neige à l'heure bleue."""
    s = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" preserveAspectRatio="xMidYMid slice" width="100%" height="100%">',
         '<defs><linearGradient id="skyB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d1a36"/><stop offset="0.5" stop-color="#2f4d7d"/>'
         '<stop offset="0.8" stop-color="#8fa9cf"/><stop offset="1" stop-color="#c9d6ea"/></linearGradient>'
         '<linearGradient id="snowB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#dfe8f4"/><stop offset="1" stop-color="#a9bbd6"/></linearGradient>'
         '<radialGradient id="winB" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ffd27f" stop-opacity="0.6"/><stop offset="1" stop-color="#ffd27f" stop-opacity="0"/></radialGradient></defs>',
         f'<rect width="{w}" height="{h}" fill="url(#skyB)"/>']
    rnd = random.Random(7)
    for _ in range(60):
        s.append(f'<circle cx="{rnd.uniform(0, w):.0f}" cy="{rnd.uniform(0, h * 0.3):.0f}" r="{rnd.uniform(0.6, 1.4):.1f}" fill="#fff" opacity="{rnd.uniform(0.3, 0.8):.2f}"/>')
    s.append(f'<circle cx="{w * 0.18:.0f}" cy="{h * 0.16:.0f}" r="26" fill="#f2f4ff" opacity="0.9"/>')
    s.append(_mountains([360, 300, 260, 320, 280, 250, 300, 340, 300, 360], w, "#5c7398", 560, 5))
    s.append(_mountains([330, 280, 250, 300, 270, 245, 290, 330, 290, 350], w, "#e8eef8", 330, 5).replace("Z", "Z").replace('fill="#e8eef8"', 'fill="#e8eef8" opacity="0"'))
    s.append(_mountains([430, 390, 410, 370, 400, 420, 385, 410, 430], w, "#3d5478", 560, 6))
    s.append(_forest_band(470, w, "#1f3346", 8, 50, 85, 22, snow=True, kind="mix"))
    s.append(f'<path d="M0,470 Q{w * 0.4},450 {w * 0.7},470 T{w},460 L{w},{h} L0,{h}Z" fill="url(#snowB)"/>')
    chalets = [(w * 0.15, 610, 1.1), (w * 0.37, 560, 0.9), (w * 0.58, 590, 1.25), (w * 0.8, 555, 0.85), (w * 0.95, 620, 1.0)]
    for cx, cy, sc in chalets:
        bw, bh, rh = 150 * sc, 80 * sc, 70 * sc
        s.append(f'<ellipse cx="{cx:.0f}" cy="{cy - bh / 2:.0f}" rx="{bw:.0f}" ry="{bh:.0f}" fill="url(#winB)"/>')
        s.append(f'<rect x="{cx - bw / 2:.1f}" y="{cy - bh:.1f}" width="{bw:.1f}" height="{bh:.1f}" fill="#7a5034"/>')
        s.append(f'<rect x="{cx - bw / 2:.1f}" y="{cy - bh * 0.35:.1f}" width="{bw:.1f}" height="{bh * 0.35:.1f}" fill="#8d8a86"/>')
        s.append(f'<path d="M{cx - bw / 2 - 18 * sc:.1f},{cy - bh:.1f} L{cx:.1f},{cy - bh - rh:.1f} L{cx + bw / 2 + 18 * sc:.1f},{cy - bh:.1f}Z" fill="#8e3b25"/>')
        s.append(f'<path d="M{cx - bw / 2 - 18 * sc:.1f},{cy - bh:.1f} L{cx:.1f},{cy - bh - rh:.1f} L{cx + bw / 2 + 18 * sc:.1f},{cy - bh:.1f} L{cx + bw / 2 + 6 * sc:.1f},{cy - bh - 8 * sc:.1f} L{cx:.1f},{cy - bh - rh + 12 * sc:.1f} L{cx - bw / 2 - 6 * sc:.1f},{cy - bh - 8 * sc:.1f}Z" fill="#f4f8fc"/>')
        s.append(f'<path d="M{cx - bw * 0.22:.1f},{cy - bh - 4:.1f} L{cx:.1f},{cy - bh - rh * 0.55:.1f} L{cx + bw * 0.22:.1f},{cy - bh - 4:.1f}Z" fill="#ffcf7a"/>')
        for k in range(3):
            s.append(f'<rect x="{cx - bw / 2 + 12 * sc + k * bw / 3:.1f}" y="{cy - bh + 12 * sc:.1f}" width="{bw / 3 - 22 * sc:.1f}" height="{bh * 0.4:.1f}" fill="#ffcf7a"/>')
        chx = cx + bw * 0.25
        s.append(f'<rect x="{chx:.1f}" y="{cy - bh - rh * 0.7:.1f}" width="{12 * sc:.1f}" height="{rh * 0.45:.1f}" fill="#5c5650"/>')
        for k in range(4):
            s.append(f'<circle cx="{chx + 6 * sc + k * 9:.1f}" cy="{cy - bh - rh * 0.75 - k * 16:.1f}" r="{6 + k * 3:.1f}" fill="#dfe6f0" opacity="{0.45 - k * 0.09:.2f}"/>')
    s.append(_fir(w * 0.03, h + 10, 300, "#14243a", snow=True))
    s.append(_fir(w * 0.99, h + 20, 340, "#14243a", snow=True))
    s.append(_cedar(w * 0.7, h + 30, 200, "#1a2c40", snow=True))
    for _ in range(160):
        s.append(f'<circle cx="{rnd.uniform(0, w):.0f}" cy="{rnd.uniform(0, h):.0f}" r="{rnd.uniform(0.8, 2.4):.1f}" fill="#fff" opacity="{rnd.uniform(0.4, 0.9):.2f}"/>')
    s.append('</svg>')
    return "".join(s)


def hero_C(w=1200, h=800):
    """Thermes et pavillon de bien-être dans la brume du matin."""
    s = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" preserveAspectRatio="xMidYMid slice" width="100%" height="100%">',
         '<defs><linearGradient id="skyC" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b9cfd3"/><stop offset="0.45" stop-color="#efe2cf"/>'
         '<stop offset="0.7" stop-color="#f7ead7"/><stop offset="1" stop-color="#e9efe9"/></linearGradient>'
         '<linearGradient id="poolC" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fd3cf"/><stop offset="1" stop-color="#4f8f92"/></linearGradient>'
         '<linearGradient id="mistC" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0"/><stop offset="0.5" stop-color="#ffffff" stop-opacity="0.75"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient>'
         '<filter id="blurC"><feGaussianBlur stdDeviation="8"/></filter></defs>',
         f'<rect width="{w}" height="{h}" fill="url(#skyC)"/>',
         f'<circle cx="{w * 0.7:.0f}" cy="{h * 0.3:.0f}" r="48" fill="#fff6e6" opacity="0.95"/>']
    s.append(_mountains([380, 340, 310, 350, 300, 330, 370, 320, 350, 390], w, "#a9b8b4", 600, 9))
    s.append(f'<rect x="0" y="360" width="{w}" height="90" fill="url(#mistC)"/>')
    s.append(_forest_band(470, w, "#7f988c", 10, 50, 90, 26))
    s.append(f'<rect x="0" y="420" width="{w}" height="80" fill="url(#mistC)"/>')
    s.append(_forest_band(520, w, "#4d6a5a", 11, 60, 100, 30))
    s.append(f'<path d="M0,520 L{w},515 L{w},{h} L0,{h}Z" fill="#c9cdb5"/>')
    # pavillon long à brise-soleil
    x0, y0, pw, ph = w * 0.18, 520, w * 0.64, 95
    s.append(f'<rect x="{x0:.0f}" y="{y0 - 12}" width="{pw:.0f}" height="14" fill="#5e6e4c"/>')
    s.append(f'<rect x="{x0 - 20:.0f}" y="{y0}" width="{pw + 40:.0f}" height="10" fill="#e8e1d3"/>')
    s.append(f'<rect x="{x0:.0f}" y="{y0 + 10}" width="{pw:.0f}" height="{ph}" fill="#f2dcb4"/>')
    n = 46
    for i in range(n):
        s.append(f'<rect x="{x0 + 6 + i * (pw - 12) / n:.1f}" y="{y0 + 10}" width="{(pw - 12) / n * 0.45:.1f}" height="{ph}" fill="#a77b55"/>')
    s.append(f'<rect x="{x0 + pw * 0.38:.0f}" y="{y0 + 10}" width="{pw * 0.24:.0f}" height="{ph}" fill="#fbe9c8" opacity="0.92"/>')
    # terrasse et bassin
    s.append(f'<rect x="{w * 0.08:.0f}" y="{y0 + ph + 10}" width="{w * 0.84:.0f}" height="16" fill="#cdb79a"/>')
    s.append(f'<rect x="{w * 0.12:.0f}" y="{y0 + ph + 26}" width="{w * 0.76:.0f}" height="70" fill="url(#poolC)"/>')
    s.append(f'<rect x="{w * 0.12:.0f}" y="{y0 + ph + 26}" width="{w * 0.76:.0f}" height="4" fill="#e8f6f4"/>')
    rnd = random.Random(12)
    for _ in range(14):
        cx = rnd.uniform(w * 0.15, w * 0.85)
        s.append(f'<ellipse cx="{cx:.0f}" cy="{y0 + ph + 20:.0f}" rx="{rnd.uniform(30, 70):.0f}" ry="{rnd.uniform(10, 22):.0f}" fill="#ffffff" opacity="0.55" filter="url(#blurC)"/>')
    s.append(f'<rect x="0" y="{y0 + ph + 96}" width="{w}" height="{h}" fill="#b9b39a"/>')
    s.append(f'<rect x="0" y="{y0 + ph + 96}" width="{w}" height="8" fill="#a49d82"/>')
    s.append(_cedar(w * 0.05, h + 10, 320, "#334a3d"))
    s.append(_cedar(w * 0.95, h + 25, 360, "#2e4437"))
    s.append(f'<rect x="0" y="{h * 0.88:.0f}" width="{w}" height="{h * 0.12:.0f}" fill="url(#mistC)" opacity="0.6"/>')
    s.append('</svg>')
    return "".join(s)


HEROES = {"A": hero_A, "B": hero_B, "C": hero_C}


# ---------------------------------------------------------------- coupes de principe (numérotées, légende en HTML)
def _num(x, y, n, color="#b5653b"):
    return (f'<circle cx="{x}" cy="{y}" r="13" fill="{color}"/>'
            f'<text x="{x}" y="{y + 4.5}" font-family="Inter, Cairo, sans-serif" font-size="13" font-weight="700" fill="#fff" text-anchor="middle">{n}</text>')


def section_A():
    s = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 380" width="100%">',
         '<rect width="800" height="380" fill="#f6f1e7"/>',
         '<path d="M0,330 Q200,315 400,325 T800,320 L800,380 L0,380Z" fill="#cbbf9f"/>']
    s.append(_cedar(90, 330, 250, "#4a6b55"))
    s.append(_cedar(720, 330, 270, "#4a6b55"))
    for x in (300, 400, 500):
        s.append(f'<rect x="{x}" y="200" width="10" height="130" fill="#6b4e33"/>')
    s.append('<rect x="250" y="190" width="320" height="12" fill="#6b4e33"/>')
    s.append('<rect x="270" y="100" width="260" height="90" fill="none" stroke="#3a2a1d" stroke-width="3"/>')
    s.append('<rect x="280" y="112" width="150" height="68" fill="#cfe3ea" stroke="#3a2a1d" stroke-width="1.5"/>')
    s.append('<rect x="255" y="86" width="290" height="14" fill="#6f8f4e"/>')
    for i in range(5):
        s.append(f'<rect x="{275 + i * 52}" y="72" width="40" height="10" fill="#2f4f7f" transform="skewX(-20)"/>')
    s.append('<ellipse cx="510" cy="178" rx="30" ry="8" fill="#9fd3cf" stroke="#3a2a1d"/>')
    s.append('<path d="M560,196 L640,196" stroke="#3a2a1d" stroke-width="2" stroke-dasharray="5 4"/>')
    s.append('<path d="M150,330 C200,300 230,290 260,240" stroke="#8c7a5c" stroke-width="3" fill="none" stroke-dasharray="6 5"/>')
    for x, y, n in [(390, 60, 1), (340, 146, 2), (560, 160, 3), (420, 260, 4), (190, 285, 5), (640, 220, 6)]:
        s.append(_num(x, y, n))
    s.append('</svg>')
    return "".join(s)


def section_B():
    s = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 380" width="100%">',
         '<rect width="800" height="380" fill="#f6f1e7"/>',
         '<path d="M0,320 L800,300 L800,380 L0,380Z" fill="#cbbf9f"/>']
    s.append(_fir(80, 320, 230, "#4a6b55"))
    s.append(_fir(740, 305, 250, "#4a6b55"))
    s.append('<rect x="200" y="210" width="400" height="104" fill="#e9dcc6" stroke="#3a2a1d" stroke-width="3"/>')
    s.append('<rect x="200" y="120" width="400" height="90" fill="#efe5d4" stroke="#3a2a1d" stroke-width="3"/>')
    s.append('<path d="M170,120 L400,30 L630,120Z" fill="#9c4f2e" stroke="#3a2a1d" stroke-width="3"/>')
    s.append('<rect x="220" y="230" width="150" height="70" fill="#cfe3ea" stroke="#3a2a1d"/>')
    s.append('<rect x="420" y="135" width="150" height="60" fill="#cfe3ea" stroke="#3a2a1d"/>')
    s.append('<rect x="610" y="270" width="110" height="34" fill="#9fd3cf" stroke="#3a2a1d"/>')
    s.append('<rect x="470" y="40" width="20" height="60" fill="#5c5650"/>')
    s.append('<rect x="200" y="314" width="400" height="22" fill="#b3a585" stroke="#3a2a1d"/>')
    for x, y, n in [(300, 265, 1), (480, 165, 2), (300, 165, 3), (665, 255, 4), (400, 75, 5), (400, 326, 6)]:
        s.append(_num(x, y, n))
    s.append('</svg>')
    return "".join(s)


def section_C():
    s = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 380" width="100%">',
         '<rect width="800" height="380" fill="#f6f1e7"/>',
         '<path d="M0,200 L800,190 L800,380 L0,380Z" fill="#d6cbb0"/>']
    s.append(_cedar(70, 200, 180, "#4a6b55"))
    s.append(_cedar(740, 192, 200, "#4a6b55"))
    s.append('<rect x="150" y="110" width="500" height="85" fill="#f2dcb4" stroke="#3a2a1d" stroke-width="3"/>')
    for i in range(24):
        s.append(f'<rect x="{156 + i * 20.5}" y="112" width="8" height="81" fill="#a77b55"/>')
    s.append('<rect x="140" y="96" width="520" height="14" fill="#6f8f4e"/>')
    s.append('<rect x="150" y="200" width="500" height="120" fill="#e9e1d1" stroke="#3a2a1d" stroke-width="3"/>')
    s.append('<rect x="170" y="235" width="140" height="60" fill="#e7a07e" stroke="#3a2a1d"/>')
    s.append('<rect x="330" y="235" width="140" height="60" fill="#9fd3cf" stroke="#3a2a1d"/>')
    s.append('<rect x="490" y="215" width="140" height="90" fill="#efe5d4" stroke="#3a2a1d"/>')
    s.append('<rect x="660" y="175" width="120" height="22" fill="#9fd3cf" stroke="#3a2a1d"/>')
    for k in range(4):
        s.append(f'<ellipse cx="{690 + k * 22}" cy="{160 - k * 6}" rx="16" ry="6" fill="#fff" opacity="0.8"/>')
    for x, y, n in [(240, 265, 1), (400, 265, 2), (560, 260, 3), (720, 140, 4), (400, 80, 5), (400, 150, 6)]:
        s.append(_num(x, y, n))
    s.append('</svg>')
    return "".join(s)


SECTIONS = {"A": section_A, "B": section_B, "C": section_C}

# ---------------------------------------------------------------- plans de masse
ZONE_COLORS = ["#b5653b", "#6f8f4e", "#c8a45c", "#8d6e9e", "#d98f6a", "#9cb36b", "#7aa6a1", "#9a9a9a", "#cfe0b8"]
SITE_POLY = [(70, 70), (520, 40), (700, 120), (720, 410), (470, 500), (140, 470), (50, 270)]


def _poly(pts, fill, op=1.0, stroke="none", sw=0):
    d = "M" + " L".join(f"{x},{y}" for x, y in pts) + "Z"
    return f'<path d="{d}" fill="{fill}" fill-opacity="{op}" stroke="{stroke}" stroke-width="{sw}"/>'


def _trees(rnd, region, n, color="#3f6b4a"):
    x0, y0, x1, y1 = region
    return "".join(f'<circle cx="{rnd.uniform(x0, x1):.0f}" cy="{rnd.uniform(y0, y1):.0f}" r="{rnd.uniform(5, 10):.0f}" fill="{color}" opacity="0.75"/>' for _ in range(n))


def _base_plan():
    rnd = random.Random(21)
    s = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 540" width="100%">',
         '<rect width="800" height="540" fill="#e7e3d2"/>']
    # forêt environnante
    for _ in range(420):
        x, y = rnd.uniform(0, 800), rnd.uniform(0, 540)
        s.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{rnd.uniform(6, 12):.0f}" fill="#4f7a57" opacity="0.55"/>')
    # route RP7229 (à l'est du terrain)
    s.append('<path d="M560,540 C700,420 740,250 800,120" stroke="#8a8a8a" stroke-width="18" fill="none"/>')
    s.append('<path d="M560,540 C700,420 740,250 800,120" stroke="#fff" stroke-width="1.5" stroke-dasharray="10 8" fill="none"/>')
    s.append(_poly(SITE_POLY, ZONE_COLORS[8], 1, "#2b2b2b", 2.5))
    return s, rnd


def _finish_plan(s):
    # nord + échelle
    s.append('<g transform="translate(40,500)"><path d="M0,-30 L9,0 L0,-7 L-9,0Z" fill="#222"/>'
             '<text x="0" y="14" font-family="Inter, sans-serif" font-size="12" font-weight="700" text-anchor="middle">N</text></g>')
    s.append('<g transform="translate(600,520)"><rect width="100" height="5" fill="#222"/><rect x="50" width="50" height="5" fill="#fff" stroke="#222"/>'
             '<text x="0" y="-5" font-family="Inter, sans-serif" font-size="10">0</text><text x="100" y="-5" font-family="Inter, sans-serif" font-size="10" text-anchor="end">≈ 50 m</text></g>')
    s.append('</svg>')
    return "".join(s)


def _bldg(x, y, w, h, color="#5b4632"):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{color}" rx="1.5"/>'


def plan_A():
    s, rnd = _base_plan()
    zones = [
        [(330, 210), (450, 200), (470, 280), (360, 300)],                      # 1 cœur
        [(90, 90), (500, 60), (520, 110), (330, 140), (120, 170)],             # 2 suites & cabanes
        [(560, 150), (690, 150), (700, 270), (590, 260)],                      # 3 villas hôtel
        [(150, 360), (330, 360), (340, 460), (150, 455)],                      # 4 résidences
        [(500, 110), (650, 110), (660, 150), (540, 160)],                      # 5 événements
        [(360, 330), (480, 330), (480, 420), (360, 430)],                      # 6 potager
        [(65, 200), (200, 190), (210, 330), (70, 300)],                        # 7 équestre
    ]
    for i, z in enumerate(zones):
        s.append(_poly(z, ZONE_COLORS[i], 0.55))
    s.append('<path d="M705,300 C640,300 560,320 470,300 L420,300 M470,300 C520,360 520,420 470,470 M420,300 C300,320 250,340 200,360" stroke="#9a9a9a" stroke-width="7" fill="none" stroke-linecap="round"/>')
    s.append(_bldg(360, 225, 90, 50, "#7a3d22"))
    for k in range(7):
        s.append(_bldg(120 + k * 52, 110 - k * 4, 26, 16))
    for k in range(6):
        s.append(f'<circle cx="{150 + k * 55}" cy="{150 - k * 3}" r="7" fill="#3a2a1d"/>')
    for k in range(4):
        s.append(_bldg(580 + (k % 2) * 55, 170 + (k // 2) * 45, 34, 24))
    for k in range(8):
        s.append(_bldg(165 + (k % 4) * 42, 375 + (k // 4) * 42, 26, 22))
    s.append(_bldg(560, 120, 50, 22, "#7a3d22"))
    for k in range(5):
        for j in range(3):
            s.append(f'<rect x="{372 + k * 20}" y="{342 + j * 25}" width="14" height="12" fill="#86a35a"/>')
    s.append(_bldg(95, 230, 40, 20))
    s.append('<ellipse cx="415" cy="320" rx="40" ry="10" fill="#7fb6c9"/>')
    s.append(s.pop() if False else "")
    s.append(_trees(rnd, (520, 300, 690, 400), 18))
    s.append(_trees(rnd, (220, 180, 320, 300), 10))
    for (x, y), n in zip([(400, 250), (300, 125), (630, 205), (240, 410), (590, 135), (420, 380), (135, 260), (600, 310), (620, 360)], range(1, 10)):
        s.append(_num(x, y, n))
    return _finish_plan(s)


def plan_B():
    s, rnd = _base_plan()
    zones = [
        [(90, 80), (510, 52), (520, 120), (100, 150)],            # 1 villas signature
        [(60, 160), (200, 160), (220, 460), (140, 465), (55, 280)],  # 2 villas forêt (ouest)
        [(560, 330), (700, 300), (710, 400), (560, 440)],          # 3 lodges
        [(560, 180), (690, 170), (700, 280), (570, 300)],          # 4 club
    ]
    for i, z in enumerate(zones):
        s.append(_poly(z, ZONE_COLORS[i], 0.5))
    s.append(_poly([(220, 470), (470, 495), (560, 440), (540, 390), (240, 400)], ZONE_COLORS[1], 0.5))
    s.append('<path d="M705,290 L560,300 C450,290 300,200 230,200 C210,260 220,360 260,400 C330,410 450,410 540,380 L560,300" stroke="#9a9a9a" stroke-width="8" fill="none" stroke-linejoin="round"/>')
    for k in range(8):
        s.append(_bldg(110 + k * 50, 85 - k * 3, 30, 24))
    for k in range(14):
        s.append(_bldg(80 + (k % 2) * 60, 175 + (k // 2) * 40, 22, 18))
    for k in range(14):
        s.append(_bldg(255 + k * 21, 430 + (k % 2) * 22, 15, 14))
    for k in range(4):
        s.append(_bldg(580 + (k % 2) * 60, 340 + (k // 2) * 45, 40, 22))
    s.append(_bldg(585, 200, 80, 50, "#7a3d22"))
    s.append('<rect x="600" y="262" width="40" height="14" fill="#7fb6c9"/>')
    s.append(_trees(rnd, (280, 160, 520, 360), 38))
    for (x, y), n in zip([(300, 110), (130, 300), (620, 380), (640, 230), (420, 260), (380, 300)], range(1, 7)):
        s.append(_num(x, y, n))
    return _finish_plan(s)


def plan_C():
    s, rnd = _base_plan()
    zones = [
        [(320, 200), (470, 190), (480, 300), (330, 310)],          # 1 clinique & thermes
        [(90, 90), (500, 60), (520, 115), (330, 150), (120, 170)], # 2 suites
        [(560, 140), (690, 140), (700, 230), (580, 240)],          # 3 villas pavillons
        [(150, 360), (330, 360), (340, 460), (150, 455)],          # 4 résidences
        [(500, 310), (700, 280), (710, 400), (520, 420)],          # 5 jardins méditation
        [(360, 340), (480, 340), (480, 430), (360, 440)],          # 6 potager
        [(65, 200), (200, 190), (210, 330), (70, 300)],            # 7 parcours sportif
    ]
    for i, z in enumerate(zones):
        s.append(_poly(z, ZONE_COLORS[i], 0.55))
    s.append('<path d="M705,260 C640,265 560,275 480,260 M480,260 C520,330 510,420 470,470 M330,260 C260,300 230,330 210,360" stroke="#9a9a9a" stroke-width="7" fill="none" stroke-linecap="round"/>')
    s.append(_bldg(335, 215, 130, 40, "#7a3d22"))
    s.append('<rect x="345" y="262" width="110" height="22" fill="#7fb6c9"/>')
    for k in range(10):
        s.append(_bldg(115 + k * 37, 108 - k * 3, 22, 14))
    for k in range(4):
        s.append(_bldg(585 + (k % 2) * 55, 160 + (k // 2) * 40, 32, 22))
    for k in range(6):
        s.append(_bldg(170 + (k % 3) * 55, 380 + (k // 3) * 45, 30, 24))
    for k in range(5):
        for j in range(3):
            s.append(f'<rect x="{372 + k * 20}" y="{352 + j * 25}" width="14" height="12" fill="#86a35a"/>')
    s.append('<ellipse cx="135" cy="260" rx="55" ry="40" fill="none" stroke="#c46a3b" stroke-width="5"/>')
    s.append('<circle cx="610" cy="350" r="14" fill="#efe5d4" stroke="#5b4632" stroke-width="3"/>')
    s.append('<path d="M530,330 C580,300 650,320 690,380" stroke="#c8a45c" stroke-width="3" stroke-dasharray="5 5" fill="none"/>')
    s.append(_trees(rnd, (520, 330, 700, 400), 14))
    for (x, y), n in zip([(400, 240), (300, 128), (640, 190), (240, 410), (640, 380), (420, 390), (135, 230), (560, 262), (250, 260)], range(1, 10)):
        s.append(_num(x, y, n))
    return _finish_plan(s)


PLANS = {"A": plan_A, "B": plan_B, "C": plan_C}


# ---------------------------------------------------------------- graphiques (sans texte de légende : légende HTML)
def bar_chart(labels, series, colors, w=760, h=270, line=None, line_color="#b5653b", neg=False):
    pad_l, pad_r, pad_t, pad_b = 46, 12, 14, 26
    vals = [v for ser in series for v in ser] + (line or [])
    vmax = max(vals + [0])
    vmin = min(vals + [0]) if neg or line else 0
    span = vmax - vmin or 1
    step = _nice_step(span / 5)
    top = math.ceil(vmax / step) * step
    bot = math.floor(vmin / step) * step if vmin < 0 else 0
    span = top - bot
    sy = lambda v: pad_t + (top - v) / span * (h - pad_t - pad_b)
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="100%" style="direction:ltr">']
    v = bot
    while v <= top + 1e-9:
        y = sy(v)
        out.append(f'<line x1="{pad_l}" x2="{w - pad_r}" y1="{y:.1f}" y2="{y:.1f}" stroke="{"#555" if abs(v) < 1e-9 else "#ddd6c8"}" stroke-width="{1.2 if abs(v) < 1e-9 else 0.8}"/>')
        out.append(f'<text x="{pad_l - 6}" y="{y + 3.5:.1f}" font-family="Inter, sans-serif" font-size="10" fill="#666" text-anchor="end">{v:,.0f}</text>')
        v += step
    n = len(labels)
    gw = (w - pad_l - pad_r) / n
    bw = gw * 0.72 / len(series)
    for i, lab in enumerate(labels):
        gx = pad_l + i * gw + gw * 0.14
        for j, ser in enumerate(series):
            val = ser[i]
            y0, y1 = sy(max(val, 0)), sy(min(val, 0))
            out.append(f'<rect x="{gx + j * bw:.1f}" y="{y0:.1f}" width="{bw * 0.92:.1f}" height="{max(y1 - y0, 0.5):.1f}" fill="{colors[j]}" rx="1.5"/>')
        out.append(f'<text x="{pad_l + i * gw + gw / 2:.1f}" y="{h - 8}" font-family="Inter, sans-serif" font-size="10" fill="#444" text-anchor="middle">{lab}</text>')
    if line:
        pts = " ".join(f"{pad_l + i * gw + gw / 2:.1f},{sy(v):.1f}" for i, v in enumerate(line))
        out.append(f'<polyline points="{pts}" fill="none" stroke="{line_color}" stroke-width="2.5"/>')
        for i, v in enumerate(line):
            out.append(f'<circle cx="{pad_l + i * gw + gw / 2:.1f}" cy="{sy(v):.1f}" r="3.2" fill="{line_color}"/>')
    out.append('</svg>')
    return "".join(out)


def _nice_step(x):
    if x <= 0:
        return 1
    e = 10 ** math.floor(math.log10(x))
    for m in (1, 2, 2.5, 5, 10):
        if m * e >= x:
            return m * e
    return 10 * e


def logo_svg(size=34):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="{size}" height="{size}">'
            '<rect width="64" height="64" rx="14" fill="#2b1b18"/>'
            '<path d="M14,30 L32,14 L50,30 L45,30 L45,44 L19,44 L19,30Z" fill="#ff6b5b"/>'
            '<rect x="28" y="32" width="8" height="12" fill="#2b1b18"/>'
            '<rect x="16" y="47" width="32" height="11" rx="3" fill="#ff6b5b"/>'
            '<text x="32" y="56" font-family="Inter, sans-serif" font-size="9" font-weight="800" fill="#fff" text-anchor="middle">777</text></svg>')

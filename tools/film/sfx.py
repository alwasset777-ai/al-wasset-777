"""Effets sonores synthétisés (aucun fichier externe, libres de droits).

Chaque effet : fonction(sr, **params) → tableau float32. render(events, total, sr) les place dans le temps.
Noms : ring, tick, sigh, whoosh, heartbeat, click, digital, pop, typing, shutter, ding, vibrate, notif,
       tear, boom, chime, riser, coins, applause, murmur, engine, stamp, swoosh_up, page, glass, gavel
"""
import numpy as np

rng = np.random.default_rng(7)


def _t(sr, dur):
    return np.arange(int(sr * dur)) / sr


def _env(n, a, r, sr):
    e = np.ones(n)
    na, nr = int(a * sr), int(r * sr)
    if na:
        e[:na] = np.linspace(0, 1, na)
    if nr:
        e[-nr:] *= np.linspace(1, 0, nr)
    return e


def _lp(x, k):
    """Passe-bas simple (moyenne glissante de k échantillons)."""
    if k <= 1:
        return x
    c = np.cumsum(np.insert(x, 0, 0))
    y = (c[k:] - c[:-k]) / k
    return np.concatenate([y, np.zeros(k - 1)])


def ring(sr, dur=3.0, **_):
    t = _t(sr, dur)
    tone = 0.5 * (np.sin(2 * np.pi * 440 * t) + np.sin(2 * np.pi * 480 * t)) * (np.sin(2 * np.pi * 20 * t) > 0)
    gate = ((t % 2.0) < 1.0).astype(float)  # sonnerie 1 s / silence 1 s
    return 0.35 * tone * gate * _env(len(t), 0.01, 0.05, sr)


def tick(sr, dur=6.0, **_):
    out = np.zeros(int(sr * dur))
    k = _t(sr, 0.03)
    clk = rng.standard_normal(len(k)) * np.exp(-k * 250) + np.sin(2 * np.pi * 2500 * k) * np.exp(-k * 300)
    for i, s in enumerate(np.arange(0, dur - 0.05, 0.5)):
        j = int(s * sr)
        out[j:j + len(k)] += clk * (0.5 if i % 2 else 0.35)
    return 0.6 * out


def sigh(sr, **_):
    t = _t(sr, 1.6)
    n = _lp(rng.standard_normal(len(t)), 30)
    return 0.5 * n * np.sin(np.pi * t / 1.6) ** 2


def whoosh(sr, dur=1.0, up=False, **_):
    t = _t(sr, dur)
    n = rng.standard_normal(len(t))
    k = (np.linspace(40, 6, len(t)) if not up else np.linspace(6, 40, len(t))).astype(int)
    y = np.zeros_like(n)
    c = np.cumsum(np.insert(n, 0, 0))
    for kk in np.unique(k):
        idx = np.flatnonzero(k == kk)
        lo = np.clip(idx - kk, 0, None)
        y[idx] = (c[idx] - c[lo]) / kk
    return 0.9 * y * np.sin(np.pi * t / dur) ** 1.5


def swoosh_up(sr, **kw):
    return whoosh(sr, dur=1.4, up=True)


def heartbeat(sr, dur=3.0, **_):
    out = np.zeros(int(sr * dur))
    k = _t(sr, 0.18)
    thump = np.sin(2 * np.pi * 55 * k) * np.exp(-k * 25)
    for s in np.arange(0, dur - 0.4, 0.9):
        for d, g in ((0, 1.0), (0.22, 0.7)):
            j = int((s + d) * sr)
            out[j:j + len(k)] += g * thump
    return 0.9 * out


def click(sr, **_):
    k = _t(sr, 0.12)
    a = np.sin(2 * np.pi * 1800 * k) * np.exp(-k * 120) + 0.6 * rng.standard_normal(len(k)) * np.exp(-k * 200)
    b = np.zeros(int(0.07 * sr))
    return 0.7 * np.concatenate([a * 0.6, b, a])


def digital(sr, count=6, step=0.22, **_):
    out = np.zeros(int(sr * (count * step + 0.2)))
    k = _t(sr, 0.07)
    for i in range(count):
        f = 1200 + 160 * (i % 4)
        j = int(i * step * sr)
        out[j:j + len(k)] += np.sin(2 * np.pi * f * k) * np.exp(-k * 60)
    return 0.35 * out


def pop(sr, **_):
    k = _t(sr, 0.15)
    f = 300 + 900 * np.exp(-k * 40)
    return 0.6 * np.sin(2 * np.pi * np.cumsum(f) / sr) * np.exp(-k * 30)


def typing(sr, dur=2.0, **_):
    out = np.zeros(int(sr * dur))
    k = _t(sr, 0.03)
    for s in np.cumsum(rng.uniform(0.07, 0.16, 40)):
        if s > dur - 0.05:
            break
        j = int(s * sr)
        out[j:j + len(k)] += rng.standard_normal(len(k)) * np.exp(-k * 220) * rng.uniform(0.4, 0.8)
    return 0.45 * out


def shutter(sr, **_):
    k = _t(sr, 0.06)
    a = rng.standard_normal(len(k)) * np.exp(-k * 120)
    return 0.5 * np.concatenate([a, np.zeros(int(0.05 * sr)), 0.7 * a])


def ding(sr, **_):
    k = _t(sr, 1.4)
    return 0.4 * (np.sin(2 * np.pi * 1318.5 * k) + 0.5 * np.sin(2 * np.pi * 1975.5 * k)) * np.exp(-k * 3.5)


def chime(sr, **_):
    k = _t(sr, 1.2)
    a = np.sin(2 * np.pi * 880 * k) * np.exp(-k * 4)
    b = np.zeros_like(k)
    j = int(0.12 * sr)
    b[j:] = np.sin(2 * np.pi * 1318.5 * k[: len(k) - j]) * np.exp(-k[: len(k) - j] * 4)
    return 0.22 * (a + b)


def vibrate(sr, **_):
    t = _t(sr, 0.9)
    buzz = np.sign(np.sin(2 * np.pi * 150 * t)) * 0.3 + rng.standard_normal(len(t)) * 0.05
    gate = ((t % 0.45) < 0.32).astype(float)
    return 0.35 * _lp(buzz, 4) * gate


def notif(sr, **_):
    k = _t(sr, 0.5)
    a = np.sin(2 * np.pi * 1046.5 * k) * np.exp(-k * 9)
    b = np.zeros(int(0.09 * sr))
    c = np.sin(2 * np.pi * 1568 * k) * np.exp(-k * 7)
    return 0.4 * np.concatenate([a[: int(0.12 * sr)], b, c])


def tear(sr, **_):
    t = _t(sr, 0.7)
    n = rng.standard_normal(len(t)) * (rng.random(len(t)) > 0.6)
    return 0.6 * _lp(n, 3) * np.sin(np.pi * t / 0.7)


def boom(sr, gain=1.0, **_):
    k = _t(sr, 2.5)
    f = 38 + 60 * np.exp(-k * 6)
    body = np.sin(2 * np.pi * np.cumsum(f) / sr) * np.exp(-k * 1.6)
    hit = _lp(rng.standard_normal(len(k)), 12) * np.exp(-k * 9)
    return gain * 0.9 * (body + 0.4 * hit)


def riser(sr, dur=2.5, **_):
    t = _t(sr, dur)
    f = 200 * (8 ** (t / dur))
    tone = np.sin(2 * np.pi * np.cumsum(f) / sr)
    return 0.18 * (tone + 0.6 * whoosh(sr, dur, up=True)[: len(t)]) * (t / dur) ** 2


def coins(sr, **_):
    out = np.zeros(int(sr * 1.2))
    k = _t(sr, 0.25)
    for i, s in enumerate(np.cumsum(rng.uniform(0.04, 0.12, 9))):
        f = rng.uniform(2500, 4200)
        j = int(s * sr)
        seg = np.sin(2 * np.pi * f * k) * np.exp(-k * 25)
        out[j:j + len(k)] += seg[: len(out) - j]
    return 0.25 * out


def applause(sr, dur=3.0, **_):
    t = _t(sr, dur)
    out = np.zeros(len(t))
    k = _t(sr, 0.02)
    for s in rng.uniform(0, dur - 0.05, int(dur * 220)):
        j = int(s * sr)
        out[j:j + len(k)] += rng.standard_normal(len(k)) * np.exp(-k * 300) * rng.uniform(0.2, 1)
    return 0.25 * out * _env(len(t), 0.4, 0.8, sr)


def murmur(sr, dur=3.0, **_):
    t = _t(sr, dur)
    n = _lp(rng.standard_normal(len(t)), 40)
    am = 0.6 + 0.4 * np.sin(2 * np.pi * 3.1 * t) * np.sin(2 * np.pi * 0.7 * t)
    return 0.5 * n * am * _env(len(t), 0.5, 0.8, sr)


def engine(sr, dur=3.0, **_):
    t = _t(sr, dur)
    hum = np.sin(2 * np.pi * 42 * t) + 0.5 * np.sin(2 * np.pi * 84 * t) + 0.3 * _lp(rng.standard_normal(len(t)), 60)
    return 0.3 * hum * _env(len(t), 0.6, 0.8, sr)


def stamp(sr, **_):
    k = _t(sr, 0.4)
    return 0.8 * (np.sin(2 * np.pi * 90 * k) * np.exp(-k * 18) + 0.5 * _lp(rng.standard_normal(len(k)), 6) * np.exp(-k * 40))


def page(sr, **_):
    t = _t(sr, 0.45)
    return 0.4 * _lp(rng.standard_normal(len(t)), 5) * np.sin(np.pi * t / 0.45) ** 3


def glass(sr, **_):
    k = _t(sr, 1.5)
    return 0.25 * (np.sin(2 * np.pi * 2093 * k) + 0.6 * np.sin(2 * np.pi * 3136 * k)) * np.exp(-k * 3)


def gavel(sr, **_):
    k = _t(sr, 0.35)
    a = np.sin(2 * np.pi * 180 * k) * np.exp(-k * 30) + 0.4 * rng.standard_normal(len(k)) * np.exp(-k * 60)
    return 0.7 * np.concatenate([a, np.zeros(int(0.12 * sr)), a])


FX = {f.__name__: f for f in (ring, tick, sigh, whoosh, swoosh_up, heartbeat, click, digital, pop, typing, shutter, ding, chime,
                              vibrate, notif, tear, boom, riser, coins, applause, murmur, engine, stamp, page, glass, gavel)}


def render(events, total, sr):
    buf = np.zeros(int(total * sr) + sr, dtype=np.float32)
    for t, name, params in events:
        p = {k: v for k, v in params.items() if k not in ("name", "at")}
        gain = p.pop("gain", 1.0)
        x = (FX[name](sr, **p) * gain).astype(np.float32)
        i = int(t * sr)
        j = min(len(buf), i + len(x))
        if i < len(buf):
            buf[i:j] += x[: j - i]
    return buf

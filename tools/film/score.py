"""Musique de film générée (épique / cinématique, libre de droits), qui suit l'ambiance de chaque scène.

Ré mineur, progression Dm – Bb – F – C, 84 BPM. Couches : bourdon grave, nappe de cordes, piano,
ostinato (cordes staccato), rythme électronique léger, percussions (timbales/taiko), chœur/cuivres.
Chaque segment du film donne une ambiance (mood) et une intensité ; les volumes de chaque couche
glissent doucement d'un segment à l'autre. Le PDF demande une montée jusqu'à la scène 18 puis le final.
"""
import numpy as np

BPM = 84
BEAT = 60 / BPM
BAR = 4 * BEAT
CHORDS = [  # (basse, notes de la nappe) en MIDI
    (38, [50, 53, 57, 62]),  # Dm
    (34, [46, 50, 53, 58]),  # Bb
    (41, [48, 53, 57, 60]),  # F
    (36, [48, 52, 55, 60]),  # C
]
CH_LEN = 2 * BAR

# volumes des couches par ambiance : drone, pad, piano, ostinato, beat, drums, choir
MOODS = {
    "silence": (0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0),
    "tense": (0.9, 0.35, 0.0, 0.25, 0.0, 0.0, 0.0),
    "pure": (0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0),  # une seule note claire (ajoutée à part)
    "piano": (0.2, 0.45, 0.8, 0.0, 0.0, 0.0, 0.0),
    "electro": (0.2, 0.45, 0.35, 0.3, 0.7, 0.0, 0.0),
    "steady": (0.2, 0.55, 0.3, 0.55, 0.55, 0.2, 0.0),
    "warm": (0.1, 0.6, 0.7, 0.2, 0.3, 0.0, 0.15),
    "build": (0.4, 0.7, 0.3, 0.8, 0.5, 0.55, 0.3),
    "epic": (0.5, 0.85, 0.2, 1.0, 0.4, 1.0, 0.8),
    "emotional": (0.3, 0.8, 0.8, 0.2, 0.0, 0.2, 0.5),
    "finale": (0.6, 1.0, 0.5, 1.0, 0.3, 1.0, 1.0),
}


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def render(moods, total, sr):
    n = int(total * sr) + sr
    t = np.arange(n) / sr

    # --- courbes de volume par couche (lissées)
    gains = np.zeros((7, n), dtype=np.float32)
    pure_marks = []
    for (s, e, mood, inten) in moods:
        i, j = int(s * sr), min(n, int(e * sr))
        g = np.array(MOODS.get(mood, MOODS["steady"])) * (0.55 + 0.45 * inten)
        gains[:, i:j] = g[:, None]
        if mood == "pure":
            pure_marks.append((s, e))
    k = int(1.5 * sr)
    ker = np.ones(k, dtype=np.float32) / k
    for li in range(7):
        c = np.cumsum(np.insert(gains[li].astype(np.float64), 0, 0))
        sm = (c[k:] - c[:-k]) / k
        gains[li, k // 2: k // 2 + len(sm)] = sm
    drone_g, pad_g, piano_g, ost_g, beat_g, drum_g, choir_g = gains

    out = np.zeros(n, dtype=np.float32)

    # --- bourdon grave (ré + la), légèrement mouvant
    drone = 0.5 * np.sin(2 * np.pi * hz(26) * t) + 0.3 * np.sin(2 * np.pi * hz(33) * t + 0.4 * np.sin(2 * np.pi * 0.07 * t))
    out += (0.18 * drone * drone_g).astype(np.float32)

    # --- nappe de cordes + chœur, accord par accord
    seg_n = int((CH_LEN + 2.0) * sr)
    ts = np.arange(seg_n) / sr
    env = np.minimum(1, ts / 1.4) * np.clip((CH_LEN + 2.0 - ts) / 2.0, 0, 1)
    ci = 0
    for start in np.arange(-1.0, total, CH_LEN):
        bass, notes = CHORDS[ci % 4]
        ci += 1
        i = int(max(0, start) * sr)
        off = int(max(0, -start) * sr)
        j = min(n, i + seg_n - off)
        if j <= i:
            continue
        sl = slice(off, off + (j - i))
        pad = np.zeros(seg_n, dtype=np.float32)
        choir = np.zeros(seg_n, dtype=np.float32)
        for m in notes:
            f = hz(m)
            vib = 0.003 * np.sin(2 * np.pi * 5.2 * ts + m)
            for h, a in ((1, 1.0), (2, 0.45), (3, 0.25), (4, 0.12), (5, 0.06)):
                pad += (a / len(notes)) * np.sin(2 * np.pi * f * h * ts * (1 + vib) + h * m).astype(np.float32)
            fc = hz(m + 12)
            choir += (0.5 / len(notes)) * (np.sin(2 * np.pi * fc * ts * (1 + 0.006 * np.sin(2 * np.pi * 4.6 * ts)))
                                           + 0.3 * np.sin(2 * np.pi * 2 * fc * ts)).astype(np.float32)
        bassw = 0.6 * np.sin(2 * np.pi * hz(bass) * ts) + 0.2 * np.sin(2 * np.pi * hz(bass) * 2 * ts)
        out[i:j] += (0.16 * (pad * env)[sl] * pad_g[i:j]).astype(np.float32)
        out[i:j] += (0.12 * (bassw * env)[sl] * np.maximum(pad_g[i:j], drone_g[i:j])).astype(np.float32)
        out[i:j] += (0.10 * (choir * env)[sl] * choir_g[i:j]).astype(np.float32)

    # --- piano (arpèges en croches), ostinato (doubles croches), percussions, beat
    nk = int(1.8 * sr)
    tk = np.arange(nk) / sr
    step = BEAT / 2
    pattern = [0, 1, 2, 3, 2, 1, 3, 2]
    kick = np.sin(2 * np.pi * (45 * tk + 50 * (1 - np.exp(-tk * 30)) / 30)) * np.exp(-tk * 8)
    taiko = np.sin(2 * np.pi * (60 * tk + 80 * (1 - np.exp(-tk * 18)) / 18)) * np.exp(-tk * 4.5)
    rng = np.random.default_rng(3)
    hat_n = rng.standard_normal(int(0.06 * sr))
    hat = np.diff(hat_n, prepend=0) * np.exp(-np.arange(len(hat_n)) / sr * 70)

    def put(x, at, g):
        i = int(at * sr)
        if i >= n or g <= 1e-4:
            return
        j = min(n, i + len(x))
        out[i:j] += (x[: j - i] * g).astype(np.float32)

    b = 0
    for at in np.arange(0, total, step):
        ch = CHORDS[int(at // CH_LEN) % 4]
        idx = int(at * sr)
        if idx >= n:
            break
        pg, og, dg, bg = piano_g[idx], ost_g[idx], drum_g[idx], beat_g[idx]
        if pg > 0.01:
            m = ch[1][pattern[b % 8]] + 12
            f = hz(m)
            note = (np.sin(2 * np.pi * f * tk) + 0.35 * np.sin(2 * np.pi * 2 * f * tk) + 0.12 * np.sin(2 * np.pi * 3 * f * tk)) * np.exp(-tk * 2.6)
            put(note * np.minimum(1, tk / 0.004), at, 0.07 * pg * (1 if b % 2 == 0 else 0.7))
        if og > 0.01:
            for sub in (0, step / 2):
                f = hz(ch[0] + 12)
                ln = int(0.16 * sr)
                tt = tk[:ln]
                st = (np.sign(np.sin(2 * np.pi * f * tt)) * 0.3 + np.sin(2 * np.pi * f * tt)) * np.exp(-tt * 14)
                put(st, at + sub, 0.05 * og)
        if bg > 0.01:
            if b % 4 == 0:
                put(kick, at, 0.22 * bg)
            if b % 2 == 1:
                put(hat, at, 0.05 * bg)
        if dg > 0.01:
            beat_in_bar = b % 8
            if beat_in_bar in (0, 3, 4):
                put(taiko, at, 0.28 * dg * (1.0 if beat_in_bar == 0 else 0.6))
            if b % 32 == 30:
                for r in range(4):
                    put(taiko, at + r * step / 2, 0.15 * dg)
        b += 1

    # --- note pure (l'instant « ماذا لو… ؟ »)
    for s, e in pure_marks:
        i, j = int(s * sr), min(n, int(e * sr))
        tt = t[i:j] - s
        out[i:j] += (0.12 * np.sin(2 * np.pi * hz(81) * tt) * np.minimum(1, tt / 0.8) * np.clip((e - s - tt) / 1.5, 0, 1)).astype(np.float32)

    # stéréo légère, fondu d'entrée/sortie
    fade = np.minimum(1, t / 2.0) * np.clip((total - t) / 4.0, 0, 1)
    out *= fade.astype(np.float32)
    peak = np.max(np.abs(out)) + 1e-9
    out = out / peak * 0.8
    L = out
    R = np.roll(out, int(0.012 * sr))
    return np.stack([L, R], axis=1)

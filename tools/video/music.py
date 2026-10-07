"""Musique de fond (libre de droits, générée ici) pour la vidéo de bienvenue du Wasset 777.

Usage : python3 tools/video/music.py [durée_en_secondes]  → tools/video/music.wav
Nappe douce + arpège + basse + percussions légères, 84 BPM, La mineur (Am – F – C – G).
"""
import sys
import wave
from pathlib import Path

import numpy as np

SR = 44100
DUR = float(sys.argv[1]) if len(sys.argv) > 1 else 220.0
BPM = 84
BEAT = 60 / BPM
BAR = 4 * BEAT
N = int(DUR * SR)
rng = np.random.default_rng(777)

L = np.zeros(N)
R = np.zeros(N)


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


# Accords (notes MIDI), deux mesures chacun.
CHORDS = [
    [57, 60, 64, 71],  # Am(add9)
    [53, 57, 60, 64],  # Fmaj7
    [48, 55, 60, 64],  # C
    [55, 59, 62, 67],  # G
]
CHORD_LEN = 2 * BAR


def add(buf, start, sig):
    i = int(start * SR)
    if i < 0:  # début avant 0 : on coupe le début du signal
        sig, i = sig[-i:], 0
    if i >= N:
        return
    j = min(N, i + len(sig))
    buf[i:j] += sig[: j - i]


# --- Nappe : sinus désaccordés, fondu en cosinus entre les accords
t_chord = np.arange(int((CHORD_LEN + 2.0) * SR)) / SR
env = np.minimum(1, t_chord / 1.2) * np.clip((CHORD_LEN + 2.0 - t_chord) / 2.0, 0, 1)
k = 0
start = 0.0
while start < DUR:
    notes = CHORDS[k % len(CHORDS)]
    for n, m in enumerate(notes):
        f = hz(m)
        sigL = sum(np.sin(2 * np.pi * f * d * t_chord + n) for d in (0.997, 1.0)) + 0.25 * np.sin(2 * np.pi * 2 * f * t_chord)
        sigR = sum(np.sin(2 * np.pi * f * d * t_chord + n * 1.7) for d in (1.0, 1.003)) + 0.25 * np.sin(2 * np.pi * 2 * f * t_chord + 1)
        add(L, start - 1.0, 0.035 * env * sigL)
        add(R, start - 1.0, 0.035 * env * sigR)
    start += CHORD_LEN
    k += 1

# --- Arpège en croches (entre après l'intro)
step = BEAT / 2
t_note = np.arange(int(1.6 * SR)) / SR
pattern = [0, 1, 2, 3, 2, 1, 3, 2]
i = 0
t0 = 4 * BEAT
while t0 < DUR:
    chord = CHORDS[int(t0 // CHORD_LEN) % len(CHORDS)]
    m = chord[pattern[i % len(pattern)]] + 12
    f = hz(m)
    note = (np.sin(2 * np.pi * f * t_note) + 0.3 * np.sin(2 * np.pi * 2 * f * t_note)) * np.exp(-t_note * 3.5)
    note *= np.minimum(1, t_note / 0.005)
    vel = 0.05 * (1.0 if i % 2 == 0 else 0.7)
    pan = 0.5 + 0.3 * np.sin(i * 0.7)
    add(L, t0, vel * (1 - pan) * 2 * note)
    add(R, t0, vel * pan * 2 * note)
    # écho
    add(L, t0 + 0.375 * BEAT * 2, 0.35 * vel * pan * 2 * note)
    add(R, t0 + 0.375 * BEAT * 3, 0.35 * vel * (1 - pan) * 2 * note)
    t0 += step
    i += 1

# --- Basse (noires) à partir de la 3e mesure
t_b = np.arange(int(BEAT * SR)) / SR
t0 = 2 * BAR
while t0 < DUR:
    root = CHORDS[int(t0 // CHORD_LEN) % len(CHORDS)][0] - 12
    f = hz(root)
    b = np.sin(2 * np.pi * f * t_b) * np.exp(-t_b * 2.2) * np.minimum(1, t_b / 0.01)
    add(L, t0, 0.09 * b)
    add(R, t0, 0.09 * b)
    t0 += BEAT

# --- Percussions légères (grosse caisse douce + charleston) à partir de la 5e mesure
t_k = np.arange(int(0.35 * SR)) / SR
kick = np.sin(2 * np.pi * (45 * t_k + 60 * (1 - np.exp(-t_k * 25)) / 25)) * np.exp(-t_k * 9)
noise = rng.standard_normal(int(0.08 * SR))
hat = np.diff(noise, prepend=0) * np.exp(-np.arange(len(noise)) / SR * 60)
beat = 0
t0 = 4 * BAR
while t0 < DUR - 2 * BAR:
    if beat % 4 in (0, 2):
        add(L, t0, 0.11 * kick)
        add(R, t0, 0.11 * kick)
    add(L, t0 + BEAT / 2, 0.012 * hat)
    add(R, t0 + BEAT / 2, 0.016 * hat)
    t0 += BEAT
    beat += 1

# --- Mixage final : fondu d'entrée/sortie, normalisation
t = np.arange(N) / SR
fade = np.minimum(1, t / 2.5) * np.clip((DUR - t) / 4.0, 0, 1)
mix = np.stack([L, R], axis=1) * fade[:, None]
mix /= np.max(np.abs(mix)) + 1e-9
mix *= 0.8
pcm = (mix * 32767).astype(np.int16)

out = Path(__file__).with_name("music.wav")
with wave.open(str(out), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print(f"{out} ({DUR:.0f} s)")

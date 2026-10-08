"""Voix off hors ligne (sherpa-onnx + voix Piper), avec cache. Arabe, français, anglais.

Deux voix par langue :
  - narrateur (« التعليق الصوتي » dramatique), voix d'homme : ar_JO-kareem-medium, fr_FR-tom-medium, en_US-john-medium
  - guide (étapes « خطوة بخطوة » et « نصيحة احترافية »), voix de femme : ar_JO-SA_dii-high, fr_FR-siwis-medium, en_US-ljspeech-high
  (nom de voix : "narrator" / "guide" pour l'arabe, "narrator_fr", "guide_en"…)

Le texte arabe doit être entièrement vocalisé (تشكيل) pour une bonne prononciation ;
en français et en anglais, nombres et sigles écrits en toutes lettres.
Les « … » et les fins de phrase deviennent des silences (pauses dramatiques).
Modèles : https://github.com/k2-fsa/sherpa-onnx/releases/tag/tts-models
(dossier passé par la variable d'environnement TTS_MODELS).
"""
import hashlib
import os
import re
from pathlib import Path

import numpy as np
import soundfile as sf

SR = 22050
VOICES = {
    "narrator": {"dir": "vits-piper-ar_JO-kareem-medium", "speed": 1.0},
    "guide": {"dir": "vits-piper-ar_JO-SA_dii-high", "speed": 1.1},
    "narrator_fr": {"dir": "vits-piper-fr_FR-tom-medium", "speed": 1.0, "lang": "fr"},
    "guide_fr": {"dir": "vits-piper-fr_FR-siwis-medium", "speed": 1.05, "lang": "fr"},
    "narrator_en": {"dir": "vits-piper-en_US-john-medium", "speed": 1.0, "lang": "en"},
    "guide_en": {"dir": "vits-piper-en_US-ljspeech-high", "speed": 1.0, "lang": "en"},
}
PAUSE = {"…": 0.5, ".": 0.32, "؟": 0.38, "?": 0.38, "!": 0.32, "،": 0.12, ":": 0.18, "—": 0.15}

_engines = {}


def _engine(voice):
    if voice not in _engines:
        import sherpa_onnx

        base = Path(os.environ.get("TTS_MODELS", "tts-models")) / VOICES[voice]["dir"]
        onnx = next(p for p in base.iterdir() if p.suffix == ".onnx")
        cfg = sherpa_onnx.OfflineTtsConfig(
            model=sherpa_onnx.OfflineTtsModelConfig(
                vits=sherpa_onnx.OfflineTtsVitsModelConfig(
                    model=str(onnx), tokens=str(base / "tokens.txt"), data_dir=str(base / "espeak-ng-data")
                ),
                num_threads=4,
            )
        )
        _engines[voice] = sherpa_onnx.OfflineTts(cfg)
    return _engines[voice]


def split_pauses(text, latin=False):
    """Découpe en morceaux (texte, pause_après) sur … . ؟ ! ، : — (français/anglais : … . ? ! : —,
    la ponctuation finale reste dans le morceau pour l'intonation, les virgules sont laissées à la voix)."""
    if latin:
        text = re.sub(r"[«»“”\"]", "", text)
        parts = re.split(r"(…|\.(?=\s|$)|\?|!|:|—)", text)
    else:
        parts = re.split(r"(…|\.|؟|!|،|:|—)", text)
    out = []
    for i in range(0, len(parts), 2):
        chunk = parts[i].strip(" «»\"\n")
        sep = parts[i + 1] if i + 1 < len(parts) else ""
        if latin and chunk and sep in (".", "?", "!"):
            chunk += sep
        elif latin and chunk and sep:  # … : — : intonation suspendue
            chunk += ","
        if chunk:
            out.append((chunk, PAUSE.get(sep, 0.3)))
        elif out and sep:
            out[-1] = (out[-1][0], max(out[-1][1], PAUSE.get(sep, 0.3)))
    return out


def _resample(x, sr):
    """Ramène la voix à SR (fr_FR-tom est en 44,1 kHz)."""
    if sr == SR or not len(x):
        return x
    if sr % SR == 0:  # facteur entier : moyenne par blocs (filtre anti-repliement simple)
        k = sr // SR
        return x[: len(x) // k * k].reshape(-1, k).mean(axis=1).astype(np.float32)
    n = int(len(x) * SR / sr)
    return np.interp(np.linspace(0, len(x) - 1, n), np.arange(len(x)), x).astype(np.float32)


def synth(text, voice, cache_dir):
    """Renvoie un tableau float32 (SR=22050) pour le texte vocalisé, avec pauses."""
    cache_dir = Path(cache_dir)
    cache_dir.mkdir(parents=True, exist_ok=True)
    key = hashlib.sha1(f"{voice}|{VOICES[voice]}|{text}".encode()).hexdigest()[:16]
    path = cache_dir / f"{voice}-{key}.wav"
    if path.exists():
        return sf.read(path, dtype="float32")[0]
    eng = _engine(voice)
    pieces = []
    for chunk, pause in split_pauses(text, latin="lang" in VOICES[voice]):
        a = eng.generate(chunk, sid=VOICES[voice].get("sid", 0), speed=VOICES[voice]["speed"])
        x = _resample(np.asarray(a.samples, dtype=np.float32), a.sample_rate)
        # retire les silences de bord pour maîtriser le rythme
        nz = np.flatnonzero(np.abs(x) > 0.01)
        if len(nz):
            x = x[max(0, nz[0] - 200): nz[-1] + 400]
        pieces += [x, np.zeros(int(SR * pause), dtype=np.float32)]
    y = np.concatenate(pieces) if pieces else np.zeros(1, dtype=np.float32)
    sf.write(path, y, SR)
    return y

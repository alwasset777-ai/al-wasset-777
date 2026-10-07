"""Voix off arabe hors ligne (sherpa-onnx + voix Piper), avec cache.

Deux voix :
  - narrateur (« التعليق الصوتي » dramatique) : ar_JO-kareem-medium (voix d'homme)
  - guide (étapes « خطوة بخطوة » et « نصيحة احترافية ») : ar_JO-SA_dii-high (voix de femme)

Le texte doit être entièrement vocalisé (تشكيل) pour une bonne prononciation.
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
}
PAUSE = {"…": 0.5, ".": 0.32, "؟": 0.38, "!": 0.32, "،": 0.12, ":": 0.18, "—": 0.15}

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


def split_pauses(text):
    """Découpe en morceaux (texte, pause_après) sur … . ؟ ! ، : —"""
    parts = re.split(r"(…|\.|؟|!|،|:|—)", text)
    out = []
    for i in range(0, len(parts), 2):
        chunk = parts[i].strip(" «»\"\n")
        sep = parts[i + 1] if i + 1 < len(parts) else ""
        if chunk:
            out.append((chunk, PAUSE.get(sep, 0.3)))
        elif out and sep:
            out[-1] = (out[-1][0], max(out[-1][1], PAUSE.get(sep, 0.3)))
    return out


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
    for chunk, pause in split_pauses(text):
        a = eng.generate(chunk, sid=0, speed=VOICES[voice]["speed"])
        x = np.asarray(a.samples, dtype=np.float32)
        # retire les silences de bord pour maîtriser le rythme
        nz = np.flatnonzero(np.abs(x) > 0.01)
        if len(nz):
            x = x[max(0, nz[0] - 200): nz[-1] + 400]
        pieces += [x, np.zeros(int(SR * pause), dtype=np.float32)]
    y = np.concatenate(pieces) if pieces else np.zeros(1, dtype=np.float32)
    sf.write(path, y, SR)
    return y

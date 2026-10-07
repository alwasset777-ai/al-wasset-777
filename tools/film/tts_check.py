"""Vérifie la prononciation de la voix off : synthèse puis retranscription (Whisper), score de similarité.

Usage : python3 tts_check.py fichier.json
  fichier.json = [{"id": "...", "voice": "narrator|guide", "tts": "نص مشكول", "ref": "النص المعروض"}, ...]
Affiche pour chaque élément : score (0–100), ce que Whisper a entendu.
Un score < 80 signale en général un mot mal vocalisé ou un chiffre / mot latin non écrit en lettres.
"""
import difflib
import json
import os
import re
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from tts import SR, synth  # noqa: E402

HARAKAT = re.compile(r"[ً-ْٰـ]")


def norm(s):
    s = HARAKAT.sub("", s)
    s = re.sub(r"[إأآٱ]", "ا", s)
    s = s.replace("ى", "ي").replace("ة", "ه").replace("ؤ", "و").replace("ئ", "ي")
    s = re.sub(r"[^ء-ي0-9a-zA-Z ]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


_rec = None


def recognizer():
    global _rec
    if _rec is None:
        import sherpa_onnx

        d = Path(os.environ.get("ASR_MODEL", "sherpa-onnx-whisper-small"))
        _rec = sherpa_onnx.OfflineRecognizer.from_whisper(
            encoder=str(d / "small-encoder.int8.onnx"), decoder=str(d / "small-decoder.int8.onnx"),
            tokens=str(d / "small-tokens.txt"), language="ar", task="transcribe", num_threads=4,
        )
    return _rec


def check(item, cache):
    audio = synth(item["tts"], item.get("voice", "narrator"), cache)
    st = recognizer().create_stream()
    st.accept_waveform(SR, np.asarray(audio, dtype=np.float32))
    recognizer().decode_stream(st)
    heard = st.result.text
    ref = norm(item.get("ref") or item["tts"])
    score = round(100 * difflib.SequenceMatcher(None, ref, norm(heard)).ratio())
    return {"id": item.get("id"), "score": score, "heard": heard, "seconds": round(len(audio) / SR, 2)}


if __name__ == "__main__":
    items = json.load(open(sys.argv[1], encoding="utf-8"))
    cache = os.environ.get("TTS_CACHE", str(Path(__file__).parent / ".cache" / "tts"))
    for it in items:
        print(json.dumps(check(it, cache), ensure_ascii=False), flush=True)

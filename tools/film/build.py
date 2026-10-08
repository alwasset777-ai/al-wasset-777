"""Prépare le film : voix off (TTS), minutage de chaque scène, effets sonores, musique, mixage.

Entrée  : content.json (le scénario du PDF, scène par scène, avec le texte vocalisé pour la voix off)
          content.fr.json / content.en.json : versions française et anglaise (même structure, "lang" et "ui")
Sorties : build/timeline.js (lu par film.html), build/film-audio.m4a (bande son complète)

Usage : python3 build.py [--only ID,ID,...]   (--only : version courte avec ces segments seulement)
        python3 build.py --content content.fr.json --name fr   → build/timeline-fr.js, build/fr-audio.m4a
Variables : TTS_MODELS (dossier des voix sherpa-onnx), TTS_CACHE (cache des voix générées)
"""
import argparse
import json
import os
import subprocess
from pathlib import Path

import numpy as np
import soundfile as sf

import score
import sfx
from tts import SR as TTS_SR, synth

HERE = Path(__file__).parent
OUT = HERE / "build"
SR = 44100
GAP = 1.2  # respiration musicale entre deux scènes (le PDF demande 1 à 2 s)


def upsample(x):
    n = int(len(x) * SR / TTS_SR)
    return np.interp(np.linspace(0, len(x) - 1, n), np.arange(len(x)), x).astype(np.float32)


class Track:
    def __init__(self):
        self.clips = []  # (t, samples)

    def add(self, t, x):
        self.clips.append((t, x))

    def render(self, total):
        buf = np.zeros(int(total * SR) + SR, dtype=np.float32)
        for t, x in self.clips:
            i = int(t * SR)
            j = min(len(buf), i + len(x))
            buf[i:j] += x[: j - i]
        return buf


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="")
    ap.add_argument("--name", default="film")
    ap.add_argument("--content", default=str(HERE / "content.json"))
    ap.add_argument("--short", action="store_true", help="version courte : voix off seulement, sans étapes ni astuces")
    args = ap.parse_args()

    content = json.load(open(args.content, encoding="utf-8"))
    segs = content["segments"]
    lang = content.get("lang", "ar")
    voices = {v: v if lang == "ar" else f"{v}_{lang}" for v in ("narrator", "guide")}
    if args.only:
        keep = args.only.split(",")
        segs = [s for s in segs if s["id"] in keep]
    cache = os.environ.get("TTS_CACHE", str(HERE / ".cache" / "tts"))

    def say(text_tts, voice):
        return upsample(synth(text_tts, voices[voice], cache))

    narr, guide = Track(), Track()
    fx_events = []  # (t, name, params)
    moods = []  # (start, end, mood, intensity)
    out_segs = []
    t = 0.0

    def speak(track, lines, t0, voice, gap=0.25):
        """Place des phrases à la suite ; renvoie [{s,e,text}] (temps relatifs) et la fin."""
        res, cur = [], t0
        for ln in lines:
            a = say(ln["tts"], voice)
            track.add(t + cur, a)
            dur = len(a) / SR
            res.append({"s": round(cur, 3), "e": round(cur + dur, 3), "text": ln["text"]})
            cur += dur + gap
        return res, cur

    for seg in segs:
        k = seg["kind"]
        o = {k2: v for k2, v in seg.items() if k2 not in ("narr", "steps", "tip", "sfx", "music", "feats", "stats", "intro", "camera", "page")}
        o["kind"] = "opening" if k == "opening" else k

        if k == "opening":
            if seg.get("photo"):
                lines, end = speak(narr, seg["narr"], 1.4, "narrator", 0.3)
                o["narr"], o["screenAt"] = lines, round(end + 0.2, 2)
                dur = end + 3.2
            else:  # « l'instant » : noir 2 s, lumière, étincelles, 777
                lines, end = speak(narr, seg["narr"], 1.0, "narrator", 0.35)
                o["narr"], o["screenAt"] = lines, round(max(end + 0.2, 6.8), 2)
                dur = max(end, 6.8) + 3.0
        elif k == "title":
            lines, end = speak(narr, seg["narr"], 1.2, "narrator", 0.35)
            o["narr"] = lines
            dur = max(end + 1.8, 6.5)
        elif k == "why":
            cur = 0.8
            intro_a = say(seg["intro"]["tts"], "guide")
            guide.add(t + cur, intro_a)
            o["intro"] = seg["intro"]["text"]
            cur += len(intro_a) / SR + 0.4
            o["stats"] = []
            for st in seg["stats"]:
                a = say(st["tts"], "guide")
                guide.add(t + cur, a)
                fx_events.append((t + cur, "pop", {}))
                o["stats"].append({"num": st["num"], "label": st["label"], "extra": st.get("extra", ""), "at": round(cur, 2)})
                cur += len(a) / SR + 0.35
            cur += 0.8
            o["featAt"] = round(cur, 2)
            o["feats"] = []
            for i, f in enumerate(seg["feats"]):
                a = say(f["tts"], "guide")
                guide.add(t + cur + 0.25, a)
                o["feats"].append({"icon": f["icon"], "title": f["title"], "text": f["text"], "at": round(cur, 2)})
                cur += len(a) / SR + 0.6
                if i % 3 == 2 or i == len(seg["feats"]) - 1:  # page de 3 cartes
                    for ff in o["feats"][-(i % 3 + 1):]:
                        ff["out"] = round(cur + 0.4, 2)
                    cur += 0.6
            o["narr"] = []
            dur = cur + 0.8
        elif k == "part":
            lines, end = speak(narr, seg["narr"], 1.2, "narrator", 0.3)
            o["narr"] = lines
            dur = max(end + 1.6, 3.2 + 0.18 * len(seg["list"]))
            fx_events.append((t + 0.2, "boom", {"gain": 0.8}))
        elif k == "scene" and args.short:
            lines, end = speak(narr, seg["narr"], 1.0, "narrator", 0.3)
            o["narr"], o["screenAt"], o["stepsAt"], o["steps"], o["tip"] = lines, 1.6, 9999, [], None
            dur = end + 1.6
        elif k == "scene":
            lines, end = speak(narr, seg["narr"], 1.0, "narrator", 0.3)
            o["narr"] = lines
            o["screenAt"] = 1.6
            cur = end + 0.5
            o["stepsAt"] = round(cur, 2)
            fx_events.append((t + cur, "chime", {}))
            cur += 0.8
            o["steps"] = []
            for st in seg["steps"]:
                a = say(st["tts"], "guide")
                guide.add(t + cur + 0.25, a)
                e = cur + 0.25 + len(a) / SR + 0.35
                o["steps"].append({"s": round(cur, 2), "e": round(e, 2), "text": st["text"]})
                cur = e + 0.2
            if len(seg.get("imgs", [])) == 2 and o["steps"]:
                o["swapAt"] = o["steps"][len(o["steps"]) // 2]["s"] - 0.3
            if seg.get("tip"):
                a = say(seg["tip"]["tts"], "guide")
                guide.add(t + cur + 0.5, a)
                e = cur + 0.5 + len(a) / SR + 0.6
                o["tip"] = {"s": round(cur, 2), "e": round(e, 2), "text": seg["tip"]["text"]}
                fx_events.append((t + cur, "ding", {"gain": 0.35}))
                cur = e
            else:
                o["tip"] = None
            dur = cur + 0.8
        elif k == "closing":
            lines, cur = [], 1.0
            marks = {}
            for ln in seg["narr"]:
                if ln.get("phase") and ln["phase"] not in marks:
                    marks[ln["phase"]] = cur
                    if ln["phase"] == "end":
                        cur += 1.4  # le noir s'installe, puis le logo
                        marks["end"] = cur - 1.2
                a = say(ln["tts"], "narrator")
                narr.add(t + cur, a)
                lines.append({"s": round(cur, 3), "e": round(cur + len(a) / SR, 3), "text": ln["text"]})
                cur += len(a) / SR + 0.35
            o["narr"] = lines
            o["flashAt"] = round(marks["flash"], 2)
            o["checksAt"] = round(marks["checks"], 2)
            o["flashEnd"] = round(marks["checks"] - 0.2, 2)
            o["flashStep"] = round(max(0.35, (o["flashEnd"] - o["flashAt"]) / max(1, len(seg["montage"]))), 3)
            o["ctaAt"] = round(marks["cta"], 2)
            o["endAt"] = round(marks["end"], 2)
            for i in range(len(seg["montage"])):
                fx_events.append((t + o["flashAt"] + i * o["flashStep"], "shutter", {"gain": 0.5}))
            fx_events.append((t + o["endAt"] + 0.4, "boom", {"gain": 1.0}))
            dur = cur + 5.0  # le logo et le numéro restent 5 secondes
        else:
            raise ValueError(k)

        for ev in seg.get("sfx", []):
            fx_events.append((t + ev.get("at", 0.5), ev["name"], ev))
        m = seg.get("music", {"mood": "steady", "intensity": 0.5})
        moods.append((t, t + dur, m["mood"], m.get("intensity", 0.5)))
        o["start"], o["dur"] = round(t, 3), round(dur, 3)
        out_segs.append(o)
        t += dur + (GAP if k in ("scene", "part", "why", "title") else 0.4)

    total = round(t + 1.0, 3)
    OUT.mkdir(exist_ok=True)
    film = {"total": total, "lang": lang, "ui": content.get("ui", {}), "segs": out_segs}
    (OUT / f"{args.name == 'film' and 'timeline' or 'timeline-' + args.name}.js").write_text(
        "window.FILM = " + json.dumps(film, ensure_ascii=False) + ";\n", encoding="utf-8")

    # --- bande son
    stems = OUT / "stems"
    stems.mkdir(exist_ok=True)
    sf.write(stems / "narr.wav", narr.render(total), SR, subtype="FLOAT")
    sf.write(stems / "guide.wav", guide.render(total), SR, subtype="FLOAT")
    sf.write(stems / "sfx.wav", sfx.render(fx_events, total, SR), SR, subtype="FLOAT")
    sf.write(stems / "music.wav", score.render(moods, total, SR), SR, subtype="FLOAT")
    audio = OUT / f"{args.name}-audio.m4a"
    fc = (
        "[0]aformat=channel_layouts=stereo,equalizer=f=140:t=q:w=1:g=3,aecho=0.8:0.6:45|80:0.12|0.07,volume=1.25[n];"
        "[1]aformat=channel_layouts=stereo,equalizer=f=3000:t=q:w=1:g=2,volume=1.1[g];"
        "[n][g]amix=inputs=2:normalize=0[v];[v]asplit=2[v1][v2];"
        "[3]aformat=channel_layouts=stereo,volume=0.55[m];"
        "[m][v1]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=600[md];"
        "[2]aformat=channel_layouts=stereo,volume=0.8[s];"
        "[v2][md][s]amix=inputs=3:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11[out]"
    )
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", stems / "narr.wav", "-i", stems / "guide.wav", "-i", stems / "sfx.wav",
                    "-i", stems / "music.wav", "-filter_complex", fc, "-map", "[out]", "-ar", "44100", "-c:a", "aac", "-b:a", "128k", audio], check=True)
    print(f"{len(out_segs)} segments, durée {total:.1f} s → {OUT / ('timeline' if args.name == 'film' else 'timeline-' + args.name)}.js, {audio}")


if __name__ == "__main__":
    main()

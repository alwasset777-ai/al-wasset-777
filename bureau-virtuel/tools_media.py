"""Outils de l'Agent Créatif : vidéo verticale (Reels / TikTok / Stories) à partir des
photos d'un bien, avec FFmpeg (gratuit). Aucune carte graphique nécessaire."""
import datetime as dt
import shutil
import subprocess
import tempfile
from pathlib import Path

import requests

import config

IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp"}


def ffmpeg_bin() -> str | None:
    """FFmpeg de l'ordinateur, sinon celui installé automatiquement avec le bureau (imageio-ffmpeg, gratuit)."""
    found = shutil.which("ffmpeg")
    if found:
        return found
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return None


def ffmpeg_ok() -> bool:
    return ffmpeg_bin() is not None


def collect_images(sources: list[str], workdir: Path, max_images: int = 10) -> list[Path]:
    """Accepte des dossiers, des fichiers ou des liens (photos Firebase du registre)."""
    out: list[Path] = []
    for src in sources:
        if len(out) >= max_images:
            break
        if src.startswith(("http://", "https://")):
            try:
                r = requests.get(src, timeout=60)
                r.raise_for_status()
                p = workdir / f"img{len(out):02d}.jpg"
                p.write_bytes(r.content)
                out.append(p)
            except requests.RequestException:
                continue
        else:
            p = Path(src).expanduser()
            if p.is_dir():
                out += sorted(x for x in p.iterdir() if x.suffix.lower() in IMAGE_EXT)[: max_images - len(out)]
            elif p.suffix.lower() in IMAGE_EXT and p.exists():
                out.append(p)
    return out[:max_images]


def slideshow(images: list[Path], name: str, seconds: float = 3.0, size=(1080, 1920)) -> Path:
    """Diaporama vertical avec léger zoom sur chaque photo, sans son (ajoutez votre musique libre de droits)."""
    if not ffmpeg_ok():
        raise RuntimeError("FFmpeg n'est pas installé (voir le guide)")
    if not images:
        raise ValueError("Aucune photo trouvée")
    w, h = size
    fps = 30
    frames = int(seconds * fps)
    config.MEDIA_DIR.mkdir(parents=True, exist_ok=True)
    safe = "".join(c if c.isalnum() or c in "-_" else "_" for c in name)[:60] or "video"
    out = config.MEDIA_DIR / f"{dt.datetime.now().strftime('%Y%m%d_%H%M%S')}_{safe}.mp4"
    cmd = [ffmpeg_bin(), "-y", "-loglevel", "error"]
    for img in images:
        cmd += ["-loop", "1", "-t", str(seconds), "-i", str(img)]
    parts = []
    for i in range(len(images)):
        parts.append(
            f"[{i}:v]scale={w * 2}:{h * 2}:force_original_aspect_ratio=increase,crop={w * 2}:{h * 2},"
            f"zoompan=z='min(zoom+0.0008,1.12)':d={frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={w}x{h}:fps={fps},"
            f"trim=duration={seconds},setpts=PTS-STARTPTS,format=yuv420p[v{i}]")
    concat = "".join(f"[v{i}]" for i in range(len(images))) + f"concat=n={len(images)}:v=1:a=0[out]"
    cmd += ["-filter_complex", ";".join(parts + [concat]), "-map", "[out]",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-movflags", "+faststart", str(out)]
    subprocess.run(cmd, check=True, timeout=600)
    return out


def slideshow_from_sources(sources: list[str], name: str) -> Path:
    with tempfile.TemporaryDirectory() as tmp:
        return slideshow(collect_images(sources, Path(tmp)), name)

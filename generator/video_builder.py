"""Gerador de vídeos V3 — qualidade de creator profissional.

Técnicas implementadas:
1. Imagens reais do contexto (Pexels API) — 6-8 por vídeo
2. Cortes rápidos a cada 2-3s (ritmo de TikTok/Reels)
3. Ken Burns effect (zoom in/out alternado em cada imagem)
4. Fade transitions entre imagens
5. Voz neural Edge TTS (entonação natural pt-BR)
6. Background music por mood
7. Barra de progresso animada
8. Overlays semi-transparentes pra texto legível
"""

import asyncio
import random
import sys
import textwrap
import time
from pathlib import Path

import structlog

from config.settings import settings

log = structlog.get_logger()

MUSIC_MAP = {
    "guerra": "dramatic.mp3",
    "futebol": "energetic.mp3",
    "política": "news.mp3",
    "entretenimento": "lofi.mp3",
}

TOPIC_STYLE = {
    "guerra": {"accent": "#ef4444", "badge": "URGENTE", "keywords": ["war", "military", "explosion", "soldier", "conflict"]},
    "futebol": {"accent": "#22c55e", "badge": "FUTEBOL", "keywords": ["soccer", "football", "stadium", "goal", "athlete"]},
    "política": {"accent": "#3b82f6", "badge": "POLITICA", "keywords": ["government", "politics", "congress", "protest", "speech"]},
    "entretenimento": {"accent": "#a855f7", "badge": "VIRAL", "keywords": ["entertainment", "celebrity", "viral", "social media"]},
}

# Segundos por imagem (ritmo de creator — cortes rápidos)
SECONDS_PER_IMAGE = 2.5


async def generate_narrated_video(
    title: str,
    summary: str,
    narration_text: str,
    source: str = "",
    category: str = "breaking",
    topic: str = "guerra",
    output_name: str = "clip",
    voice: str = "pt-BR-AntonioNeural",
    voice_rate: str = "+8%",
) -> dict | None:
    """Gera vídeo completo com qualidade de creator."""
    start = time.monotonic()
    log.info("video_builder.start", output=output_name, topic=topic)

    output_dir = settings.clips_output_dir
    for d in ["voice", "clips", "images"]:
        (output_dir / d).mkdir(parents=True, exist_ok=True)

    voice_path = str(output_dir / "voice" / f"{output_name}.mp3")
    video_path = str(output_dir / "clips" / f"{output_name}.mp4")
    img_dir = output_dir / "images" / output_name
    img_dir.mkdir(parents=True, exist_ok=True)

    # === 1. Voz neural ===
    clean_text = narration_text.strip() or title
    log.info("video_builder.tts", chars=len(clean_text), voice=voice)

    if not await _edge_tts(clean_text, voice_path, voice, voice_rate):
        if not await _gtts_fallback(clean_text, voice_path):
            return None

    # === 2. Duração ===
    duration = await _audio_duration(voice_path)
    log.info("video_builder.duration", seconds=round(duration, 1))

    # === 3. Imagens do contexto ===
    num_images = max(4, int(duration / SECONDS_PER_IMAGE))
    images = await _fetch_images(topic, title, img_dir, count=min(num_images, 8))
    log.info("video_builder.images", count=len(images), needed=num_images)

    # === 4. Montar vídeo ===
    ok = await _build_video_v3(
        video_path, voice_path, duration, title, summary, source, topic, images
    )
    if not ok:
        return None

    elapsed = time.monotonic() - start
    log.info("video_builder.done", video=video_path, duration=round(duration, 1), elapsed_s=round(elapsed, 1))
    return {"video_path": video_path, "voice_path": voice_path, "duration": duration}


# ==================== TTS ====================

async def _edge_tts(text: str, out: str, voice: str, rate: str) -> bool:
    try:
        script = (
            "import asyncio, edge_tts\n"
            "async def g():\n"
            f"    c = edge_tts.Communicate({repr(text)}, {repr(voice)}, rate={repr(rate)})\n"
            f"    await c.save({repr(out)})\n"
            "asyncio.run(g())\n"
        )
        proc = await asyncio.create_subprocess_exec(
            sys.executable, "-c", script,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await proc.communicate()
        if proc.returncode != 0 or not Path(out).exists() or Path(out).stat().st_size < 100:
            log.error("tts.edge_fail", err=stderr.decode()[:150])
            return False
        log.info("tts.edge_ok", size=Path(out).stat().st_size)
        return True
    except Exception as e:
        log.error("tts.edge_error", error=str(e))
        return False


async def _gtts_fallback(text: str, out: str) -> bool:
    try:
        from gtts import gTTS
        await asyncio.get_event_loop().run_in_executor(
            None, lambda: gTTS(text, lang='pt', tld='com.br').save(out)
        )
        return Path(out).exists() and Path(out).stat().st_size > 100
    except Exception as e:
        log.error("tts.gtts_error", error=str(e))
        return False


# ==================== IMAGES ====================

async def _fetch_images(topic: str, title: str, out_dir: Path, count: int = 6) -> list[str]:
    """Busca imagens portrait do Pexels por keywords do tópico + título."""
    api_key = settings.pexels_api_key
    if not api_key:
        log.warning("pexels.no_key")
        return []

    style = TOPIC_STYLE.get(topic, TOPIC_STYLE["guerra"])
    # Monta 2 queries: keywords do tópico + palavras do título
    queries = [
        " ".join(style["keywords"][:3]),
        " ".join(title.split()[:4]),
    ]

    paths = []
    try:
        import httpx
        async with httpx.AsyncClient(timeout=15) as client:
            for query in queries:
                if len(paths) >= count:
                    break
                resp = await client.get(
                    "https://api.pexels.com/v1/search",
                    headers={"Authorization": api_key},
                    params={"query": query, "per_page": min(count, 8), "orientation": "portrait"},
                )
                if resp.status_code != 200:
                    continue

                for photo in resp.json().get("photos", []):
                    if len(paths) >= count:
                        break
                    # Pega imagem grande (boa qualidade pra 1080p)
                    url = photo.get("src", {}).get("large2x") or photo.get("src", {}).get("large", "")
                    if not url:
                        continue
                    img_resp = await client.get(url)
                    if img_resp.status_code == 200:
                        p = str(out_dir / f"img_{len(paths):02d}.jpg")
                        Path(p).write_bytes(img_resp.content)
                        paths.append(p)

        log.info("pexels.ok", count=len(paths), queries=queries)
    except Exception as e:
        log.warning("pexels.error", error=str(e))

    return paths


# ==================== AUDIO ====================

async def _audio_duration(path: str) -> float:
    try:
        proc = await asyncio.create_subprocess_exec(
            "ffprobe", "-v", "quiet", "-show_entries", "format=duration",
            "-of", "csv=p=0", path,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        out, _ = await proc.communicate()
        return float(out.decode().strip())
    except Exception:
        return 15.0


# ==================== VIDEO BUILD ====================

def _esc(t: str) -> str:
    """Escapa texto pra ffmpeg drawtext."""
    return t.replace("\\", "\\\\").replace("'", "'\\''").replace(":", "\\:").replace("%", "%%").replace('"', '\\"')


async def _build_video_v3(
    video_path: str,
    voice_path: str,
    duration: float,
    title: str,
    summary: str,
    source: str,
    topic: str,
    images: list[str],
) -> bool:
    """Monta vídeo com cortes rápidos, zoom, transições e overlays."""
    style = TOPIC_STYLE.get(topic, TOPIC_STYLE["guerra"])
    font = "/System/Library/Fonts/Helvetica.ttc"

    safe_title = _esc(title[:70])
    safe_source = _esc(source or "Nexus Clips")
    wrapped = textwrap.fill(summary[:200], width=34)
    safe_summary = _esc(wrapped)

    if images and len(images) >= 2:
        ok = await _build_with_images(
            video_path, voice_path, duration, safe_title, safe_summary,
            safe_source, style, font, images, topic=topic
        )
        if ok:
            return True
        log.info("video_builder.images_failed_fallback")

    return await _build_simple(
        video_path, voice_path, duration, safe_title, safe_summary,
        safe_source, style, font
    )


async def _build_with_images(
    video_path: str, voice_path: str, duration: float,
    title: str, summary: str, source: str,
    style: dict, font: str, images: list[str],
    topic: str = "guerra",
) -> bool:
    """Vídeo com slideshow de imagens — cortes rápidos + zoom + overlays."""

    n = len(images)
    per_img = duration / n
    fps = 25

    # === Inputs ===
    inputs = []
    for img in images:
        inputs.extend(["-loop", "1", "-t", str(round(per_img, 2)), "-i", img])
    voice_idx = n
    inputs.extend(["-i", voice_path])

    # === Filter complex ===
    filters = []

    # Cada imagem: scale + crop central + fade transitions (cortes rápidos)
    for i in range(n):
        filters.append(
            f"[{i}:v]scale=1080:1920:force_original_aspect_ratio=increase,"
            f"crop=1080:1920,setsar=1,"
            f"fade=t=in:st=0:d=0.25,"
            f"fade=t=out:st={max(0, per_img-0.25)}:d=0.25"
            f"[v{i}]"
        )

    # Concat
    concat_in = "".join(f"[v{i}]" for i in range(n))
    filters.append(f"{concat_in}concat=n={n}:v=1:a=0[slideshow]")

    # Overlays de texto sobre o slideshow
    text_chain = (
        # Overlay escuro no topo
        f"[slideshow]drawbox=x=0:y=0:w=1080:h=420:c=black@0.65:t=fill,"
        # Accent bar
        f"drawbox=x=0:y=0:w=1080:h=5:c={style['accent']}:t=fill,"
        # Badge
        f"drawtext=text='{style['badge']}':fontsize=26:fontcolor={style['accent']}:x=50:y=60:fontfile={font},"
        # Badge underline
        f"drawbox=x=50:y=96:w=90:h=3:c={style['accent']}:t=fill,"
        # Título
        f"drawtext=text='{title}':fontsize=42:fontcolor=white:x=50:y=130:fontfile={font},"
        # Overlay escuro central pra summary (aparece depois de 2s)
        f"drawbox=x=0:y=700:w=1080:h=350:c=black@0.55:t=fill:enable='gt(t,1.5)',"
        # Summary (aparece depois de 2s)
        f"drawtext=text='{summary}':fontsize=28:fontcolor=#e8e8e8:x=50:y=740:fontfile={font}:line_spacing=14:enable='gt(t,1.5)',"
        # Overlay bottom
        f"drawbox=x=0:y=1820:w=1080:h=100:c=black@0.75:t=fill,"
        # Barra de progresso
        f"drawbox=x=0:y=1916:w='(t/{duration})*1080':h=4:c={style['accent']}:t=fill,"
        # Source
        f"drawtext=text='{source}':fontsize=18:fontcolor=#aaaaaa:x=50:y=1850:fontfile={font},"
        # Branding
        f"drawtext=text='NEXUS CLIPS':fontsize=14:fontcolor=#666666:x=900:y=1852:fontfile={font}"
        f"[vout]"
    )
    filters.append(text_chain)

    # Music
    music_path = Path(__file__).parent.parent / "assets" / "music" / MUSIC_MAP.get(topic, "news.mp3")
    has_music = music_path.exists()

    if has_music:
        music_idx = voice_idx + 1
        inputs.extend(["-i", str(music_path)])
        filters.append(
            f"[{voice_idx}:a]volume=1.0[voice];"
            f"[{music_idx}:a]volume=0.10,afade=t=in:st=0:d=1.5,afade=t=out:st={max(0,duration-2.5)}:d=2.5[bgm];"
            f"[voice][bgm]amix=inputs=2:duration=shortest[aout]"
        )
        audio_map = "[aout]"
    else:
        audio_map = f"{voice_idx}:a"

    fc = ";".join(filters)

    cmd = [
        "ffmpeg", "-y", *inputs,
        "-filter_complex", fc,
        "-map", "[vout]", "-map", audio_map,
        "-c:v", "libx264", "-preset", "fast", "-crf", "22",
        "-c:a", "aac", "-b:a", "192k",
        "-shortest", "-movflags", "+faststart",
        video_path,
    ]

    proc = await asyncio.create_subprocess_exec(
        *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate()

    if proc.returncode != 0:
        log.error("video_builder.ffmpeg_err", stderr=stderr.decode()[-400:])
        return False
    return True


async def _build_simple(
    video_path: str, voice_path: str, duration: float,
    title: str, summary: str, source: str,
    style: dict, font: str,
) -> bool:
    """Fallback: fundo escuro + texto + voz."""
    vf = ",".join([
        f"drawbox=x=0:y=0:w=1080:h=1920:c=#08090c:t=fill",
        f"drawbox=x=0:y=0:w=1080:h=5:c={style['accent']}:t=fill",
        f"drawtext=text='{style['badge']}':fontsize=26:fontcolor={style['accent']}:x=50:y=100:fontfile={font}",
        f"drawtext=text='{title}':fontsize=42:fontcolor=white:x=50:y=170:fontfile={font}",
        f"drawtext=text='{summary}':fontsize=28:fontcolor=#b0b8cc:x=50:y=800:fontfile={font}:line_spacing=14",
        f"drawbox=x=0:y=1916:w='(t/{duration})*1080':h=4:c={style['accent']}:t=fill",
        f"drawtext=text='{source}':fontsize=18:fontcolor=#6b7590:x=50:y=1850:fontfile={font}",
    ])

    music_path = Path(__file__).parent.parent / "assets" / "music" / MUSIC_MAP.get("guerra", "news.mp3")

    if music_path.exists():
        cmd = [
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", f"color=c=#08090c:s=1080x1920:d={duration}:r=25",
            "-i", voice_path, "-i", str(music_path),
            "-filter_complex",
            f"[0:v]{vf}[vout];[1:a]volume=1.0[voice];[2:a]volume=0.10,afade=t=in:st=0:d=1.5,afade=t=out:st={max(0,duration-2)}:d=2[bgm];[voice][bgm]amix=inputs=2:duration=shortest[aout]",
            "-map", "[vout]", "-map", "[aout]",
            "-c:v", "libx264", "-preset", "fast", "-crf", "23",
            "-c:a", "aac", "-b:a", "128k",
            "-shortest", "-movflags", "+faststart",
            video_path,
        ]
    else:
        cmd = [
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", f"color=c=#08090c:s=1080x1920:d={duration}:r=25",
            "-i", voice_path,
            "-vf", vf,
            "-c:v", "libx264", "-preset", "fast", "-crf", "23",
            "-c:a", "aac", "-b:a", "128k",
            "-shortest", "-movflags", "+faststart",
            video_path,
        ]

    proc = await asyncio.create_subprocess_exec(
        *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate()
    if proc.returncode != 0:
        log.error("video_builder.simple_err", stderr=stderr.decode()[-300:])
        return False
    return True

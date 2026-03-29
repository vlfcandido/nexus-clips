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
        # Fallback: tenta com AntonioNeural (sempre funciona)
        if voice != "pt-BR-AntonioNeural":
            log.info("video_builder.tts_fallback_voice", from_voice=voice)
            if not await _edge_tts(clean_text, voice_path, "pt-BR-AntonioNeural", voice_rate):
                if not await _gtts_fallback(clean_text, voice_path):
                    return None
        elif not await _gtts_fallback(clean_text, voice_path):
            return None

    # === 2. Duração ===
    duration = await _audio_duration(voice_path)
    log.info("video_builder.duration", seconds=round(duration, 1))

    # === 3. Mídia do contexto (vídeos primeiro, fallback pra imagens) ===
    videos = []
    images = []
    vid_dir = output_dir / "videos" / output_name
    vid_dir.mkdir(parents=True, exist_ok=True)

    # Tenta buscar vídeos de stock (mais impactante que imagens)
    num_needed = max(3, int(duration / 5))  # ~1 video a cada 5s
    videos = await _fetch_videos(topic, title, vid_dir, count=min(num_needed, 4), summary=summary)

    # Se não achou vídeos suficientes, complementa com imagens
    if len(videos) < 2:
        num_images = max(4, int(duration / SECONDS_PER_IMAGE))
        images = await _fetch_images(topic, title, img_dir, count=min(num_images, 8), summary=summary)

    log.info("video_builder.media", videos=len(videos), images=len(images))

    # === 4. Legendas word-by-word (Whisper) ===
    subtitle_path = str(output_dir / "subs" / f"{output_name}.ass")
    Path(subtitle_path).parent.mkdir(parents=True, exist_ok=True)
    try:
        from generator.subtitles import generate_word_subtitles
        style = TOPIC_STYLE.get(topic, TOPIC_STYLE["guerra"])
        await generate_word_subtitles(
            voice_path, subtitle_path,
            accent_color="#FFFFFF",
            highlight_color=style["accent"],
        )
    except Exception as e:
        log.warning("video_builder.subtitles_failed", error=str(e))
        subtitle_path = None

    # === 5. Montar vídeo ===
    ok = await _build_video_v3(
        video_path, voice_path, duration, title, summary, source, topic, images,
        subtitle_path=subtitle_path,
        stock_videos=videos,
    )
    if not ok:
        return None

    elapsed = time.monotonic() - start
    log.info("video_builder.done", video=video_path, duration=round(duration, 1), elapsed_s=round(elapsed, 1))
    return {"video_path": video_path, "voice_path": voice_path, "duration": duration}


# ==================== TTS ====================

async def _edge_tts(text: str, out: str, voice: str, rate: str) -> bool:
    """Edge TTS — usa subprocess com script em arquivo (mais confiável)."""
    try:
        import tempfile

        # Escreve texto e script em arquivos temp
        txt_path = tempfile.mktemp(suffix='.txt')
        script_path = tempfile.mktemp(suffix='.py')

        Path(txt_path).write_text(text, encoding='utf-8')
        Path(script_path).write_text(
            f"import asyncio, edge_tts\n"
            f"async def main():\n"
            f"    text = open(r'{txt_path}', encoding='utf-8').read()\n"
            f"    c = edge_tts.Communicate(text, r'{voice}', rate=r'{rate}')\n"
            f"    await c.save(r'{out}')\n"
            f"asyncio.run(main())\n",
            encoding='utf-8',
        )

        # Usa path absoluto do Python do venv (uvicorn reload muda sys.executable)
        python_path = str(Path(__file__).parent.parent / ".venv" / "bin" / "python")
        if not Path(python_path).exists():
            python_path = sys.executable

        proc = await asyncio.create_subprocess_exec(
            python_path, script_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await proc.communicate()

        # Cleanup
        Path(txt_path).unlink(missing_ok=True)
        Path(script_path).unlink(missing_ok=True)

        if proc.returncode != 0:
            err = stderr.decode()[-200:]
            log.error("tts.edge_fail", err=err)
            return False

        if not Path(out).exists() or Path(out).stat().st_size < 100:
            log.error("tts.edge_empty")
            return False

        log.info("tts.edge_ok", voice=voice, size=Path(out).stat().st_size)
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

async def _generate_image_queries(title: str, summary: str, topic: str) -> list[str]:
    """Usa IA pra gerar queries de busca de imagem específicas pro conteúdo."""
    try:
        from config.llm import llm_json
        data = await llm_json(
            system="Generate 4 specific image search queries for stock photos. Return JSON.",
            user=f"""News: {title}. {summary}
Topic: {topic}

Generate 4 SPECIFIC image search queries to find relevant stock photos.
Be specific to the actual event, people, places mentioned.
Example: if news is about "US Marines in Middle East", queries should be:
"US Marines military ship", "Middle East desert troops", "Iran military", "naval fleet ocean"

NOT generic like "war" or "military".

Return JSON: {{"queries": ["query1", "query2", "query3", "query4"]}}""",
            temperature=0.3,
            max_tokens=150,
        )
        queries = data.get("queries", [])
        log.info("image_queries.generated", queries=queries)
        return queries[:4]
    except Exception as e:
        log.warning("image_queries.error", error=str(e))
        # Fallback: extrai palavras-chave do título
        words = [w for w in title.split() if len(w) > 3]
        return [" ".join(words[:3]), topic]


async def _fetch_videos(topic: str, title: str, out_dir: Path, count: int = 3, summary: str = "") -> list[str]:
    """Busca vídeos portrait do Pexels (clips de stock)."""
    api_key = settings.pexels_api_key
    if not api_key:
        return []

    queries = await _generate_image_queries(title, summary, topic)
    paths = []

    try:
        import httpx
        async with httpx.AsyncClient(timeout=30) as client:
            for query in queries:
                if len(paths) >= count:
                    break
                resp = await client.get(
                    "https://api.pexels.com/videos/search",
                    headers={"Authorization": api_key},
                    params={"query": query, "per_page": 3, "orientation": "portrait"},
                )
                if resp.status_code != 200:
                    continue
                for video in resp.json().get("videos", []):
                    if len(paths) >= count:
                        break
                    # Pega o melhor arquivo (720p+, portrait)
                    files = video.get("video_files", [])
                    best = sorted(
                        [f for f in files if f.get("height", 0) >= 720],
                        key=lambda f: f.get("height", 0),
                    )
                    if not best:
                        best = sorted(files, key=lambda f: f.get("height", 0), reverse=True)
                    if not best:
                        continue
                    url = best[0]["link"]
                    vid_resp = await client.get(url, follow_redirects=True)
                    if vid_resp.status_code == 200:
                        p = str(out_dir / f"vid_{len(paths):02d}.mp4")
                        Path(p).write_bytes(vid_resp.content)
                        paths.append(p)
                        log.info("pexels.video_downloaded", path=p, size=len(vid_resp.content))

        log.info("pexels.videos_ok", count=len(paths))
    except Exception as e:
        log.warning("pexels.videos_error", error=str(e))
    return paths


async def _fetch_images(topic: str, title: str, out_dir: Path, count: int = 6, summary: str = "") -> list[str]:
    """Busca imagens portrait do Pexels com queries específicas geradas por IA."""
    api_key = settings.pexels_api_key
    if not api_key:
        log.warning("pexels.no_key")
        return []

    queries = await _generate_image_queries(title, summary, topic)

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
    subtitle_path: str | None = None,
    stock_videos: list[str] | None = None,
) -> bool:
    """Monta vídeo com cortes rápidos, zoom, transições e overlays."""
    style = TOPIC_STYLE.get(topic, TOPIC_STYLE["guerra"])
    font = "/System/Library/Fonts/Helvetica.ttc"

    safe_title = _esc(title[:70])
    safe_source = _esc(source or "Nexus Clips")
    wrapped = textwrap.fill(summary[:200], width=34)
    safe_summary = _esc(wrapped)

    # Prioridade: stock videos > imagens > fallback simples
    if stock_videos and len(stock_videos) >= 2:
        ok = await _build_with_stock_videos(
            video_path, voice_path, duration, safe_title, safe_summary,
            safe_source, style, font, stock_videos, topic=topic,
            subtitle_path=subtitle_path,
        )
        if ok:
            return True
        log.info("video_builder.stock_failed_fallback")

    if images and len(images) >= 2:
        ok = await _build_with_images(
            video_path, voice_path, duration, safe_title, safe_summary,
            safe_source, style, font, images, topic=topic,
            subtitle_path=subtitle_path,
        )
        if ok:
            return True
        log.info("video_builder.images_failed_fallback")

    return await _build_simple(
        video_path, voice_path, duration, safe_title, safe_summary,
        safe_source, style, font
    )


async def _build_with_stock_videos(
    video_path: str, voice_path: str, duration: float,
    title: str, summary: str, source: str,
    style: dict, font: str, stock_videos: list[str],
    topic: str = "guerra", subtitle_path: str | None = None,
) -> bool:
    """Monta vídeo usando clips de stock do Pexels — cortes rápidos + overlays."""
    n = len(stock_videos)
    per_vid = duration / n
    voice_idx = n
    music_path = Path(__file__).parent.parent / "assets" / "music" / MUSIC_MAP.get(topic, "news.mp3")

    inputs = []
    filters = []

    # Input de cada stock video (truncado pra duração necessária)
    for i, sv in enumerate(stock_videos):
        inputs.extend(["-t", str(round(per_vid, 2)), "-i", sv])

    # Voice + music
    inputs.extend(["-i", voice_path])
    has_music = music_path.exists()
    if has_music:
        inputs.extend(["-i", str(music_path)])

    # Scale + crop cada video pra 1080x1920 + fade
    for i in range(n):
        filters.append(
            f"[{i}:v]scale=1080:1920:force_original_aspect_ratio=increase,"
            f"crop=1080:1920,setsar=1,"
            f"fade=t=in:st=0:d=0.3,fade=t=out:st={max(0, per_vid-0.3)}:d=0.3"
            f"[v{i}]"
        )

    # Concat
    concat_in = "".join(f"[v{i}]" for i in range(n))
    filters.append(f"{concat_in}concat=n={n}:v=1:a=0[slideshow]")

    # Text overlays
    text_chain = (
        f"[slideshow]drawbox=x=0:y=0:w=1080:h=420:c=black@0.65:t=fill,"
        f"drawbox=x=0:y=0:w=1080:h=5:c={style['accent']}:t=fill,"
        f"drawtext=text='{style.get('badge', 'NEWS')}':fontsize=26:fontcolor={style['accent']}:x=50:y=60:fontfile={font},"
        f"drawbox=x=50:y=96:w=90:h=3:c={style['accent']}:t=fill,"
        f"drawtext=text='{title}':fontsize=42:fontcolor=white:x=50:y=130:fontfile={font},"
        f"drawbox=x=0:y=1820:w=1080:h=100:c=black@0.75:t=fill,"
        f"drawbox=x=0:y=1916:w='(t/{duration})*1080':h=4:c={style['accent']}:t=fill,"
        f"drawtext=text='{source}':fontsize=18:fontcolor=#aaaaaa:x=50:y=1850:fontfile={font},"
        f"drawtext=text='NEXUS CLIPS':fontsize=14:fontcolor=#666666:x=900:y=1852:fontfile={font}"
    )
    if subtitle_path and Path(subtitle_path).exists():
        sub_esc = subtitle_path.replace("'", "'\\''").replace(":", "\\:")
        text_chain += f",subtitles='{sub_esc}'"
    text_chain += "[vout]"
    filters.append(text_chain)

    # Audio mix
    if has_music:
        music_idx = voice_idx + 1
        filters.append(
            f"[{voice_idx}:a]volume=1.0[voice];"
            f"[{music_idx}:a]volume=0.10,afade=t=in:d=1.5,afade=t=out:st={max(0,duration-2.5)}:d=2.5[bgm];"
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
        log.error("video_builder.stock_ffmpeg_err", stderr=stderr.decode()[-300:])
        return False

    log.info("video_builder.stock_video_ok", clips=n)
    return True


async def _build_with_images(
    video_path: str, voice_path: str, duration: float,
    title: str, summary: str, source: str,
    style: dict, font: str, images: list[str],
    topic: str = "guerra",
    subtitle_path: str | None = None,
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
    )
    # Legendas word-by-word (se disponíveis)
    if subtitle_path and Path(subtitle_path).exists():
        sub_esc = subtitle_path.replace("'", "'\\''").replace(":", "\\:")
        text_chain += f",subtitles='{sub_esc}'"
    text_chain += "[vout]"
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

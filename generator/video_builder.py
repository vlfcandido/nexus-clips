"""Gerador de vídeos "notícia narrada" — formato vertical (9:16).

V2 — Qualidade de creator profissional:
1. Voz neural Edge TTS (não gTTS) — entonação natural pt-BR
2. Background music por mood (royalty-free)
3. Imagens de apoio via Pexels API (grátis)
4. Ken Burns effect (zoom lento nas imagens)
5. Layout visual profissional
"""

import asyncio
import sys
import textwrap
import time
from pathlib import Path

import structlog

from config.settings import settings

log = structlog.get_logger()

# Música de fundo por tópico (paths relativos a assets/music/)
MUSIC_MAP = {
    "guerra": "dramatic.mp3",
    "futebol": "energetic.mp3",
    "política": "news.mp3",
    "entretenimento": "lofi.mp3",
}

TOPIC_STYLE = {
    "guerra": {"accent": "#ef4444", "badge": "URGENTE", "gradient": "#1a0505"},
    "futebol": {"accent": "#22c55e", "badge": "FUTEBOL", "gradient": "#051a0a"},
    "política": {"accent": "#3b82f6", "badge": "POLITICA", "gradient": "#05101a"},
    "entretenimento": {"accent": "#a855f7", "badge": "VIRAL", "gradient": "#0f051a"},
}


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
    """Gera vídeo completo de notícia narrada com qualidade profissional."""
    start = time.monotonic()
    log.info("video_builder.start", output=output_name, topic=topic)

    output_dir = settings.clips_output_dir
    output_dir.mkdir(parents=True, exist_ok=True)
    voice_dir = output_dir / "voice"
    voice_dir.mkdir(exist_ok=True)
    clips_dir = output_dir / "clips"
    clips_dir.mkdir(exist_ok=True)

    voice_path = str(voice_dir / f"{output_name}.mp3")
    video_path = str(clips_dir / f"{output_name}.mp4")

    # === 1. Gerar voz com Edge TTS (neural, qualidade boa) ===
    clean_text = narration_text.strip() or title
    log.info("video_builder.tts_input", chars=len(clean_text), voice=voice)

    voice_ok = await _generate_edge_tts(clean_text, voice_path, voice, voice_rate)
    if not voice_ok:
        # Fallback: gTTS (pior qualidade mas funciona sempre)
        log.warning("video_builder.edge_tts_failed_using_gtts")
        voice_ok = await _generate_gtts(clean_text, voice_path)
    if not voice_ok:
        return None

    # === 2. Duração do áudio ===
    duration = await _get_audio_duration(voice_path)
    log.info("video_builder.duration", seconds=round(duration, 1))

    # === 3. Buscar imagens de apoio (Pexels, grátis) ===
    images = await _fetch_background_images(topic, title, output_dir / "images")

    # === 4. Montar vídeo ===
    success = await _build_video(
        video_path=video_path,
        voice_path=voice_path,
        duration=duration,
        title=title,
        summary=summary,
        source=source,
        topic=topic,
        images=images,
    )

    if not success:
        return None

    elapsed = time.monotonic() - start
    log.info("video_builder.done", video=video_path, duration=round(duration, 1), elapsed_s=round(elapsed, 1))

    return {"video_path": video_path, "voice_path": voice_path, "duration": duration}


# ==================== TTS ====================

async def _generate_edge_tts(text: str, output_path: str, voice: str, rate: str) -> bool:
    """Gera voz com Edge TTS via subprocess (evita conflito de event loop)."""
    try:
        script = f"""
import asyncio, edge_tts
async def gen():
    comm = edge_tts.Communicate({repr(text)}, {repr(voice)}, rate={repr(rate)})
    await comm.save({repr(output_path)})
asyncio.run(gen())
"""
        proc = await asyncio.create_subprocess_exec(
            sys.executable, "-c", script,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await proc.communicate()

        if proc.returncode != 0:
            log.error("video_builder.edge_tts_error", stderr=stderr.decode()[:200])
            return False

        if not Path(output_path).exists() or Path(output_path).stat().st_size < 100:
            log.error("video_builder.edge_tts_empty")
            return False

        log.info("video_builder.edge_tts_ok", voice=voice, size=Path(output_path).stat().st_size)
        return True

    except Exception as e:
        log.error("video_builder.edge_tts_exception", error=str(e))
        return False


async def _generate_gtts(text: str, output_path: str) -> bool:
    """Fallback: gTTS (Google Translate voice)."""
    try:
        from gtts import gTTS

        def _gen():
            tts = gTTS(text, lang='pt', tld='com.br')
            tts.save(output_path)

        await asyncio.get_event_loop().run_in_executor(None, _gen)
        return Path(output_path).exists() and Path(output_path).stat().st_size > 100
    except Exception as e:
        log.error("video_builder.gtts_error", error=str(e))
        return False


# ==================== IMAGES ====================

async def _fetch_background_images(topic: str, title: str, output_dir: Path) -> list[str]:
    """Busca imagens de apoio no Pexels (grátis, sem atribuição necessária)."""
    output_dir.mkdir(parents=True, exist_ok=True)

    # Keywords por tópico
    search_queries = {
        "guerra": "war military explosion",
        "futebol": "soccer football stadium",
        "política": "government politics congress",
        "entretenimento": "entertainment viral social media",
    }
    query = search_queries.get(topic, topic)

    try:
        import httpx
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                "https://api.pexels.com/v1/search",
                headers={"Authorization": "HxjDgOb8hVcbXvzsjgrMFOuhxGxytwm3Z1vLSxNyv1s3FaFEJxq5BZLJ"},
                params={"query": query, "per_page": 3, "orientation": "portrait"},
            )

            if resp.status_code != 200:
                log.warning("video_builder.pexels_error", status=resp.status_code)
                return []

            photos = resp.json().get("photos", [])
            paths = []

            for i, photo in enumerate(photos[:3]):
                img_url = photo.get("src", {}).get("large2x", "")
                if not img_url:
                    continue

                img_resp = await client.get(img_url)
                if img_resp.status_code == 200:
                    img_path = str(output_dir / f"bg_{i}.jpg")
                    Path(img_path).write_bytes(img_resp.content)
                    paths.append(img_path)

            log.info("video_builder.images_fetched", count=len(paths), topic=topic)
            return paths

    except Exception as e:
        log.warning("video_builder.images_error", error=str(e))
        return []


# ==================== AUDIO UTILS ====================

async def _get_audio_duration(path: str) -> float:
    """Retorna duração do áudio em segundos."""
    try:
        proc = await asyncio.create_subprocess_exec(
            "ffprobe", "-v", "quiet", "-show_entries", "format=duration",
            "-of", "csv=p=0", path,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await proc.communicate()
        return float(stdout.decode().strip())
    except Exception:
        return 15.0


# ==================== VIDEO BUILD ====================

async def _build_video(
    video_path: str,
    voice_path: str,
    duration: float,
    title: str,
    summary: str,
    source: str,
    topic: str,
    images: list[str],
) -> bool:
    """Monta o vídeo final com imagens + texto + voz + música."""
    style = TOPIC_STYLE.get(topic, TOPIC_STYLE["guerra"])
    font = "/System/Library/Fonts/Helvetica.ttc"

    # Escapa textos pra ffmpeg
    def esc(t): return t.replace("'", "'\\''").replace(":", "\\:").replace("%", "%%").replace('"', '\\"')

    safe_title = esc(title[:80])
    safe_source = esc(source or "Nexus Clips")

    # Quebra summary em linhas
    wrapped = textwrap.fill(summary, width=36)
    safe_summary = esc(wrapped)

    # === Montar input de vídeo ===
    inputs = []
    filter_parts = []

    if images:
        # Slideshow de imagens com Ken Burns (zoom lento)
        per_image = duration / len(images)
        for i, img in enumerate(images):
            inputs.extend(["-loop", "1", "-t", str(per_image), "-i", img])

        # Escala cada imagem pra 1080x1920 + zoom lento
        img_filters = []
        for i in range(len(images)):
            # Zoom de 1.0 a 1.15 ao longo da duração da imagem (Ken Burns)
            img_filters.append(
                f"[{i}:v]scale=1080:1920:force_original_aspect_ratio=increase,"
                f"crop=1080:1920,"
                f"zoompan=z='min(zoom+0.0008,1.15)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={int(per_image*25)}:s=1080x1920:fps=25"
                f"[img{i}]"
            )

        filter_parts.extend(img_filters)

        # Concatena as imagens
        concat_inputs = "".join(f"[img{i}]" for i in range(len(images)))
        filter_parts.append(f"{concat_inputs}concat=n={len(images)}:v=1:a=0[bg]")
        video_stream = "[bg]"
    else:
        # Sem imagens: fundo escuro com gradiente
        inputs.extend(["-f", "lavfi", "-i", f"color=c=#08090c:s=1080x1920:d={duration}:r=25"])
        video_stream = "[0:v]"

    # === Overlay de textos ===
    audio_input_idx = len(images) if images else 1
    inputs.extend(["-i", voice_path])

    # Monta o filtro de texto sobre o vídeo
    text_filters = [
        # Overlay escuro semi-transparente no topo (pra texto legível sobre imagens)
        f"{video_stream}drawbox=x=0:y=0:w=1080:h=500:c=black@0.6:t=fill",
        # Overlay escuro no bottom
        f"drawbox=x=0:y=1700:w=1080:h=220:c=black@0.7:t=fill",
        # Accent bar no topo
        f"drawbox=x=0:y=0:w=1080:h=4:c={style['accent']}:t=fill",
        # Badge
        f"drawtext=text='{style['badge']}':fontsize=28:fontcolor={style['accent']}:x=60:y=80:fontfile={font}",
        # Separador sob badge
        f"drawbox=x=60:y=120:w=100:h=3:c={style['accent']}:t=fill",
        # Título (grande, branco, bold)
        f"drawtext=text='{safe_title}':fontsize=46:fontcolor=white:x=60:y=160:fontfile={font}",
        # Overlay escuro central pra summary
        f"drawbox=x=0:y=750:w=1080:h=400:c=black@0.5:t=fill",
        # Summary
        f"drawtext=text='{safe_summary}':fontsize=30:fontcolor=#e0e0e0:x=60:y=800:fontfile={font}:line_spacing=16",
        # Barra de progresso animada no bottom
        f"drawbox=x=0:y=1916:w='(t/{duration})*1080':h=4:c={style['accent']}:t=fill",
        # Source
        f"drawtext=text='{safe_source}':fontsize=20:fontcolor=#999999:x=60:y=1750:fontfile={font}",
        # Branding
        f"drawtext=text='NEXUS CLIPS':fontsize=16:fontcolor=#555555:x=880:y=1752:fontfile={font}",
    ]

    full_vf = ",".join(text_filters)
    filter_parts.append(full_vf + "[vout]")

    # === Background music ===
    music_path = Path(__file__).parent.parent / "assets" / "music" / MUSIC_MAP.get(topic, "news.mp3")
    has_music = music_path.exists()

    if has_music:
        inputs.extend(["-i", str(music_path)])
        music_idx = audio_input_idx + 1
        # Mix: voz a 100% + música a 12%
        filter_parts.append(
            f"[{audio_input_idx}:a]volume=1.0[voice];"
            f"[{music_idx}:a]volume=0.12,afade=t=in:st=0:d=2,afade=t=out:st={max(0, duration-3)}:d=3[music];"
            f"[voice][music]amix=inputs=2:duration=shortest[aout]"
        )
        audio_map = "[aout]"
    else:
        audio_map = f"{audio_input_idx}:a"

    # === Comando ffmpeg ===
    filter_complex = ";".join(filter_parts)

    cmd = [
        "ffmpeg", "-y",
        *inputs,
        "-filter_complex", filter_complex,
        "-map", "[vout]",
        "-map", audio_map,
        "-c:v", "libx264", "-preset", "fast", "-crf", "22",
        "-c:a", "aac", "-b:a", "192k",
        "-shortest",
        "-movflags", "+faststart",
        video_path,
    ]

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await proc.communicate()

        if proc.returncode != 0:
            err = stderr.decode()[-500:]
            log.error("video_builder.ffmpeg_error", stderr=err)
            # Fallback: tenta sem imagens e sem música
            if images or has_music:
                log.info("video_builder.fallback_simple")
                return await _build_simple_video(video_path, voice_path, duration, title, summary, source, topic)
            return False

        return True

    except Exception as e:
        log.error("video_builder.build_error", error=str(e))
        return False


async def _build_simple_video(
    video_path: str,
    voice_path: str,
    duration: float,
    title: str,
    summary: str,
    source: str,
    topic: str,
) -> bool:
    """Fallback simples: fundo escuro + texto + voz (sem imagens/música)."""
    style = TOPIC_STYLE.get(topic, TOPIC_STYLE["guerra"])
    font = "/System/Library/Fonts/Helvetica.ttc"

    def esc(t): return t.replace("'", "'\\''").replace(":", "\\:").replace("%", "%%")

    safe_title = esc(title[:80])
    safe_source = esc(source or "Nexus Clips")
    wrapped = textwrap.fill(summary, width=36)
    safe_summary = esc(wrapped)

    vf = ",".join([
        f"drawbox=x=0:y=0:w=1080:h=1920:c=#08090c:t=fill",
        f"drawbox=x=0:y=0:w=1080:h=4:c={style['accent']}:t=fill",
        f"drawtext=text='{style['badge']}':fontsize=28:fontcolor={style['accent']}:x=60:y=100:fontfile={font}",
        f"drawtext=text='{safe_title}':fontsize=46:fontcolor=white:x=60:y=180:fontfile={font}",
        f"drawtext=text='{safe_summary}':fontsize=28:fontcolor=#b0b8cc:x=60:y=800:fontfile={font}:line_spacing=14",
        f"drawbox=x=0:y=1916:w='(t/{duration})*1080':h=4:c={style['accent']}:t=fill",
        f"drawtext=text='{safe_source}':fontsize=20:fontcolor=#6b7590:x=60:y=1850:fontfile={font}",
    ])

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
        log.error("video_builder.simple_ffmpeg_error", stderr=stderr.decode()[-300:])
        return False

    return True

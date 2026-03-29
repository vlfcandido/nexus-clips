"""Gerador de vídeos "notícia narrada" — formato vertical (9:16).

Cria vídeo sem source original: background escuro + texto animado + voz IA.
Perfeito pra notícias de RSS que não têm vídeo.

Fluxo:
1. Gera áudio com Edge TTS
2. Calcula duração do áudio
3. Monta vídeo com ffmpeg (background + textos + áudio)
4. Retorna path do vídeo pronto
"""

import asyncio
import subprocess
import time
from pathlib import Path

import structlog

from config.settings import settings

log = structlog.get_logger()


async def generate_narrated_video(
    title: str,
    summary: str,
    narration_text: str,
    source: str = "",
    category: str = "breaking",
    topic: str = "guerra",
    output_name: str = "clip",
    voice: str = "pt-BR-AntonioNeural",
    voice_rate: str = "+5%",
) -> dict | None:
    """Gera vídeo completo de notícia narrada.

    Retorna: {"video_path": str, "voice_path": str, "duration": float} ou None
    """
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

    # === 1. Gerar voz ===
    try:
        clean_text = narration_text.strip() or title
        log.info("video_builder.tts_input", chars=len(clean_text), text=clean_text[:80])

        # Usa gTTS (Google Text-to-Speech) — grátis, funciona em qualquer Python
        from gtts import gTTS

        def _gen_tts():
            tts = gTTS(clean_text, lang='pt', tld='com.br')
            tts.save(voice_path)

        await asyncio.get_event_loop().run_in_executor(None, _gen_tts)

        if not Path(voice_path).exists() or Path(voice_path).stat().st_size < 100:
            log.error("video_builder.tts_empty")
            return None

        log.info("video_builder.voice_ok", path=voice_path, chars=len(clean_text))
    except Exception as e:
        log.error("video_builder.voice_error", error=str(e))
        return None

    # === 2. Obter duração do áudio ===
    try:
        probe = await asyncio.create_subprocess_exec(
            "ffprobe", "-v", "quiet", "-show_entries", "format=duration",
            "-of", "csv=p=0", voice_path,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await probe.communicate()
        duration = float(stdout.decode().strip())
        log.info("video_builder.duration", seconds=round(duration, 1))
    except Exception as e:
        log.error("video_builder.probe_error", error=str(e))
        duration = 15.0

    # === 3. Montar vídeo com ffmpeg ===
    # Cores por tópico
    topic_colors = {
        "guerra": {"accent": "#ef4444", "badge": "URGENTE", "bg_top": "#1a0505"},
        "futebol": {"accent": "#22c55e", "badge": "FUTEBOL", "bg_top": "#051a0a"},
        "política": {"accent": "#3b82f6", "badge": "POLITICA", "bg_top": "#05101a"},
        "entretenimento": {"accent": "#a855f7", "badge": "VIRAL", "bg_top": "#0f051a"},
    }
    tc = topic_colors.get(topic, topic_colors["guerra"])

    # Escapa caracteres especiais pra ffmpeg drawtext
    safe_title = title.replace("'", "'\\''").replace(":", "\\:").replace("%", "%%")
    safe_summary = summary.replace("'", "'\\''").replace(":", "\\:").replace("%", "%%")
    safe_source = source.replace("'", "'\\''").replace(":", "\\:") if source else "Nexus Clips"

    # Quebra summary em linhas de ~35 chars
    words = safe_summary.split()
    lines = []
    current = ""
    for w in words:
        test = f"{current} {w}".strip()
        if len(test) > 38:
            lines.append(current)
            current = w
        else:
            current = test
    if current:
        lines.append(current)
    summary_text = "\\n".join(lines[:6])  # Max 6 linhas

    # Font path (macOS)
    font = "/System/Library/Fonts/Helvetica.ttc"

    # Filtros de vídeo
    vf_parts = [
        # Background escuro
        f"drawbox=x=0:y=0:w=1080:h=1920:c=#08090c:t=fill",
        # Top accent bar
        f"drawbox=x=0:y=0:w=1080:h=4:c={tc['accent']}:t=fill",
        # Badge
        f"drawtext=text='{tc['badge']}':fontsize=26:fontcolor={tc['accent']}:x=60:y=120:fontfile={font}",
        # Linha decorativa
        f"drawbox=x=60:y=160:w=120:h=2:c={tc['accent']}:t=fill",
        # Título principal (grande)
        f"drawtext=text='{safe_title}':fontsize=48:fontcolor=white:x=60:y=200:fontfile={font}",
        # Separador
        f"drawbox=x=60:y=780:w=960:h=1:c=#1e2332:t=fill",
        # Summary
        f"drawtext=text='{summary_text}':fontsize=28:fontcolor=#b0b8cc:x=60:y=820:fontfile={font}:line_spacing=14",
        # Bottom bar
        f"drawbox=x=0:y=1820:w=1080:h=100:c=#0e1117:t=fill",
        # Source
        f"drawtext=text='{safe_source}':fontsize=20:fontcolor=#6b7590:x=60:y=1850:fontfile={font}",
        # Nexus branding
        f"drawtext=text='NEXUS CLIPS':fontsize=18:fontcolor=#414b63:x=820:y=1852:fontfile={font}",
    ]

    vf = ",".join(vf_parts)

    cmd = [
        "ffmpeg", "-y",
        "-f", "lavfi", "-i", f"color=c=#08090c:s=1080x1920:d={duration}",
        "-i", voice_path,
        "-vf", vf,
        "-c:v", "libx264", "-preset", "fast", "-crf", "23",
        "-c:a", "aac", "-b:a", "128k",
        "-shortest", "-movflags", "+faststart",
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
            log.error("video_builder.ffmpeg_error", stderr=stderr.decode()[-300:])
            return None

        elapsed = time.monotonic() - start
        log.info(
            "video_builder.done",
            video=video_path,
            duration=round(duration, 1),
            elapsed_s=round(elapsed, 1),
        )

        return {
            "video_path": video_path,
            "voice_path": voice_path,
            "duration": duration,
        }

    except Exception as e:
        log.error("video_builder.error", error=str(e))
        return None

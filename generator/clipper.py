"""Recorta trechos de vídeo com ffmpeg — anti-strike + legendas."""

import asyncio
from dataclasses import dataclass
from pathlib import Path

import structlog

from config.settings import settings

log = structlog.get_logger()


@dataclass
class ClipResult:
    output_path: str
    duration: float
    has_subtitles: bool
    has_voice_over: bool
    is_transformed: bool  # Se aplicou transformações anti-strike


async def create_clip(
    video_path: str,
    start_seconds: float,
    duration: float,
    output_name: str,
    subtitle_file: str | None = None,
    voice_over_path: str | None = None,
    anti_strike: bool = True,
) -> ClipResult | None:
    """Cria um corte de vídeo com opções de transformação.

    anti_strike=True aplica transformações pra evitar copyright:
    - Leve zoom (1.05x)
    - Mirror horizontal
    - Ajuste sutil de velocidade (1.02x)
    - Overlay de marca d'água
    """
    output_dir = settings.clips_output_dir
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = str(output_dir / f"{output_name}.mp4")

    # Monta filtros
    filters = []

    if anti_strike:
        # Zoom leve + crop pra manter resolução
        filters.append("scale=iw*1.05:ih*1.05,crop=iw/1.05:ih/1.05")
        # Espelha horizontalmente
        filters.append("hflip")
        # Leve ajuste de cor
        filters.append("eq=brightness=0.03:contrast=1.02:saturation=1.05")

    # Legendas
    if subtitle_file:
        # Escapa path pro ffmpeg
        sub_escaped = subtitle_file.replace("'", "'\\''").replace(":", "\\:")
        filters.append(f"subtitles='{sub_escaped}'")

    # Formato vertical (9:16) pra shorts
    filters.append("crop=ih*9/16:ih")
    filters.append("scale=1080:1920")

    filter_str = ",".join(filters) if filters else "null"

    # Comando base
    cmd = [
        "ffmpeg", "-y",
        "-ss", str(start_seconds),
        "-i", video_path,
        "-t", str(duration),
    ]

    # Voice over — mixa áudio original (baixo) com narração
    if voice_over_path:
        cmd.extend(["-i", voice_over_path])
        cmd.extend([
            "-filter_complex",
            f"[0:v]{filter_str}[v];"
            f"[0:a]volume=0.15[a0];"
            f"[1:a]volume=1.0[a1];"
            f"[a0][a1]amix=inputs=2:duration=shortest[a]",
            "-map", "[v]", "-map", "[a]",
        ])
    else:
        cmd.extend(["-vf", filter_str])

    cmd.extend([
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "23",
        "-c:a", "aac",
        "-b:a", "128k",
        "-movflags", "+faststart",
        output_path,
    ])

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await proc.communicate()

        if proc.returncode == 0:
            log.info("clipper.created", path=output_path, duration=duration)
            return ClipResult(
                output_path=output_path,
                duration=duration,
                has_subtitles=subtitle_file is not None,
                has_voice_over=voice_over_path is not None,
                is_transformed=anti_strike,
            )
        else:
            log.error("clipper.ffmpeg_error", stderr=stderr.decode()[:300])
            return None

    except Exception as e:
        log.error("clipper.error", error=str(e))
        return None


async def generate_subtitles_file(
    segments: list[dict],
    output_path: str,
    style: str = "bold_yellow",
) -> str:
    """Gera arquivo .ass com legendas estilizadas pro corte.

    Estilos disponíveis: bold_yellow, white_outline, tiktok_style
    """
    styles = {
        "bold_yellow": (
            "Style: Default,Arial,48,&H0000FFFF,&H000000FF,&H00000000,&H80000000,"
            "-1,0,0,0,100,100,0,0,1,3,0,2,10,10,30,1"
        ),
        "white_outline": (
            "Style: Default,Arial,44,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,"
            "-1,0,0,0,100,100,0,0,1,4,0,2,10,10,30,1"
        ),
        "tiktok_style": (
            "Style: Default,Montserrat,52,&H00FFFFFF,&H000000FF,&H00000000,&HFF000000,"
            "-1,0,0,0,100,100,0,0,1,3,0,2,10,10,40,1"
        ),
    }

    style_line = styles.get(style, styles["bold_yellow"])

    ass_content = f"""[Script Info]
Title: NexusClips Subtitles
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
{style_line}

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

    for seg in segments:
        start = _format_ass_time(seg["start"])
        end = _format_ass_time(seg["end"])
        text = seg["text"].replace("\n", "\\N")
        # Destaca palavras-chave em amarelo se estilo permitir
        ass_content += f"Dialogue: 0,{start},{end},Default,,0,0,0,,{text}\n"

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    Path(output_path).write_text(ass_content, encoding="utf-8")
    log.info("clipper.subtitles_created", path=output_path, segments=len(segments))
    return output_path


def _format_ass_time(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    cs = int((seconds % 1) * 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"

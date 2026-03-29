"""Geração automática de thumbnails chamativas."""

import asyncio
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
import structlog

from config.settings import settings

log = structlog.get_logger()


async def generate_thumbnail(
    video_path: str,
    title: str,
    output_name: str,
    timestamp: float = 5.0,
    category: str = "futebol",
) -> str | None:
    """Gera thumbnail a partir de um frame do vídeo + texto overlay.

    1. Extrai frame do vídeo
    2. Aplica overlay escuro
    3. Adiciona texto chamativo
    4. Adiciona badge de categoria
    """
    output_dir = settings.clips_output_dir / "thumbnails"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = str(output_dir / f"{output_name}.jpg")

    try:
        # Extrai frame
        frame_path = str(output_dir / f"_temp_{output_name}.jpg")
        proc = await asyncio.create_subprocess_exec(
            "ffmpeg", "-y",
            "-ss", str(timestamp),
            "-i", video_path,
            "-vframes", "1",
            "-q:v", "2",
            frame_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        await proc.communicate()

        if proc.returncode != 0:
            log.error("thumbnail.frame_extract_failed")
            return None

        # Abre e edita com Pillow
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None, _create_thumbnail, frame_path, title, output_path, category
        )
        return result

    except Exception as e:
        log.error("thumbnail.error", error=str(e))
        return None


def _create_thumbnail(
    frame_path: str,
    title: str,
    output_path: str,
    category: str,
) -> str:
    img = Image.open(frame_path)
    # Resize pra 1280x720
    img = img.resize((1280, 720), Image.LANCZOS)

    draw = ImageDraw.Draw(img)

    # Overlay escuro na parte inferior
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    overlay_draw = ImageDraw.Draw(overlay)
    overlay_draw.rectangle(
        [(0, 450), (1280, 720)],
        fill=(0, 0, 0, 180),
    )
    img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
    draw = ImageDraw.Draw(img)

    # Texto do título
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 48)
        font_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 28)
    except OSError:
        font = ImageFont.load_default()
        font_small = font

    # Quebra texto em linhas
    words = title.split()
    lines = []
    current_line = ""
    for word in words:
        test = f"{current_line} {word}".strip()
        bbox = draw.textbbox((0, 0), test, font=font)
        if bbox[2] - bbox[0] > 1200:
            lines.append(current_line)
            current_line = word
        else:
            current_line = test
    if current_line:
        lines.append(current_line)

    y = 480
    for line in lines[:3]:
        # Sombra
        draw.text((42, y + 2), line, fill=(0, 0, 0), font=font)
        # Texto
        draw.text((40, y), line, fill=(255, 255, 255), font=font)
        y += 60

    # Badge de categoria
    colors = {
        "futebol": (0, 180, 0),
        "política": (180, 0, 0),
        "entretenimento": (0, 100, 200),
    }
    badge_color = colors.get(category, (100, 100, 100))
    badge_text = category.upper()
    draw.rounded_rectangle([(40, 20), (200, 60)], radius=8, fill=badge_color)
    draw.text((55, 25), badge_text, fill=(255, 255, 255), font=font_small)

    img.save(output_path, "JPEG", quality=90)
    log.info("thumbnail.created", path=output_path)

    # Limpa temp
    Path(frame_path).unlink(missing_ok=True)

    return output_path

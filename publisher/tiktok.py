"""Publisher pra TikTok.

NOTA: TikTok não tem API pública pra upload de vídeo.
Opções:
1. TikTok Content Posting API (precisa de app aprovado)
2. Playwright automation (não recomendado em prod)
3. Notificar via Telegram pra upload manual

Por ora, este módulo prepara o vídeo e notifica.
Quando tiver acesso à API, ativa o upload automático.
"""

from pathlib import Path

import structlog

from config.settings import settings

log = structlog.get_logger()


async def publish_to_tiktok(
    video_path: str,
    caption: str,
    hashtags: list[str] | None = None,
) -> str | None:
    """Prepara vídeo pra TikTok e notifica pra upload.

    TODO: Integrar com TikTok Content Posting API quando aprovado.
    """
    if not Path(video_path).exists():
        log.error("tiktok.file_not_found", path=video_path)
        return None

    # Monta caption com hashtags
    if hashtags:
        caption = f"{caption}\n\n{' '.join(hashtags)}"

    # Por enquanto, salva na pasta de output com metadados
    output_dir = settings.clips_output_dir / "tiktok_ready"
    output_dir.mkdir(parents=True, exist_ok=True)

    # Copia pra pasta de TikTok
    import shutil
    filename = Path(video_path).name
    dest = str(output_dir / filename)
    shutil.copy2(video_path, dest)

    # Salva caption
    meta_path = str(output_dir / f"{Path(filename).stem}_caption.txt")
    Path(meta_path).write_text(caption, encoding="utf-8")

    log.info("tiktok.ready", path=dest, caption_path=meta_path)

    # Retorna path — o dashboard mostra como "pronto pra upload"
    return dest


async def publish_to_instagram_reels(
    video_path: str,
    caption: str,
) -> str | None:
    """Similar ao TikTok — prepara pra upload manual ou via Graph API."""
    if not Path(video_path).exists():
        log.error("instagram.file_not_found", path=video_path)
        return None

    output_dir = settings.clips_output_dir / "instagram_ready"
    output_dir.mkdir(parents=True, exist_ok=True)

    import shutil
    filename = Path(video_path).name
    dest = str(output_dir / filename)
    shutil.copy2(video_path, dest)

    meta_path = str(output_dir / f"{Path(filename).stem}_caption.txt")
    Path(meta_path).write_text(caption, encoding="utf-8")

    log.info("instagram.ready", path=dest)
    return dest

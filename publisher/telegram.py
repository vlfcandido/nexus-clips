"""Publisher pra Telegram — notifica canal/grupo com o corte pronto."""

import structlog
from telegram import Bot
from telegram.constants import ParseMode

from config.settings import settings

log = structlog.get_logger()


async def publish_to_telegram(
    video_path: str | None,
    caption: str,
    thumbnail_path: str | None = None,
) -> str | None:
    """Posta vídeo/notícia no canal do Telegram."""
    if not settings.telegram_bot_token or not settings.telegram_channel_id:
        log.warning("telegram.skip", reason="Token ou channel não configurado")
        return None

    try:
        bot = Bot(token=settings.telegram_bot_token)

        if video_path:
            with open(video_path, "rb") as video:
                thumb = open(thumbnail_path, "rb") if thumbnail_path else None
                msg = await bot.send_video(
                    chat_id=settings.telegram_channel_id,
                    video=video,
                    caption=caption[:1024],
                    parse_mode=ParseMode.HTML,
                    thumbnail=thumb,
                    supports_streaming=True,
                )
                if thumb:
                    thumb.close()
        else:
            msg = await bot.send_message(
                chat_id=settings.telegram_channel_id,
                text=caption[:4096],
                parse_mode=ParseMode.HTML,
            )

        log.info("telegram.published", message_id=msg.message_id)
        return f"https://t.me/c/{settings.telegram_channel_id}/{msg.message_id}"

    except Exception as e:
        log.error("telegram.error", error=str(e))
        return None

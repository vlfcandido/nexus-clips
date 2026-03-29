"""Coletor de YouTube — monitora lives e vídeos recentes."""

import asyncio
import subprocess
import tempfile
from pathlib import Path

import httpx
import structlog

from config.settings import settings
from sources.base import BaseSource, RawContent

log = structlog.get_logger()


class YouTubeSource(BaseSource):
    def __init__(self):
        self._callbacks: list = []
        self._running = False
        self._task: asyncio.Task | None = None

    def on_content(self, callback) -> None:
        self._callbacks.append(callback)

    async def start(self) -> None:
        if not settings.youtube_api_key:
            log.warning("youtube.skip", reason="YOUTUBE_API_KEY não configurado")
            return
        self._running = True
        self._task = asyncio.create_task(self._poll_loop())
        log.info("youtube.started")

    async def stop(self) -> None:
        self._running = False
        if self._task:
            self._task.cancel()
        log.info("youtube.stopped")

    async def _poll_loop(self):
        """Busca vídeos recentes por keywords + monitora canais configurados."""
        seen_ids: set[str] = set()

        while self._running:
            try:
                videos = await self._search_recent_videos()
                for video in videos:
                    vid = video["id"].get("videoId", "")
                    if not vid or vid in seen_ids:
                        continue
                    seen_ids.add(vid)

                    snippet = video.get("snippet", {})
                    title = snippet.get("title", "")
                    description = snippet.get("description", "")

                    content = RawContent(
                        source_type="youtube",
                        source_id=vid,
                        source_url=f"https://www.youtube.com/watch?v={vid}",
                        text=f"{title}\n{description}",
                        media_url=f"https://www.youtube.com/watch?v={vid}",
                        author=snippet.get("channelTitle", ""),
                        topic_hints=self._extract_topics(f"{title} {description}"),
                        extra={
                            "is_live": snippet.get("liveBroadcastContent") == "live",
                            "thumbnail": snippet.get("thumbnails", {})
                            .get("high", {})
                            .get("url", ""),
                        },
                    )

                    for cb in self._callbacks:
                        await cb(content)

                    log.info("youtube.new_video", id=vid, title=title[:60])

            except Exception as e:
                log.error("youtube.error", error=str(e))

            # Limita set
            if len(seen_ids) > 5000:
                seen_ids = set(list(seen_ids)[-2500:])

            await asyncio.sleep(60)  # Poll a cada 60s

    async def _search_recent_videos(self) -> list[dict]:
        """Busca vídeos recentes no YouTube por keywords."""
        query = " | ".join(settings.monitor_topics[:5])

        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://www.googleapis.com/youtube/v3/search",
                params={
                    "part": "snippet",
                    "q": query,
                    "type": "video",
                    "order": "date",
                    "maxResults": 10,
                    "key": settings.youtube_api_key,
                    "relevanceLanguage": "pt",
                    "regionCode": "BR",
                },
            )
            if resp.status_code == 200:
                return resp.json().get("items", [])
            else:
                log.error("youtube.search_error", status=resp.status_code)
                return []

    def _extract_topics(self, text: str) -> list[str]:
        text_lower = text.lower()
        return [t for t in settings.monitor_topics if t.lower() in text_lower]


async def download_video(url: str, output_dir: Path | None = None) -> str | None:
    """Baixa um vídeo do YouTube usando yt-dlp. Retorna o caminho do arquivo."""
    if output_dir is None:
        output_dir = settings.temp_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    output_path = str(output_dir / "%(id)s.%(ext)s")

    try:
        proc = await asyncio.create_subprocess_exec(
            "yt-dlp",
            "-f", "best[height<=720]",
            "--no-playlist",
            "-o", output_path,
            url,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()

        if proc.returncode == 0:
            # Encontra o arquivo baixado
            for f in output_dir.iterdir():
                if f.suffix in (".mp4", ".webm", ".mkv"):
                    log.info("youtube.downloaded", path=str(f))
                    return str(f)
        else:
            log.error("youtube.download_error", stderr=stderr.decode()[:200])
    except Exception as e:
        log.error("youtube.download_exception", error=str(e))

    return None

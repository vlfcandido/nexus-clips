"""Detector de trending topics — pega trends do X e Google e avalia potencial."""

import asyncio
from dataclasses import dataclass

import httpx
import structlog

from config.settings import settings

log = structlog.get_logger()


@dataclass
class TrendingTopic:
    name: str
    source: str  # twitter, google
    volume: int  # volume estimado de menções
    url: str
    estimated_virality: float  # 0-10
    category: str  # futebol, política, entretenimento, outro
    should_monitor: bool  # Se vale a pena adicionar ao monitoramento


async def get_twitter_trends() -> list[TrendingTopic]:
    """Pega trending topics do Twitter/X Brasil."""
    if not settings.twitter_bearer_token:
        return []

    try:
        headers = {"Authorization": f"Bearer {settings.twitter_bearer_token}"}
        async with httpx.AsyncClient() as client:
            # WOEID do Brasil = 23424768
            resp = await client.get(
                "https://api.twitter.com/1.1/trends/place.json",
                headers=headers,
                params={"id": 23424768},
            )

            if resp.status_code != 200:
                log.error("trending.twitter_error", status=resp.status_code)
                return []

            data = resp.json()
            trends = data[0].get("trends", []) if data else []

            results = []
            for t in trends[:30]:
                volume = t.get("tweet_volume") or 0
                name = t["name"]

                category = _categorize_trend(name)
                virality = min(10, volume / 10000) if volume else 3.0

                results.append(TrendingTopic(
                    name=name,
                    source="twitter",
                    volume=volume,
                    url=t.get("url", ""),
                    estimated_virality=virality,
                    category=category,
                    should_monitor=virality >= 5.0 or category in ("futebol", "política"),
                ))

            log.info("trending.twitter", count=len(results))
            return results

    except Exception as e:
        log.error("trending.twitter_exception", error=str(e))
        return []


async def get_google_trends_br() -> list[TrendingTopic]:
    """Pega trending searches do Google Brasil via RSS."""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://trends.google.com.br/trending/rss?geo=BR",
                timeout=15,
            )

            if resp.status_code != 200:
                return []

            import feedparser
            feed = feedparser.parse(resp.text)

            results = []
            for entry in feed.entries[:20]:
                title = entry.get("title", "")
                traffic = entry.get("ht_approx_traffic", "0")
                traffic_num = int(traffic.replace("+", "").replace(",", "").replace(".", "")) if traffic else 0

                category = _categorize_trend(title)
                virality = min(10, traffic_num / 50000) if traffic_num else 4.0

                results.append(TrendingTopic(
                    name=title,
                    source="google",
                    volume=traffic_num,
                    url=entry.get("link", ""),
                    estimated_virality=virality,
                    category=category,
                    should_monitor=virality >= 5.0 or category in ("futebol", "política"),
                ))

            log.info("trending.google", count=len(results))
            return results

    except Exception as e:
        log.error("trending.google_exception", error=str(e))
        return []


async def get_all_trends() -> list[TrendingTopic]:
    """Pega trends de todas as fontes."""
    twitter, google = await asyncio.gather(
        get_twitter_trends(),
        get_google_trends_br(),
    )
    all_trends = twitter + google
    # Ordena por viralidade estimada
    all_trends.sort(key=lambda t: t.estimated_virality, reverse=True)
    return all_trends


# --- Keywords pra categorização ---

_FUTEBOL_KEYWORDS = {
    "gol", "futebol", "seleção", "copa", "libertadores", "brasileirão",
    "flamengo", "corinthians", "palmeiras", "são paulo", "santos",
    "vasco", "fluminense", "botafogo", "grêmio", "inter", "cruzeiro",
    "atlético", "neymar", "vini jr", "endrick", "cbf", "fifa",
    "champions", "mundial", "eliminatórias",
}

_POLITICA_KEYWORDS = {
    "lula", "bolsonaro", "congresso", "stf", "senado", "câmara",
    "governo", "presidente", "ministro", "pl ", "pt ", "política",
    "deputado", "senador", "impeachment", "cpi", "reforma",
    "eleição", "voto", "urna", "tse",
}


def _categorize_trend(text: str) -> str:
    text_lower = text.lower()
    if any(kw in text_lower for kw in _FUTEBOL_KEYWORDS):
        return "futebol"
    if any(kw in text_lower for kw in _POLITICA_KEYWORDS):
        return "política"
    return "outro"

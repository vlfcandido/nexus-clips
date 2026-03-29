"""Publisher pra Twitter/X."""

import structlog
import tweepy

from config.settings import settings

log = structlog.get_logger()


def _get_client() -> tweepy.Client | None:
    if not settings.twitter_api_key:
        return None
    return tweepy.Client(
        consumer_key=settings.twitter_api_key,
        consumer_secret=settings.twitter_api_secret,
        access_token=settings.twitter_access_token,
        access_token_secret=settings.twitter_access_secret,
    )


def _get_api_v1() -> tweepy.API | None:
    """API v1.1 necessária pra upload de mídia."""
    if not settings.twitter_api_key:
        return None
    auth = tweepy.OAuth1UserHandler(
        settings.twitter_api_key,
        settings.twitter_api_secret,
        settings.twitter_access_token,
        settings.twitter_access_secret,
    )
    return tweepy.API(auth)


async def publish_to_twitter(
    text: str,
    video_path: str | None = None,
) -> str | None:
    """Posta tweet com texto e opcionalmente vídeo."""
    client = _get_client()
    if not client:
        log.warning("twitter.skip", reason="API keys não configuradas")
        return None

    try:
        media_id = None
        if video_path:
            api_v1 = _get_api_v1()
            if api_v1:
                media = api_v1.media_upload(
                    video_path,
                    media_category="tweet_video",
                )
                media_id = media.media_id

        kwargs = {"text": text[:280]}
        if media_id:
            kwargs["media_ids"] = [media_id]

        response = client.create_tweet(**kwargs)
        tweet_id = response.data["id"]
        url = f"https://twitter.com/i/status/{tweet_id}"

        log.info("twitter.published", tweet_id=tweet_id)
        return url

    except Exception as e:
        log.error("twitter.error", error=str(e))
        return None

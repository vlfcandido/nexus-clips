"""YouTube OAuth2 + Upload — fluxo completo.

Passos:
1. Pedro configura Client ID + Client Secret no sistema (obtido do Google Cloud Console)
2. Sistema gera URL de autorização → Pedro clica e autoriza
3. Google redireciona com code → sistema troca por access_token + refresh_token
4. Com os tokens, sistema faz upload de vídeos

Persistência: tokens salvos na conta (PublishAccount.access_token e refresh_token)
"""

import json
from pathlib import Path

import httpx
import structlog

log = structlog.get_logger()

# Scopes necessários pra upload de vídeo
YOUTUBE_SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube",
]

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"


def get_auth_url(client_id: str, redirect_uri: str) -> str:
    """Gera URL pra Pedro autorizar o app no Google."""
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": " ".join(YOUTUBE_SCOPES),
        "access_type": "offline",
        "prompt": "consent",
    }
    qs = "&".join(f"{k}={v}" for k, v in params.items())
    return f"{GOOGLE_AUTH_URL}?{qs}"


async def exchange_code(code: str, client_id: str, client_secret: str, redirect_uri: str) -> dict:
    """Troca authorization code por access_token + refresh_token."""
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(GOOGLE_TOKEN_URL, data={
            "code": code,
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        })

    if resp.status_code != 200:
        log.error("youtube.oauth.exchange_failed", status=resp.status_code, body=resp.text[:200])
        return {"error": resp.json().get("error_description", f"HTTP {resp.status_code}")}

    data = resp.json()
    log.info("youtube.oauth.tokens_received", has_refresh=bool(data.get("refresh_token")))
    return {
        "access_token": data.get("access_token", ""),
        "refresh_token": data.get("refresh_token", ""),
        "expires_in": data.get("expires_in", 3600),
    }


async def refresh_access_token(refresh_token: str, client_id: str, client_secret: str) -> dict:
    """Renova access_token usando refresh_token."""
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(GOOGLE_TOKEN_URL, data={
            "refresh_token": refresh_token,
            "client_id": client_id,
            "client_secret": client_secret,
            "grant_type": "refresh_token",
        })

    if resp.status_code != 200:
        return {"error": "Refresh failed"}

    data = resp.json()
    return {"access_token": data.get("access_token", ""), "expires_in": data.get("expires_in", 3600)}


async def upload_video(
    access_token: str,
    video_path: str,
    title: str,
    description: str,
    tags: list[str],
    privacy: str = "public",
) -> dict:
    """Upload de vídeo pro YouTube via API."""
    if not Path(video_path).exists():
        return {"error": f"Arquivo nao encontrado: {video_path}"}

    metadata = {
        "snippet": {
            "title": title[:100],
            "description": description[:5000],
            "tags": tags[:30],
            "categoryId": "25",  # News & Politics
        },
        "status": {
            "privacyStatus": privacy,
            "selfDeclaredMadeForKids": False,
        },
    }

    file_size = Path(video_path).stat().st_size
    log.info("youtube.upload.start", title=title[:50], size_mb=round(file_size / 1024 / 1024, 1))

    try:
        async with httpx.AsyncClient(timeout=300) as client:
            # Step 1: Iniciar upload resumable
            init_resp = await client.post(
                "https://www.googleapis.com/upload/youtube/v3/videos",
                params={"uploadType": "resumable", "part": "snippet,status"},
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json; charset=utf-8",
                    "X-Upload-Content-Length": str(file_size),
                    "X-Upload-Content-Type": "video/mp4",
                },
                content=json.dumps(metadata),
            )

            if init_resp.status_code not in (200, 308):
                err = init_resp.text[:300]
                log.error("youtube.upload.init_failed", status=init_resp.status_code, error=err)
                return {"error": f"Falha ao iniciar upload: {err}"}

            upload_url = init_resp.headers.get("location")
            if not upload_url:
                return {"error": "Google nao retornou URL de upload"}

            # Step 2: Upload do arquivo
            with open(video_path, "rb") as f:
                upload_resp = await client.put(
                    upload_url,
                    content=f.read(),
                    headers={"Content-Type": "video/mp4"},
                )

            if upload_resp.status_code == 200:
                video_data = upload_resp.json()
                video_id = video_data.get("id", "")
                url = f"https://youtube.com/watch?v={video_id}"
                log.info("youtube.upload.success", video_id=video_id, url=url)
                return {"video_id": video_id, "url": url}
            else:
                err = upload_resp.text[:300]
                log.error("youtube.upload.failed", status=upload_resp.status_code, error=err)
                return {"error": f"Upload falhou: {err}"}

    except Exception as e:
        log.error("youtube.upload.exception", error=str(e))
        return {"error": str(e)}
